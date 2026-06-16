import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { purgeShop } from "../models/gdpr.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, session, topic } = await authenticate.webhook(request);
  console.log(`Received ${topic} webhook for ${shop}`);

  // 클린 언인스톨 (가드레일): 가맹점 데이터를 완전히 제거. "입고 알림" 버튼은
  // Theme App Extension이라 앱 삭제 시 Shopify가 자동 제거 → 주입 스크립트 잔여 0.
  if (session) {
    await db.session.deleteMany({ where: { shop } });
  }
  await purgeShop(shop);

  return new Response();
};
