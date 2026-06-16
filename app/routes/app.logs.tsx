import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { ensureShop } from "../models/shop.server";

const STATUS_TONE: Record<string, "success" | "critical" | "warning" | "neutral"> = {
  sent: "success",
  failed: "critical",
  retrying: "warning",
};

function formatWhen(d: Date): string {
  return d.toISOString().slice(0, 16).replace("T", " ");
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await ensureShop(session.shop);

  const logs = await db.notificationLog.findMany({
    where: { shopId: shop.id },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { subscription: true },
  });

  return {
    logs: logs.map((l) => ({
      id: l.id,
      when: formatWhen(l.createdAt),
      product: l.subscription
        ? [l.subscription.productTitle, l.subscription.variantTitle]
            .filter(Boolean)
            .join(" — ")
        : "—",
      email: l.subscription?.email ?? "—",
      status: l.status,
      attempts: l.attempts,
      error: l.error ?? "",
    })),
  };
};

export default function Logs() {
  const { logs } = useLoaderData<typeof loader>();

  return (
    <s-page heading="Send log">
      <s-section heading="Every notification attempt">
        <s-paragraph>
          The proof that notifications actually went out — visible on every plan.
        </s-paragraph>
        {logs.length === 0 ? (
          <s-paragraph>No sends yet.</s-paragraph>
        ) : (
          <s-table>
            <s-table-header-row>
              <s-table-header>Time (UTC)</s-table-header>
              <s-table-header>Product</s-table-header>
              <s-table-header>Customer</s-table-header>
              <s-table-header>Status</s-table-header>
              <s-table-header>Attempts</s-table-header>
            </s-table-header-row>
            <s-table-body>
              {logs.map((l) => (
                <s-table-row key={l.id}>
                  <s-table-cell>{l.when}</s-table-cell>
                  <s-table-cell>{l.product}</s-table-cell>
                  <s-table-cell>{l.email}</s-table-cell>
                  <s-table-cell>
                    <s-badge tone={STATUS_TONE[l.status] ?? "neutral"}>
                      {l.status}
                    </s-badge>
                  </s-table-cell>
                  <s-table-cell>{l.attempts}</s-table-cell>
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
