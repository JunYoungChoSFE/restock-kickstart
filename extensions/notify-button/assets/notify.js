/* Pinged — back-in-stock 신청 캡처. 의존성 없는 바닐라 JS. */
(function () {
  function show(el, text) {
    if (!el) return;
    el.textContent = text;
    el.hidden = false;
  }

  document.querySelectorAll("[data-pinged]").forEach(function (root) {
    var proxy = root.getAttribute("data-proxy") || "/apps/pinged";
    var form = root.querySelector("[data-pinged-form]");
    var msg = root.querySelector("[data-pinged-msg]");
    if (!form) return;

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var input = form.querySelector('input[name="email"]');
      var email = (input.value || "").trim();
      if (!email) return;

      // 변형 선택이 URL(?variant=)을 바꾸는 테마면 그 값을 우선 사용.
      var urlVariant = new URLSearchParams(window.location.search).get("variant");
      var body = new URLSearchParams({
        email: email,
        productId: root.getAttribute("data-product-id") || "",
        productTitle: root.getAttribute("data-product-title") || "",
        variantId: urlVariant || root.getAttribute("data-variant-id") || "",
        variantTitle: root.getAttribute("data-variant-title") || "",
      });

      var btn = form.querySelector("button");
      btn.disabled = true;
      fetch(proxy + "/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
      })
        .then(function (r) {
          return r.json().catch(function () {
            return { ok: false };
          });
        })
        .then(function (data) {
          if (data && data.ok) {
            show(msg, "You're on the list — we'll email you the moment it's back.");
            input.value = "";
          } else {
            show(msg, (data && data.error) || "Something went wrong. Please try again.");
          }
        })
        .catch(function () {
          show(msg, "Something went wrong. Please try again.");
        })
        .finally(function () {
          btn.disabled = false;
        });
    });
  });
})();
