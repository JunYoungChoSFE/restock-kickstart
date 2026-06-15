// 재입고 알림 이메일 템플릿 — 순수 함수 (테스트 가능). 정직·비스팸 (CLAUDE.md 가드레일).
// 마케팅 발송이 아니라, 고객이 직접 신청한 1건의 트랜잭셔널 알림이다.

export interface RestockEmailInput {
  productTitle: string;
  variantTitle?: string | null;
  storeName: string;
  /** 상품으로 바로 가는 링크(있으면 본문/버튼에 포함). */
  productUrl?: string | null;
  /** 상인이 Setting에서 정한 커스텀 제목(있으면 우선). */
  customSubject?: string | null;
}

export interface BuiltEmail {
  subject: string;
  text: string;
  html: string;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** "Product — Variant" 또는 변형 없으면 "Product". */
function fullTitle(productTitle: string, variantTitle?: string | null): string {
  const v = (variantTitle || "").trim();
  return v ? `${productTitle} — ${v}` : productTitle;
}

export function buildRestockEmail(input: RestockEmailInput): BuiltEmail {
  const title = fullTitle(input.productTitle, input.variantTitle);
  const subject =
    (input.customSubject && input.customSubject.trim()) ||
    `${title} is back in stock`;

  const url = (input.productUrl || "").trim();

  const text =
    `Good news — "${title}" is back in stock at ${input.storeName}.\n\n` +
    (url ? `Get it here: ${url}\n\n` : "") +
    `You're receiving this because you asked to be notified when it returned.\n` +
    `If it sells out again you won't get repeat emails for this request.`;

  const safeTitle = escapeHtml(title);
  const safeStore = escapeHtml(input.storeName);
  const button = url
    ? `<p><a href="${escapeHtml(url)}" style="display:inline-block;padding:10px 18px;background:#000;color:#fff;text-decoration:none;border-radius:6px;">View product</a></p>`
    : "";
  const html =
    `<div style="font-family:system-ui,sans-serif;max-width:480px;">` +
    `<p>Good news — <strong>${safeTitle}</strong> is back in stock at ${safeStore}.</p>` +
    button +
    `<p style="color:#666;font-size:13px;">You're receiving this because you asked to be notified when it returned.</p>` +
    `</div>`;

  return { subject, text, html };
}
