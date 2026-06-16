import type { ActionFunctionArgs } from "react-router";
import { data } from "react-router";
import { authenticate } from "../shopify.server";
import { ensureShop } from "../models/shop.server";
import db from "../db.server";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 * 스토어프론트 "입고 알림" 신청 캡처.
 * App Proxy: 스토어프론트 /apps/<subpath>/subscribe → /proxy/subscribe (서명 검증).
 * Subscription(pending) 생성. (shop, variant, email) 유일 → 중복 신청 멱등.
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  await authenticate.public.appProxy(request); // App Proxy 서명 검증
  const shopDomain = new URL(request.url).searchParams.get("shop");
  if (!shopDomain) {
    return data({ ok: false, error: "missing shop" }, { status: 400 });
  }

  const form = await request.formData();
  const email = String(form.get("email") || "").trim().toLowerCase();
  const variantId = String(form.get("variantId") || "").trim();
  const productId = String(form.get("productId") || "").trim();
  const productTitle = String(form.get("productTitle") || "").trim();
  const variantTitle = String(form.get("variantTitle") || "").trim();

  if (!EMAIL_RE.test(email)) {
    return data({ ok: false, error: "Enter a valid email." }, { status: 400 });
  }
  if (!variantId) {
    return data({ ok: false, error: "Missing variant." }, { status: 400 });
  }

  const shop = await ensureShop(shopDomain);
  await db.subscription.upsert({
    where: {
      shopId_variantId_email: { shopId: shop.id, variantId, email },
    },
    create: { shopId: shop.id, productId, variantId, productTitle, variantTitle, email },
    update: { status: "pending", notifiedAt: null }, // 재신청 시 다시 대기 상태로
  });

  return data({ ok: true });
};
