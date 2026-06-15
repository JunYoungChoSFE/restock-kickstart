// 발송 큐 enqueue (DB 기반). 재입고 감지가 "진짜 재입고"로 판정되면 호출된다.
// 멱등성: NotificationJob.subscriptionId는 @unique → 같은 신청에 잡이 중복 생기지 않는다.

import db from "../db.server";

/**
 * 해당 variant의 pending Subscription들을 발송 큐에 넣는다.
 * 이미 큐에 있는 신청은 건드리지 않는다(멱등). 새로 들어간 잡 수를 반환.
 */
export async function enqueueRestock(
  shopId: string,
  variantId: string,
): Promise<number> {
  const subs = await db.subscription.findMany({
    where: { shopId, variantId, status: "pending" },
    select: { id: true },
  });
  if (subs.length === 0) return 0;

  let created = 0;
  // SQLite는 createMany(skipDuplicates) 미지원 → subscriptionId @unique 기준 upsert로 멱등 처리.
  for (const s of subs) {
    const existing = await db.notificationJob.findUnique({
      where: { subscriptionId: s.id },
      select: { id: true },
    });
    if (existing) continue;
    await db.notificationJob.create({
      data: { shopId, subscriptionId: s.id },
    });
    created++;
  }
  return created;
}
