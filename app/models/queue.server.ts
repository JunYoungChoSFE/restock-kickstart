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
  console.log(
    `[enqueue] shop=${shopId} variant=${variantId}: ${subs.length} pending found`,
  );
  if (subs.length === 0) return 0;

  // subscriptionId가 @unique이므로 upsert로 멱등 처리.
  //  - 새 신청: 잡 생성.
  //  - 이미 잡이 있으면(이전 알림 done/failed, 재품절 후 재구독 등) **queued로 리셋** → 다시 발송.
  //    같은 재입고의 중복 웹훅엔 그냥 queued 유지(부작용 없음). 워커의 멱등성이 중복 발송을 막는다.
  for (const s of subs) {
    await db.notificationJob.upsert({
      where: { subscriptionId: s.id },
      create: { shopId, subscriptionId: s.id },
      update: {
        status: "queued",
        attempts: 0,
        lockedAt: null,
        lastError: null,
        runAt: new Date(),
      },
    });
  }
  return subs.length;
}
