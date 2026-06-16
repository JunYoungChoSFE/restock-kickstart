import db from "../db.server";

/**
 * 무료 플랜 월 알림 한도 — 넉넉하게(기획 7절). 유일한 무료→유료 게이트.
 * 핵심 기능(버튼·발송 로그·수요 인사이트)은 절대 잠그지 않는다(가드레일). 한도는 발송량 하나뿐.
 */
export const FREE_MONTHLY_NOTIFICATIONS = 50;

function startOfMonthUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/** 이번 달 실제 발송(sent) 건수. */
export function monthlyNotificationCount(shopId: string): Promise<number> {
  return db.notificationLog.count({
    where: { shopId, status: "sent", createdAt: { gte: startOfMonthUtc() } },
  });
}

/** 발송 허용 여부 — Pro 무제한, Free는 월 한도까지. (순수 함수) */
export function canSend(plan: string, monthlyCount: number): boolean {
  return plan === "pro" || monthlyCount < FREE_MONTHLY_NOTIFICATIONS;
}

export function setPlan(shopId: string, plan: "free" | "pro") {
  return db.shop.update({ where: { id: shopId }, data: { plan } });
}

/** Pro 전환 시, 한도 때문에 보류(held)됐던 잡을 다시 큐로 되돌린다. 푼 잡 수 반환. */
export async function releaseHeldJobs(shopId: string): Promise<number> {
  const res = await db.notificationJob.updateMany({
    where: { shopId, status: "held" },
    data: { status: "queued", lockedAt: null },
  });
  return res.count;
}
