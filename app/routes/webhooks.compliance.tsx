import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import {
  collectByEmail,
  purgeShop,
  redactByEmail,
} from "../models/gdpr.server";

/**
 * 필수 GDPR 3종을 단일 엔드포인트에서 처리 (App Store 요건).
 * Pinged는 고객을 이메일로 식별한다(스토어프론트 입고알림 신청).
 *  - customers/data_request: 보유 데이터를 수집(여기선 로깅; 실제 전달은 상인 경유).
 *  - customers/redact:      해당 이메일의 구독·로그·잡을 삭제.
 *  - shop/redact:           상점 전체 데이터 삭제.
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic, payload } = await authenticate.webhook(request);
  console.log(`Received compliance ${topic} webhook for ${shop}`);

  const body = payload as { customer?: { email?: string } };
  const email = body.customer?.email ? String(body.customer.email) : null;

  switch (topic) {
    case "CUSTOMERS_DATA_REQUEST": {
      if (email) {
        const data = await collectByEmail(shop, email);
        console.log(
          `data_request: ${email} retained data ${data ? "present" : "none"}`,
        );
      }
      break;
    }
    case "CUSTOMERS_REDACT": {
      if (email) await redactByEmail(shop, email);
      break;
    }
    case "SHOP_REDACT": {
      await purgeShop(shop);
      break;
    }
    default:
      console.log(`Unhandled compliance topic: ${topic}`);
  }

  return new Response();
};
