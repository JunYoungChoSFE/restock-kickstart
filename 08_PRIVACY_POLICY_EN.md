# 08 (EN) — Privacy Policy (English, for App Store listing)

> Public-facing privacy policy for the Pinged app. Host this at the URL you submit as
> "Privacy policy URL" in your App Store listing (e.g. this file on a public GitHub repo).
> ⚠️ Starting draft, not legal advice. Have it reviewed before publishing. Update the operator
> name to a registered business name if you incorporate, and the effective date when you publish.

---

## Pinged Privacy Policy

**Effective date:** June 16, 2026
**Operator:** Junyoung Cho ("Pinged", "we", "us")

Pinged is a back-in-stock notification app for Shopify merchants. It adds a "notify me" button to sold-out products and emails interested customers when those products are restocked. This policy explains what personal data Pinged processes, why, and how.

### 1. Our role

The merchant is the **data controller**; Pinged acts as a **data processor** on the merchant's behalf. We process customer personal data only as needed to send back-in-stock notifications the customer asked for.

### 2. Data we process (minimal collection)

**About a store's customers:**
- Email address — provided directly by the visitor when they click "notify me" on a sold-out product
- The product/variant they asked to be notified about, and the timestamps of the request and notification

> We do **not** collect names, addresses, phone numbers, payment details, or browsing history. Pinged does **not** read your customers' Shopify customer records or order history — it only uses the email a visitor voluntarily submits. Our app permissions are limited to reading products and inventory.

**About merchants:**
- Store domain, access token, and app settings (button text/color, email subject, threshold)

### 3. Purpose and legal basis

- Sending a one-time transactional email to a customer when a product they subscribed to is back in stock
- Showing the merchant which products have waiting customers (demand insight) and a log of notification sends
- Legal basis: the customer's explicit request to be notified, and performance of our service contract with the merchant. We use the data **only for these purposes** and do not send marketing.

### 4. Sharing and sale

- We do **not sell** personal data.
- We do not share personal data with third parties for marketing.
- We use only the **sub-processors** necessary to operate the service:
  - Fly.io — application hosting and database
  - Resend — transactional email delivery
  - Shopify — platform

### 5. Retention and deletion

- We retain a customer's email only as long as needed to deliver the notification they requested.
- When the app is **uninstalled, we completely remove** that merchant's data (subscriptions, send logs, settings). No trace remains; the storefront button is a Theme App Extension, so no injected code is left behind.
- We honor Shopify's GDPR compliance webhooks:
  - `customers/redact`: delete the specified customer's data (we delete by email)
  - `shop/redact`: delete all of the merchant's data
  - `customers/data_request`: respond to data access requests

### 6. Security

- Encryption in transit (HTTPS) and at rest (managed database).
- Least-privilege access (read-only products/inventory scopes), strong authentication, and secure handling of secrets.
- We maintain a security incident response policy.

### 7. Data subject rights

Customers may request access to or deletion of their data through the merchant; we fulfill these via the GDPR webhooks above. We respect rights under applicable laws (e.g., GDPR, CCPA).

### 8. International data transfers

Data may be processed in the region(s) where our hosting provider operates, with safeguards required by applicable law.

### 9. Changes

We may update this policy. We will update the effective date and post changes on this page.

### 10. Contact

Privacy inquiries: **liger4903@gmail.com**

---

_This draft does not constitute legal advice. Review before publishing._
