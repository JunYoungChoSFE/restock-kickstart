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

  const [waiting, notified, failed, recent] = await Promise.all([
    db.subscription.count({ where: { shopId: shop.id, status: "pending" } }),
    db.subscription.count({ where: { shopId: shop.id, status: "notified" } }),
    db.notificationLog.count({ where: { shopId: shop.id, status: "failed" } }),
    db.notificationLog.findMany({
      where: { shopId: shop.id },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { subscription: true },
    }),
  ]);

  return {
    plan: shop.plan,
    waiting,
    notified,
    failed,
    recent: recent.map((l) => ({
      id: l.id,
      when: formatWhen(l.createdAt),
      product: l.subscription
        ? [l.subscription.productTitle, l.subscription.variantTitle]
            .filter(Boolean)
            .join(" — ")
        : "—",
      email: l.subscription?.email ?? "—",
      status: l.status,
    })),
  };
};

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <s-box padding="base" borderWidth="base" borderRadius="base" background="subdued">
      <s-stack direction="block" gap="small-200">
        <s-text color="subdued">{label}</s-text>
        <s-heading>{value}</s-heading>
      </s-stack>
    </s-box>
  );
}

export default function Dashboard() {
  const { plan, waiting, notified, failed, recent } = useLoaderData<typeof loader>();

  return (
    <s-page heading="Pinged">
      <s-button slot="primary-action" href="/app/settings" variant="primary">
        Settings
      </s-button>

      <s-section heading="Overview">
        <s-grid gridTemplateColumns="1fr 1fr 1fr" gap="base">
          <StatCard label="Waiting (subscribed)" value={waiting.toLocaleString()} />
          <StatCard label="Notified" value={notified.toLocaleString()} />
          <StatCard label="Failed sends" value={failed.toLocaleString()} />
        </s-grid>
      </s-section>

      <s-section heading="Recent sends">
        {recent.length === 0 ? (
          <s-paragraph>
            No notifications yet. When a subscribed product comes back in stock,
            sends will appear here.
          </s-paragraph>
        ) : (
          <s-table>
            <s-table-header-row>
              <s-table-header>Time (UTC)</s-table-header>
              <s-table-header>Product</s-table-header>
              <s-table-header>Customer</s-table-header>
              <s-table-header>Status</s-table-header>
            </s-table-header-row>
            <s-table-body>
              {recent.map((l) => (
                <s-table-row key={l.id}>
                  <s-table-cell>{l.when}</s-table-cell>
                  <s-table-cell>{l.product}</s-table-cell>
                  <s-table-cell>{l.email}</s-table-cell>
                  <s-table-cell>
                    <s-badge tone={STATUS_TONE[l.status] ?? "neutral"}>
                      {l.status}
                    </s-badge>
                  </s-table-cell>
                </s-table-row>
              ))}
            </s-table-body>
          </s-table>
        )}
      </s-section>

      <s-section slot="aside" heading="Plan">
        <s-stack direction="block" gap="small">
          <s-badge tone={plan === "pro" ? "success" : "neutral"}>
            {plan === "pro" ? "Pro" : "Free"}
          </s-badge>
          <s-paragraph>One honest flat price. No per-notification fees.</s-paragraph>
        </s-stack>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
