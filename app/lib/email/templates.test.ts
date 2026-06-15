import { describe, it, expect } from "vitest";
import { buildRestockEmail } from "./templates";

const base = {
  productTitle: "Linen Shirt",
  variantTitle: "Medium / Blue",
  storeName: "Acme",
  productUrl: "https://acme.example/products/linen-shirt",
};

describe("buildRestockEmail", () => {
  it("기본 제목 = '<상품 — 변형> is back in stock'", () => {
    expect(buildRestockEmail(base).subject).toBe(
      "Linen Shirt — Medium / Blue is back in stock",
    );
  });

  it("변형이 없으면 상품명만", () => {
    expect(
      buildRestockEmail({ ...base, variantTitle: null }).subject,
    ).toBe("Linen Shirt is back in stock");
  });

  it("커스텀 제목이 있으면 우선", () => {
    expect(
      buildRestockEmail({ ...base, customSubject: "It's back!" }).subject,
    ).toBe("It's back!");
  });

  it("빈/공백 커스텀 제목은 무시하고 기본값", () => {
    expect(buildRestockEmail({ ...base, customSubject: "   " }).subject).toBe(
      "Linen Shirt — Medium / Blue is back in stock",
    );
  });

  it("productUrl이 있으면 text·html에 링크 포함", () => {
    const e = buildRestockEmail(base);
    expect(e.text).toContain(base.productUrl);
    expect(e.html).toContain(base.productUrl);
    expect(e.html).toContain("View product");
  });

  it("productUrl이 없으면 링크/버튼 없음", () => {
    const e = buildRestockEmail({ ...base, productUrl: null });
    expect(e.text).not.toContain("Get it here");
    expect(e.html).not.toContain("View product");
  });

  it("HTML 특수문자를 이스케이프 (XSS 방지)", () => {
    const e = buildRestockEmail({
      ...base,
      productTitle: `Shirt <script>"&'`,
      variantTitle: null,
    });
    expect(e.html).not.toContain("<script>");
    expect(e.html).toContain("&lt;script&gt;");
  });
});
