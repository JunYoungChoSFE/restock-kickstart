// 발송 파이프라인 통합 테스트 — 실제 SQLite(dev.sqlite) 대상.
// 신뢰성 코어(큐·재시도·멱등·로그)가 DB에서 실제로 맞물려 도는지 검증.

import { describe, it, expect, beforeEach } from "vitest";
import db from "../db.server";
import { enqueueRestock } from "./queue.server";
import { runDueJobs, type Sender } from "../jobs/sendNotification";

const okSender: Sender = async () => ({ ok: true, id: "msg_1" });
const failSender: Sender = async () => ({ ok: false, error: "smtp 500" });

async function reset() {
  await db.notificationLog.deleteMany();
  await db.notificationJob.deleteMany();
  await db.subscription.deleteMany();
  await db.setting.deleteMany();
  await db.shop.deleteMany();
}

async function seed(opts: { variantId?: string; email?: string } = {}) {
  const shop = await db.shop.create({
    data: { shopDomain: "demo.myshopify.com", setting: { create: {} } },
  });
  const sub = await db.subscription.create({
    data: {
      shopId: shop.id,
      productId: "p1",
      variantId: opts.variantId ?? "v1",
      productTitle: "Linen Shirt",
      variantTitle: "M / Blue",
      email: opts.email ?? "a@example.com",
    },
  });
  return { shop, sub };
}

beforeEach(reset);

describe("enqueueRestock — 멱등 enqueue", () => {
  it("pending 신청당 잡 1개, 두 번 호출해도 잡은 중복 생성 안 됨(upsert로 re-queue)", async () => {
    const { shop, sub } = await seed();
    expect(await enqueueRestock(shop.id, "v1")).toBe(1);
    expect(await enqueueRestock(shop.id, "v1")).toBe(1); // 재호출도 1(re-queue), 잡은 그대로 1개
    const jobs = await db.notificationJob.findMany({
      where: { subscriptionId: sub.id },
    });
    expect(jobs).toHaveLength(1);
  });

  it("이전 알림이 done이어도 재구독(pending) 시 다시 queued로 발송됨", async () => {
    const { shop, sub } = await seed();
    await enqueueRestock(shop.id, "v1");
    // 첫 발송 완료처럼: 잡 done + 구독 notified
    await db.notificationJob.update({
      where: { subscriptionId: sub.id },
      data: { status: "done" },
    });
    await db.subscription.update({
      where: { id: sub.id },
      data: { status: "notified" },
    });
    // 재품절 후 재구독: 다시 pending
    await db.subscription.update({
      where: { id: sub.id },
      data: { status: "pending" },
    });
    // 재입고 → 기존 done 잡이 queued로 리셋되어야 함
    expect(await enqueueRestock(shop.id, "v1")).toBe(1);
    const job = await db.notificationJob.findFirstOrThrow({
      where: { subscriptionId: sub.id },
    });
    expect(job.status).toBe("queued");
  });

  it("pending 아닌 신청은 큐에 안 넣음", async () => {
    const { shop, sub } = await seed();
    await db.subscription.update({
      where: { id: sub.id },
      data: { status: "cancelled" },
    });
    expect(await enqueueRestock(shop.id, "v1")).toBe(0);
  });
});

describe("runDueJobs — 발송 결과 처리", () => {
  it("성공 → 신청 notified + 로그 sent + 잡 done", async () => {
    const { shop, sub } = await seed();
    await enqueueRestock(shop.id, "v1");

    const r = await runDueJobs({ send: okSender });
    expect(r).toMatchObject({ processed: 1, sent: 1 });

    const s = await db.subscription.findUnique({ where: { id: sub.id } });
    expect(s?.status).toBe("notified");
    expect(s?.notifiedAt).toBeTruthy();

    const log = await db.notificationLog.findFirst({
      where: { subscriptionId: sub.id },
    });
    expect(log?.status).toBe("sent");
    expect(log?.providerMessageId).toBe("msg_1");

    const job = await db.notificationJob.findFirst({
      where: { subscriptionId: sub.id },
    });
    expect(job?.status).toBe("done");
  });

  it("실패 → 잡 queued(미래 runAt, 백오프) + 로그 retrying + attempts 증가", async () => {
    const { shop, sub } = await seed();
    await enqueueRestock(shop.id, "v1");
    // 잡 생성 시각(현재) 이후로 둬야 due로 잡힌다.
    const now = new Date("2027-01-01T00:00:00Z");

    const r = await runDueJobs({ send: failSender, now, baseMs: 1000 });
    expect(r).toMatchObject({ processed: 1, retried: 1 });

    const job = await db.notificationJob.findFirstOrThrow({
      where: { subscriptionId: sub.id },
    });
    expect(job.status).toBe("queued");
    expect(job.attempts).toBe(1);
    expect(job.runAt.getTime()).toBe(now.getTime() + 1000); // 백오프 예약

    const log = await db.notificationLog.findFirst({
      where: { subscriptionId: sub.id },
    });
    expect(log?.status).toBe("retrying");

    // 같은 시각엔 runAt이 미래라 다시 안 잡힌다.
    const r2 = await runDueJobs({ send: failSender, now });
    expect(r2.processed).toBe(0);
  });

  it("maxAttempts 도달 → failed + 로그 failed", async () => {
    const { shop, sub } = await seed();
    await enqueueRestock(shop.id, "v1");
    await db.notificationJob.updateMany({
      where: { shopId: shop.id },
      data: { maxAttempts: 1 },
    });

    const r = await runDueJobs({ send: failSender });
    expect(r).toMatchObject({ processed: 1, failed: 1 });

    const job = await db.notificationJob.findFirstOrThrow({
      where: { subscriptionId: sub.id },
    });
    expect(job.status).toBe("failed");
    expect(job.lastError).toContain("smtp 500");

    const log = await db.notificationLog.findFirst({
      where: { subscriptionId: sub.id },
    });
    expect(log?.status).toBe("failed");
  });

  it("이미 notified면 발송 안 하고 잡만 done (중복 웹훅 안전)", async () => {
    const { shop, sub } = await seed();
    await db.subscription.update({
      where: { id: sub.id },
      data: { status: "notified", notifiedAt: new Date() },
    });
    await db.notificationJob.create({
      data: { shopId: shop.id, subscriptionId: sub.id },
    });

    let sendCalls = 0;
    const countingSender: Sender = async () => {
      sendCalls++;
      return { ok: true };
    };
    const r = await runDueJobs({ send: countingSender });
    expect(r).toMatchObject({ processed: 1, skipped: 1 });
    expect(sendCalls).toBe(0); // 발송 시도조차 안 함

    const job = await db.notificationJob.findFirstOrThrow({
      where: { subscriptionId: sub.id },
    });
    expect(job.status).toBe("done");
  });
});
