import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { Form, useActionData, useLoaderData, useNavigation } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { ensureShop } from "../models/shop.server";
import { updateSettings } from "../models/settings.server";

function num(form: FormData, key: string, fallback = 0): number {
  const n = Number(form.get(key));
  return Number.isFinite(n) ? n : fallback;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await ensureShop(session.shop);
  return { setting: shop.setting! };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await ensureShop(session.shop);
  const form = await request.formData();
  const intent = form.get("_action");

  if (intent === "saveButton") {
    await updateSettings(shop.id, {
      buttonText: String(form.get("buttonText") || "").trim() || "Notify me when available",
      buttonColor: String(form.get("buttonColor") || "#000000").trim(),
    });
    return { ok: "Button saved." };
  }

  if (intent === "saveEmail") {
    await updateSettings(shop.id, {
      emailSubject:
        String(form.get("emailSubject") || "").trim() ||
        "Good news — it's back in stock!",
      threshold: Math.max(1, Math.floor(num(form, "threshold", 1))),
      emailEnabled: form.has("emailEnabled"),
    });
    return { ok: "Email settings saved." };
  }

  return { error: "Unknown request." };
};

export default function Settings() {
  const { setting } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const nav = useNavigation();
  const saving = nav.state === "submitting";

  return (
    <s-page heading="Settings">
      {actionData && "ok" in actionData && actionData.ok && (
        <s-banner tone="success" heading={actionData.ok} />
      )}
      {actionData && "error" in actionData && actionData.error && (
        <s-banner tone="critical" heading={actionData.error} />
      )}

      <s-section heading="Notify button">
        <Form method="post">
          <input type="hidden" name="_action" value="saveButton" />
          <s-stack direction="block" gap="base">
            <s-text-field
              name="buttonText"
              label="Button text"
              value={setting.buttonText}
              placeholder="Notify me when available"
            />
            <s-text-field
              name="buttonColor"
              label="Button color (HEX)"
              value={setting.buttonColor}
              placeholder="#000000"
              details="Shown on sold-out product pages in your brand color — no custom CSS."
            />
            <s-button type="submit" variant="primary" {...(saving ? { loading: true } : {})}>
              Save
            </s-button>
          </s-stack>
        </Form>
      </s-section>

      <s-section heading="Notifications">
        <Form method="post">
          <input type="hidden" name="_action" value="saveEmail" />
          <s-stack direction="block" gap="base">
            <s-text-field
              name="emailSubject"
              label="Email subject"
              value={setting.emailSubject}
              details="Leave as-is for a sensible default."
            />
            <s-number-field
              name="threshold"
              label="Notify when stock reaches at least"
              value={String(setting.threshold)}
              min={1}
              step={1}
              suffix="units"
              details="Avoids notifying on a 1-unit restock that sells out instantly."
            />
            <s-checkbox
              name="emailEnabled"
              label="Send email notifications when items come back in stock"
              {...(setting.emailEnabled ? { checked: true } : {})}
            />
            <s-button type="submit" variant="primary" {...(saving ? { loading: true } : {})}>
              Save
            </s-button>
          </s-stack>
        </Form>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
