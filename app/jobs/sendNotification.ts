// 발송 워커 (신뢰성 코어). 인프로세스에서 주기적으로 호출되어 due 잡을 처리한다.
// 흐름: queued + runAt<=now 잡 claim → 이메일 발송 → 결과로 잡 상태 결정(done/재시도/failed)
//       → Subscription·NotificationLog·NotificationJob을 트랜잭션으로 갱신.
// 멱등성: 이미 notified/cancelled인 신청은 발송하지 않고 잡만 done 처리.

import db from "../db.server";
import { nextJobState, type SendOutcome } from "../lib/queue/retry";
import { buildRestockEmail } from "../lib/email/templates";
import { deliver } from "../lib/email/send";

/** 발송 함수 — 테스트에서 주입 가능(성공/실패 시뮬레이션). */
export type Sender = (
  to: string,
  subject: string,
  text: string,
  html?: string,
) => Promise<{ ok: true; id?: string } | { ok: false; error: string }>;

const defaultSender: Sender = (to, subject, text, html) =>
  deliver(to, subject, text, html);

export interface RunOptions {
  now?: Date;
  limit?: number;
  send?: Sender;
  baseMs?: number;
  capMs?: number;
}

export interface RunResult {
  processed: number;
  sent: number;
  retried: number;
  failed: number;
  skipped: number;
}

export async function runDueJobs(opts: RunOptions = {}): Promise<RunResult> {
  const now = opts.now ?? new Date();
  const send = opts.send ?? defaultSender;
  const limit = opts.limit ?? 50;

  const due = await db.notificationJob.findMany({
    where: { status: "queued", runAt: { lte: now } },
    take: limit,
    orderBy: { runAt: "asc" },
  });

  const result: RunResult = {
    processed: due.length,
    sent: 0,
    retried: 0,
    failed: 0,
    skipped: 0,
  };

  for (const job of due) {
    // lock: 같은 잡을 다른 패스가 집지 않게 processing으로.
    await db.notificationJob.update({
      where: { id: job.id },
      data: { status: "processing", lockedAt: now },
    });

    const sub = await db.subscription.findUnique({
      where: { id: job.subscriptionId },
    });

    // 멱등성: 신청이 없거나 이미 처리됨(notified/cancelled) → 발송 없이 잡만 종료.
    if (!sub || sub.status !== "pending") {
      await db.notificationJob.update({
        where: { id: job.id },
        data: { status: "done", lockedAt: null },
      });
      result.skipped++;
      continue;
    }

    const setting = await db.setting.findUnique({ where: { shopId: job.shopId } });
    const shop = await db.shop.findUnique({ where: { id: job.shopId } });
    const storeName = shop?.shopDomain ?? "the store";

    const email = buildRestockEmail({
      productTitle: sub.productTitle,
      variantTitle: sub.variantTitle,
      storeName,
      productUrl: shop ? `https://${shop.shopDomain}` : null,
      customSubject: setting?.emailSubject,
    });

    const sendRes = await send(sub.email, email.subject, email.text, email.html);
    const outcome: SendOutcome = sendRes.ok
      ? { ok: true }
      : { ok: false, error: sendRes.error };

    const t = nextJobState(
      { attempts: job.attempts, maxAttempts: job.maxAttempts },
      outcome,
      { baseMs: opts.baseMs, capMs: opts.capMs },
    );

    if (t.status === "done") {
      await db.$transaction([
        db.subscription.update({
          where: { id: sub.id },
          data: { status: "notified", notifiedAt: now },
        }),
        db.notificationLog.create({
          data: {
            shopId: job.shopId,
            subscriptionId: sub.id,
            status: "sent",
            providerMessageId: sendRes.ok ? sendRes.id ?? null : null,
            attempts: t.attempts,
            sentAt: now,
          },
        }),
        db.notificationJob.update({
          where: { id: job.id },
          data: { status: "done", attempts: t.attempts, lockedAt: null },
        }),
      ]);
      result.sent++;
    } else if (t.status === "queued") {
      const runAt = new Date(now.getTime() + t.runAtDelayMs);
      await db.$transaction([
        db.notificationLog.create({
          data: {
            shopId: job.shopId,
            subscriptionId: sub.id,
            status: "retrying",
            error: outcome.ok ? null : outcome.error,
            attempts: t.attempts,
          },
        }),
        db.notificationJob.update({
          where: { id: job.id },
          data: {
            status: "queued",
            attempts: t.attempts,
            runAt,
            lockedAt: null,
            lastError: outcome.ok ? null : outcome.error,
          },
        }),
      ]);
      result.retried++;
    } else {
      // failed — 더는 재시도 안 함. 상인이 로그에서 본다.
      await db.$transaction([
        db.notificationLog.create({
          data: {
            shopId: job.shopId,
            subscriptionId: sub.id,
            status: "failed",
            error: t.lastError,
            attempts: t.attempts,
          },
        }),
        db.notificationJob.update({
          where: { id: job.id },
          data: {
            status: "failed",
            attempts: t.attempts,
            lastError: t.lastError,
            lockedAt: null,
          },
        }),
      ]);
      result.failed++;
    }
  }

  return result;
}
