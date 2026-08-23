/* EliteFinance V2 - Category Update
   Add this file AFTER app.js in index.html.
   It keeps existing transactions and replaces the selectable category list.
*/
(() => {
  "use strict";

  const NEW_CATEGORIES = [
    "🍜 Ăn uống",
    "🛵 Di chuyển",
    "🏠 Nhà ở",
    "💡 Điện nước",
    "🛍 Mua sắm",
    "📚 Học tập",
    "🎬 Giải trí",
    "✈ Du lịch",
    "❤️ Gia đình",
    "🛡 Bảo hiểm",
    "🏡 Phường / Họ",
    "💳 Trả góp",
    "🏦 Trả nợ",
    "📈 Đầu tư",
    "💼 Lương",
    "🎁 Thưởng",
    "📦 Khác"
  ];

  function updateCategories() {
    if (typeof state === "undefined") return false;

    const transactions = Array.isArray(state.transactions) ? state.transactions : [];
    const used = new Set(transactions.map(item => item.category).filter(Boolean));
    const current = Array.isArray(state.categories) ? state.categories : [];

    // Preserve an old category only when an existing transaction still uses it.
    const legacyInUse = current.filter(category =>
      used.has(category) && !NEW_CATEGORIES.includes(category)
    );

    state.categories = [...NEW_CATEGORIES, ...legacyInUse];

    if (typeof save === "function") {
      Promise.resolve(save(true)).catch(error => console.error("Category save failed", error));
    }

    return true;
  }

  function refreshCurrentPage() {
    if (typeof go === "function" && typeof page === "string") {
      go(page);
    } else if (typeof dashboard === "function") {
      dashboard();
    }
  }

  function apply() {
    if (!updateCategories()) {
      setTimeout(apply, 100);
      return;
    }
    refreshCurrentPage();
    console.info("EliteFinance categories updated:", NEW_CATEGORIES);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", apply, { once: true });
  } else {
    apply();
  }
})();
