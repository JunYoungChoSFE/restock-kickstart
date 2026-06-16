import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { ensureShop } from "../models/shop.server";
import { releaseHeldJobs, setPlan } from "../models/billing.server";
import { kickWorker } from "../worker.server";

/**
 * app_subscriptions/update 웹훅 — 구독 상태 변화 시 플랜 동기화.
 * ACTIVE = pro, 그 외(cancelled/expired/paused 등) = free.
 * Pro로 바뀌면 한도 때문에 보류(held)됐던 알림을 풀어 즉시 발송한다.
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic, payload } = await authenticate.webhook(request);
  console.log(`Received ${topic} webhook for ${shop}`);

  const status = (payload as { app_subscription?: { status?: string } })
    .app_subscription?.status;
  const isPro = status === "ACTIVE";

  const shopRecord = await ensureShop(shop);
  await setPlan(shopRecord.id, isPro ? "pro" : "free");

  if (isPro) {
    const released = await releaseHeldJobs(shopRecord.id);
    if (released > 0) kickWorker();
  }

  return new Response();
};
