import { describe, it, expect, beforeEach } from "vitest";
import db from "../db.server";
import {
  canSend,
  FREE_MONTHLY_NOTIFICATIONS,
  releaseHeldJobs,
} from "./billing.server";
import { enqueueRestock } from "./queue.server";
import { runDueJobs, type Sender } from "../jobs/sendNotification";

const okSender: Sender = async () => ({ ok: true, id: "m" });

async function reset() {
  await db.notificationLog.deleteMany();
  await db.notificationJob.deleteMany();
  await db.subscription.deleteMany();
  await db.setting.deleteMany();
  await db.shop.deleteMany();
}

beforeEach(reset);

describe("canSend (순수)", () => {
  it("Pro는 무제한", () => {
    expect(canSend("pro", FREE_MONTHLY_NOTIFICATIONS + 100)).toBe(true);
  });
  it("Free는 한도 미만이면 허용", () => {
    expect(canSend("free", 0)).toBe(true);
    expect(canSend("free", FREE_MONTHLY_NOTIFICATIONS - 1)).toBe(true);
  });
  it("Free는 한도 도달 시 차단", () => {
    expect(canSend("free", FREE_MONTHLY_NOTIFICATIONS)).toBe(false);
  });
});

describe("무료 한도 게이트 (worker)", () => {
  // 이번 달 sent 로그를 한도만큼 채운 상점 + 발송 대기 신규 구독.
  async function shopAtLimit(plan: "free" | "pro") {
    const shop = await db.shop.create({
      data: { shopDomain: "demo.myshopify.com", plan, setting: { create: {} } },
    });
    const filler = await db.subscription.create({
      data: { shopId: shop.id, productId: "p0", variantId: "v0", email: "f@example.com", status: "notified" },
    });
    await db.notificationLog.createMany({
      data: Array.from({ length: FREE_MONTHLY_NOTIFICATIONS }, () => ({
        shopId: shop.id,
        subscriptionId: filler.id,
        status: "sent",
      })),
    });
    const sub = await db.subscription.create({
      data: { shopId: shop.id, productId: "p1", variantId: "v1", email: "a@example.com" },
    });
    await enqueueRestock(shop.id, "v1");
    return { shop, sub };
  }

  it("Free 상점이 한도를 넘으면 발송하지 않고 held", async () => {
    const { sub } = await shopAtLimit("free");
    const r = await runDueJobs({ send: okSender });
    expect(r).toMatchObject({ processed: 1, held: 1, sent: 0 });

    const job = await db.notificationJob.findFirstOrThrow({
      where: { subscriptionId: sub.id },
    });
    expect(job.status).toBe("held");
    const s = await db.subscription.findUnique({ where: { id: sub.id } });
    expect(s?.status).toBe("pending"); // 아직 알림 안 감
  });

  it("Pro 상점은 한도와 무관하게 발송", async () => {
    const { sub } = await shopAtLimit("pro");
    const r = await runDueJobs({ send: okSender });
    expect(r).toMatchObject({ processed: 1, sent: 1 });
    const s = await db.subscription.findUnique({ where: { id: sub.id } });
    expect(s?.status).toBe("notified");
  });

  it("Pro 전환 + releaseHeldJobs 후 보류분이 발송된다", async () => {
    const { shop, sub } = await shopAtLimit("free");
    await runDueJobs({ send: okSender }); // held

    await db.shop.update({ where: { id: shop.id }, data: { plan: "pro" } });
    expect(await releaseHeldJobs(shop.id)).toBe(1);

    const r = await runDueJobs({ send: okSender });
    expect(r).toMatchObject({ sent: 1 });
    const s = await db.subscription.findUnique({ where: { id: sub.id } });
    expect(s?.status).toBe("notified");
  });
});
