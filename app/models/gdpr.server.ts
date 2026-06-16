import db from "../db.server";

/**
 * GDPR / 클린 언인스톨 데이터 삭제 (CLAUDE.md 가드레일 6, 7절).
 * Shop 삭제 시 Setting/Subscription/NotificationLog/NotificationJob이 onDelete: Cascade로 함께 삭제 → 흔적 0.
 *
 * Pinged가 보유한 고객 데이터 = 스토어프론트에서 신청한 입고알림 구독(email 기준).
 * 로그인 고객이 아닐 수도 있어 customer id가 아니라 **이메일**로 식별/삭제한다.
 */

/** 특정 고객(이메일) 데이터 삭제 (customers/redact). 구독·로그·잡이 cascade로 함께 삭제. */
export async function redactByEmail(shopDomain: string, email: string) {
  const shop = await db.shop.findUnique({ where: { shopDomain } });
  if (!shop) return;
  await db.subscription.deleteMany({
    where: { shopId: shop.id, email: email.toLowerCase() },
  });
}

/** 가맹점 전체 데이터 완전 삭제 (shop/redact, app/uninstalled). 흔적 0. */
export async function purgeShop(shopDomain: string) {
  await db.shop.deleteMany({ where: { shopDomain } });
}

/** customers/data_request 응답용 — 우리가 보유한 데이터(해당 이메일의 구독 내역). */
export async function collectByEmail(shopDomain: string, email: string) {
  const shop = await db.shop.findUnique({ where: { shopDomain } });
  if (!shop) return null;
  const subs = await db.subscription.findMany({
    where: { shopId: shop.id, email: email.toLowerCase() },
    select: {
      productTitle: true,
      variantTitle: true,
      status: true,
      createdAt: true,
      notifiedAt: true,
    },
  });
  if (subs.length === 0) return null;
  return {
    email,
    subscriptions: subs.map((s) => ({
      productTitle: s.productTitle,
      variantTitle: s.variantTitle,
      status: s.status,
      createdAt: s.createdAt.toISOString(),
      notifiedAt: s.notifiedAt?.toISOString() ?? null,
    })),
  };
}
