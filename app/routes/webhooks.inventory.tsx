import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { ensureShop } from "../models/shop.server";
import { decideRestock, type ProductStatus } from "../lib/restock-detect/detect";
import { enqueueRestock } from "../models/queue.server";
import { kickWorker } from "../worker.server";

/**
 * inventory_levels/update → 재입고 감지 → enqueue → 즉시 발송 kick.
 * 웹훅은 빠르게 200을 돌려주고, 실제 발송은 워커가 처리(가드레일: 즉시·보장).
 *
 * 페이로드는 inventory_item_id를 주므로 GraphQL로 variant/product 상태·게시·총재고를 조회한다.
 * 오발송 차단(초안/미게시)은 decideRestock가 책임지고, 재발송은 구독 단위 멱등성이 막는다.
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic, payload, admin } = await authenticate.webhook(request);
  console.log(`Received ${topic} webhook for ${shop}`);

  if (!admin) return new Response(); // 관리 컨텍스트 없으면 variant 해석 불가
  const body = payload as { inventory_item_id?: number };
  const inventoryItemId = body.inventory_item_id;
  if (inventoryItemId == null) return new Response();

  const res = await admin.graphql(
    `#graphql
    query InventoryToVariant($id: ID!) {
      inventoryItem(id: $id) {
        variant {
          id
          inventoryQuantity
          title
          product { id title status onlineStoreUrl publishedAt }
        }
      }
    }`,
    { variables: { id: `gid://shopify/InventoryItem/${inventoryItemId}` } },
  );
  const json = (await res.json()) as {
    data?: {
      inventoryItem?: {
        variant?: {
          id: string;
          inventoryQuantity: number | null;
          title: string | null;
          product?: {
            id: string;
            title: string;
            status: ProductStatus;
            onlineStoreUrl: string | null;
            publishedAt: string | null;
          } | null;
        } | null;
      } | null;
    };
  };

  const variant = json.data?.inventoryItem?.variant;
  if (!variant?.product) return new Response();

  const shopRow = await ensureShop(shop);

  const decision = decideRestock({
    previousAvailable: null, // 재발송은 구독 단위 멱등성이 차단하므로 전환 미상으로 둔다
    newAvailable: variant.inventoryQuantity ?? 0,
    threshold: shopRow.setting?.threshold ?? 1,
    productStatus: variant.product.status,
    // publishedAt = Online Store 게시 시각(가장 정확한 게시 신호). onlineStoreUrl은 보조.
    publishedToOnlineStore: Boolean(
      variant.product.publishedAt || variant.product.onlineStoreUrl,
    ),
  });

  if (!decision.fire) {
    console.log(`[inventory] skip ${variant.id}: ${decision.reason}`);
    return new Response();
  }

  // Subscription.variantId는 스토어프론트가 보내는 숫자 id로 통일 → GID에서 숫자만 추출.
  const variantId = variant.id.split("/").pop() ?? variant.id;
  const queued = await enqueueRestock(shopRow.id, variantId);
  console.log(`[inventory] restock variant ${variantId} → queued ${queued}`);
  if (queued > 0) kickWorker();

  return new Response();
};
