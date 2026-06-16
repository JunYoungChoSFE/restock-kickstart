import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { ensureShop } from "../models/shop.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await ensureShop(session.shop);

  // 어떤 상품/변형에 몇 명이 대기 중인가 — 재입고/재주문 판단을 돕는 수요 인사이트.
  const grouped = await db.subscription.groupBy({
    by: ["variantId", "productTitle", "variantTitle"],
    where: { shopId: shop.id, status: "pending" },
    _count: { _all: true },
  });

  const rows = grouped
    .map((g) => ({
      variantId: g.variantId,
      product: [g.productTitle, g.variantTitle].filter(Boolean).join(" — ") || g.variantId,
      waiting: g._count._all,
    }))
    .sort((a, b) => b.waiting - a.waiting);

  return { rows };
};

export default function Waitlist() {
  const { rows } = useLoaderData<typeof loader>();

  return (
    <s-page heading="Waitlist">
      <s-section heading="Who's waiting for what">
        <s-paragraph>
          Demand insight — the products customers want back most. Use it to decide
          what to restock or reorder.
        </s-paragraph>
        {rows.length === 0 ? (
          <s-paragraph>No one is waiting yet.</s-paragraph>
        ) : (
          <s-table>
            <s-table-header-row>
              <s-table-header>Product</s-table-header>
              <s-table-header>Waiting</s-table-header>
            </s-table-header-row>
            <s-table-body>
              {rows.map((r) => (
                <s-table-row key={r.variantId}>
                  <s-table-cell>{r.product}</s-table-cell>
                  <s-table-cell>{r.waiting.toLocaleString()}</s-table-cell>
                </s-table-row>
              ))}
            </s-table-body>
          </s-table>
        )}
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
