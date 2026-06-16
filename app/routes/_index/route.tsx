import type { LoaderFunctionArgs } from "react-router";
import { redirect, Form, useLoaderData } from "react-router";

import { login } from "../../shopify.server";

import styles from "./styles.module.css";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);

  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }

  return { showForm: Boolean(login) };
};

export default function App() {
  const { showForm } = useLoaderData<typeof loader>();

  return (
    <div className={styles.index}>
      <div className={styles.content}>
        <h1 className={styles.heading}>Pinged — Reliable Back-in-Stock Alerts</h1>
        <p className={styles.text}>
          Add a "Notify me" button to sold-out products and send the alert the
          moment they're back — within seconds, with a send log so you know it
          actually went out. One flat price, no per-notification fees.
        </p>
        {showForm && (
          <Form className={styles.form} method="post" action="/auth/login">
            <label className={styles.label}>
              <span>Shop domain</span>
              <input className={styles.input} type="text" name="shop" />
              <span>e.g: my-shop-domain.myshopify.com</span>
            </label>
            <button className={styles.button} type="submit">
              Log in
            </button>
          </Form>
        )}
        <ul className={styles.list}>
          <li>
            <strong>Instant alerts</strong>. The moment stock returns, subscribers
            are notified — seconds, not a 30-minute batch.
          </li>
          <li>
            <strong>Send log you can trust</strong>. Every notification attempt is
            logged with status, so you can prove it went out.
          </li>
          <li>
            <strong>No wrong sends</strong>. Only for published, in-stock products —
            never draft or hidden ones. One flat price, no per-alert fees.
          </li>
        </ul>
      </div>
    </div>
  );
}
