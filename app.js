"use strict";

const DB_NAME = "eliteFinanceV2";
const STORE_NAME = "state";
const STATE_KEY = "main";

const DEFAULT_STATE = {
  version: "2.0-categories",
  theme: "light",
  currency: "VND",
  profile: { name: "Elite" },
  accounts: [
    { id: "cash", name: "Tiền mặt", type: "cash", opening: 0 },
    { id: "bank", name: "Ngân hàng", type: "bank", opening: 0 }
  ],
  transactions: [],
  budgets: [],
  goals: [],
  categories: [
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
  ]
};

let state = JSON.parse(JSON.stringify(DEFAULT_STATE));
let currentPage = "dashboard";
let selectedMonth = new Date().toISOString().slice(0, 7);

const $ = id => document.getElementById(id);
const uid = () => crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`;
const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[char]));
const money = value => new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: state.currency || "VND",
  maximumFractionDigits: 0
}).format(Number(value) || 0);

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function loadState() {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE_NAME).objectStore(STORE_NAME).get(STATE_KEY);
    request.onsuccess = () => resolve(request.result || JSON.parse(JSON.stringify(DEFAULT_STATE)));
    request.onerror = () => reject(request.error);
  });
}

async function saveState() {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).put(state, STATE_KEY);
    request.onsuccess = resolve;
    request.onerror = () => reject(request.error);
  });
}

function migrateCategories() {
  const mandatory = [...DEFAULT_STATE.categories];
  const old = Array.isArray(state.categories) ? state.categories : [];
  const used = new Set((state.transactions || []).map(item => item.category).filter(Boolean));
  const oldStillUsed = old.filter(category => used.has(category) && !mandatory.includes(category));
  state.categories = [...mandatory, ...oldStillUsed];
}

function toast(message) {
  const node = $("toast");
  if (!node) return;
  node.textContent = message;
  node.classList.add("show");
  setTimeout(() => node.classList.remove("show"), 1800);
}

function categoryIcon(category) {
  const match = String(category || "").match(/^[^\p{L}\p{N}\s]+/u);
  return match ? match[0].trim() : "•";
}

function monthTransactions(month = selectedMonth) {
  return state.transactions.filter(item => item.date?.slice(0, 7) === month);
}

function totals(items = monthTransactions()) {
  const income = items.filter(item => item.type === "income").reduce((sum, item) => sum + Number(item.amount), 0);
  const expense = items.filter(item => item.type === "expense").reduce((sum, item) => sum + Number(item.amount), 0);
  return { income, expense, saving: income - expense, rate: income ? Math.round((income - expense) / income * 100) : 0 };
}

function accountBalance(id) {
  const account = state.accounts.find(item => item.id === id);
  return Number(account?.opening || 0) + state.transactions.reduce((sum, item) => {
    if (item.accountId !== id) return sum;
    return sum + (item.type === "income" ? Number(item.amount) : -Number(item.amount));
  }, 0);
}

const NAV = [
  ["dashboard", "⌂", "Dashboard"],
  ["transactions", "↔", "Giao dịch"],
  ["accounts", "▣", "Tài khoản"],
  ["budgets", "◎", "Ngân sách"],
  ["goals", "★", "Mục tiêu"],
  ["reports", "▥", "Báo cáo"],
  ["settings", "⚙", "Cài đặt"]
];

function buildNavigation() {
  const nav = $("nav");
  if (!nav) return;
  nav.innerHTML = "";
  NAV.forEach(([id, icon, label]) => {
    const button = document.createElement("button");
    button.dataset.page = id;
    button.textContent = `${icon}  ${label}`;
    button.onclick = () => go(id);
    nav.appendChild(button);
  });
}

function go(id) {
  currentPage = id;
  document.querySelectorAll(".page").forEach(page => page.classList.toggle("hidden", page.id !== id));
  document.querySelectorAll("nav button").forEach(button => button.classList.toggle("active", button.dataset.page === id));
  if ($("pageTitle")) $("pageTitle").textContent = NAV.find(item => item[0] === id)?.[2] || id;
  const renderers = {
    dashboard: renderDashboard,
    transactions: renderTransactions,
    accounts: renderAccounts,
    budgets: renderBudgets,
    goals: renderGoals,
    reports: renderReports,
    settings: renderSettings
  };
  renderers[id]?.();
  document.body.classList.remove("menu");
}

function transactionRow(item) {
  return `<div class="tx" data-transaction="${item.id}">
    <div class="tx-icon">${categoryIcon(item.category)}</div>
    <div><b>${esc(item.note || item.category)}</b><small>${esc(item.category)} · ${esc(state.accounts.find(account => account.id === item.accountId)?.name || "")} · ${esc(item.date)}</small></div>
    <div class="money ${item.type === "income" ? "green" : "red"}">${item.type === "income" ? "+" : "-"}${money(item.amount)}</div>
    <div class="tx-actions"><button data-action="edit" data-id="${item.id}">✎ Sửa</button><button data-action="delete" data-id="${item.id}">✕ Xóa</button></div>
  </div>`;
}

function categoryTotals() {
  const map = {};
  monthTransactions().filter(item => item.type === "expense").forEach(item => {
    map[item.category] = (map[item.category] || 0) + Number(item.amount);
  });
  return Object.entries(map).map(([category, value]) => ({ category, value })).sort((a, b) => b.value - a.value);
}

function renderDashboard() {
  const summary = totals();
  const recent = [...monthTransactions()].sort((a, b) => `${b.date}${b.createdAt || ""}`.localeCompare(`${a.date}${a.createdAt || ""}`)).slice(0, 6);
  const categories = categoryTotals();
  const maximum = Math.max(1, ...categories.map(item => item.value));
  $("dashboard").innerHTML = `<div class="hero"><div><div class="eyebrow">TỔNG QUAN TÀI CHÍNH</div><h2>${new Date(`${selectedMonth}-01T00:00:00`).toLocaleDateString("vi-VN", { month: "long", year: "numeric" })}</h2><p>Theo dõi thu, chi, tiết kiệm và mục tiêu.</p><div class="month-select"><input id="monthPick" type="month" value="${selectedMonth}"><button class="btn" data-nav="transactions">Xem giao dịch</button></div></div><div class="progress-ring" style="--angle:${Math.max(0, Math.min(100, summary.rate)) * 3.6}deg"><div><b>${summary.rate}%</b><small>Tỷ lệ tiết kiệm</small></div></div></div>
  <div class="grid"><div class="card kpi"><div class="icon green">↗</div><small>Tổng thu</small><div class="amount green">${money(summary.income)}</div></div><div class="card kpi"><div class="icon red">↘</div><small>Tổng chi</small><div class="amount red">${money(summary.expense)}</div></div><div class="card kpi"><div class="icon blue">◆</div><small>Tiết kiệm</small><div class="amount blue">${money(summary.saving)}</div></div><div class="card kpi"><div class="icon amber">▣</div><small>Tổng số dư</small><div class="amount amber">${money(state.accounts.reduce((sum, account) => sum + accountBalance(account.id), 0))}</div></div></div>
  <div class="grid2"><div class="card"><div class="head"><h2>Giao dịch gần đây</h2></div><div class="list">${recent.length ? recent.map(transactionRow).join("") : '<div class="empty">Chưa có giao dịch.</div>'}</div></div><div class="card"><div class="head"><h2>Chi theo danh mục</h2></div>${categories.length ? categories.slice(0, 7).map(item => `<div class="bar-row"><div class="bar-row-top"><span>${categoryIcon(item.category)} ${esc(item.category)}</span><b>${money(item.value)}</b></div><div class="bar"><span style="width:${item.value / maximum * 100}%"></span></div></div>`).join("") : '<div class="empty">Chưa có dữ liệu chi.</div>'}</div></div>`;
  $("monthPick").onchange = event => { selectedMonth = event.target.value; renderDashboard(); };
  $("dashboard").querySelector("[data-nav]")?.addEventListener("click", event => go(event.currentTarget.dataset.nav));
}

function renderTransactions() {
  const list = [...monthTransactions()].sort((a, b) => `${b.date}${b.createdAt || ""}`.localeCompare(`${a.date}${a.createdAt || ""}`));
  $("transactions").innerHTML = `<div class="card"><div class="head"><div><div class="eyebrow">SỔ THU CHI</div><h2>Giao dịch</h2></div><button class="primary" id="addTransaction">＋ Thêm</button></div><div class="filters"><input id="filterMonth" type="month" value="${selectedMonth}"><select id="filterType"><option value="all">Tất cả loại</option><option value="expense">Khoản chi</option><option value="income">Khoản thu</option></select><select id="filterCategory"><option value="all">Tất cả danh mục</option>${state.categories.map(category => `<option>${esc(category)}</option>`).join("")}</select><input id="filterSearch" placeholder="Tìm ghi chú..."></div><div id="transactionList" class="list">${list.length ? list.map(transactionRow).join("") : '<div class="empty">Chưa có giao dịch.</div>'}</div></div>`;
  $("addTransaction").onclick = () => openTransaction();
  const filter = () => {
    const month = $("filterMonth").value;
    const type = $("filterType").value;
    const category = $("filterCategory").value;
    const query = $("filterSearch").value.toLowerCase();
    const filtered = state.transactions.filter(item => item.date.slice(0, 7) === month && (type === "all" || item.type === type) && (category === "all" || item.category === category) && `${item.note || ""} ${item.category}`.toLowerCase().includes(query));
    $("transactionList").innerHTML = filtered.length ? filtered.map(transactionRow).join("") : '<div class="empty">Không có kết quả.</div>';
  };
  ["filterMonth", "filterType", "filterCategory", "filterSearch"].forEach(id => $(id).oninput = filter);
}

function openTransaction(id) {
  const item = state.transactions.find(transaction => transaction.id === id) || { type: "expense", date: new Date().toISOString().slice(0, 10), amount: "", category: state.categories[0], accountId: state.accounts[0]?.id || "", note: "" };
  showModal(id ? "SỬA GIAO DỊCH" : "GIAO DỊCH MỚI", id ? "Cập nhật giao dịch" : "Thêm giao dịch", `<form id="transactionForm" class="form-grid"><label>Loại<select name="type"><option value="expense" ${item.type === "expense" ? "selected" : ""}>Khoản chi</option><option value="income" ${item.type === "income" ? "selected" : ""}>Khoản thu</option></select></label><label>Ngày<input name="date" type="date" value="${item.date}" required></label><label>Số tiền<input name="amount" type="number" inputmode="numeric" min="0" step="1000" value="${item.amount}" required></label><label>Danh mục<select name="category">${state.categories.map(category => `<option ${category === item.category ? "selected" : ""}>${esc(category)}</option>`).join("")}</select></label><label>Tài khoản<select name="accountId">${state.accounts.map(account => `<option value="${account.id}" ${account.id === item.accountId ? "selected" : ""}>${esc(account.name)}</option>`).join("")}</select></label><label class="wide">Ghi chú<input name="note" value="${esc(item.note || "")}"></label><button class="primary wide">${id ? "Lưu thay đổi" : "Thêm giao dịch"}</button></form>`);
  $("transactionForm").onsubmit = async event => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.target));
    const updated = { ...item, ...data, amount: Number(data.amount), id: id || uid(), createdAt: item.createdAt || new Date().toISOString() };
    state.transactions = id ? state.transactions.map(transaction => transaction.id === id ? updated : transaction) : [...state.transactions, updated];
    await saveState(); closeModal(); go(currentPage); toast(id ? "Đã sửa giao dịch" : "Đã thêm giao dịch");
  };
}

async function deleteTransaction(id) {
  const item = state.transactions.find(transaction => transaction.id === id);
  if (!item) return;
  showModal("XÁC NHẬN", "Xóa giao dịch?", `<p><b>${esc(item.note || item.category)}</b></p><p class="red">${money(item.amount)}</p><div class="actions"><button class="btn" id="cancelDelete">Hủy</button><button class="danger" id="confirmDelete">Xóa</button></div>`);
  $("cancelDelete").onclick = closeModal;
  $("confirmDelete").onclick = async () => { state.transactions = state.transactions.filter(transaction => transaction.id !== id); await saveState(); closeModal(); go(currentPage); toast("Đã xóa giao dịch"); };
}

function renderAccounts() {
  $("accounts").innerHTML = `<div class="head"><div><div class="eyebrow">VÍ & NGÂN HÀNG</div><h2>Tài khoản</h2></div><button class="primary" id="addAccount">＋ Thêm</button></div><div class="account-grid">${state.accounts.map(account => `<div class="account-card"><span class="badge">${account.type === "cash" ? "Tiền mặt" : account.type === "ewallet" ? "Ví điện tử" : "Ngân hàng"}</span><h3>${esc(account.name)}</h3><div class="balance">${money(accountBalance(account.id))}</div><small>Số dư đầu kỳ: ${money(account.opening)}</small><div class="actions"><button class="btn" data-account-edit="${account.id}">Sửa</button></div></div>`).join("")}</div>`;
  $("addAccount").onclick = () => openAccount();
  document.querySelectorAll("[data-account-edit]").forEach(button => button.onclick = () => openAccount(button.dataset.accountEdit));
}

function openAccount(id) {
  const account = state.accounts.find(item => item.id === id) || { name: "", type: "bank", opening: 0 };
  showModal("TÀI KHOẢN", id ? "Sửa tài khoản" : "Thêm tài khoản", `<form id="accountForm" class="form-grid"><label>Tên<input name="name" value="${esc(account.name)}" required></label><label>Loại<select name="type"><option value="cash" ${account.type === "cash" ? "selected" : ""}>Tiền mặt</option><option value="bank" ${account.type === "bank" ? "selected" : ""}>Ngân hàng</option><option value="ewallet" ${account.type === "ewallet" ? "selected" : ""}>Ví điện tử</option></select></label><label class="wide">Số dư đầu kỳ<input name="opening" type="number" value="${account.opening}"></label><button class="primary wide">Lưu</button></form>`);
  $("accountForm").onsubmit = async event => { event.preventDefault(); const data = Object.fromEntries(new FormData(event.target)); const updated = { ...account, ...data, opening: Number(data.opening), id: id || uid() }; state.accounts = id ? state.accounts.map(item => item.id === id ? updated : item) : [...state.accounts, updated]; await saveState(); closeModal(); renderAccounts(); };
}

function renderBudgets() {
  $("budgets").innerHTML = `<div class="head"><div><div class="eyebrow">KIỂM SOÁT CHI</div><h2>Ngân sách</h2></div><button class="primary" id="addBudget">＋ Tạo</button></div><div class="budget-grid">${state.budgets.length ? state.budgets.map(budget => { const spent = monthTransactions().filter(item => item.type === "expense" && item.category === budget.category).reduce((sum, item) => sum + Number(item.amount), 0); const percent = Math.min(100, Math.round(spent / Math.max(1, budget.limit) * 100)); return `<div class="budget-card"><h3>${esc(budget.category)}</h3><b>${money(spent)} / ${money(budget.limit)}</b><div class="bar"><span style="width:${percent}%"></span></div><small>${percent}% đã dùng</small></div>`; }).join("") : '<div class="card empty">Chưa có ngân sách.</div>'}</div>`;
  $("addBudget").onclick = () => { showModal("NGÂN SÁCH", "Tạo ngân sách", `<form id="budgetForm" class="form-grid"><label>Danh mục<select name="category">${state.categories.map(category => `<option>${esc(category)}</option>`).join("")}</select></label><label>Giới hạn<input name="limit" type="number" required></label><button class="primary wide">Lưu</button></form>`); $("budgetForm").onsubmit = async event => { event.preventDefault(); const data = Object.fromEntries(new FormData(event.target)); state.budgets.push({ id: uid(), category: data.category, limit: Number(data.limit) }); await saveState(); closeModal(); renderBudgets(); }; };
}

function renderGoals() {
  $("goals").innerHTML = `<div class="head"><div><div class="eyebrow">MỤC TIÊU TÀI CHÍNH</div><h2>Mục tiêu</h2></div><button class="primary" id="addGoal">＋ Thêm</button></div><div class="goal-grid">${state.goals.length ? state.goals.map(goal => `<div class="goal-card"><h3>${esc(goal.name)}</h3><div class="balance">${money(goal.saved)}</div><small>Mục tiêu ${money(goal.target)}</small><div class="bar"><span style="width:${Math.min(100, goal.saved / Math.max(1, goal.target) * 100)}%"></span></div></div>`).join("") : '<div class="card empty">Chưa có mục tiêu.</div>'}</div>`;
  $("addGoal").onclick = () => { showModal("MỤC TIÊU", "Thêm mục tiêu", `<form id="goalForm" class="form-grid"><label>Tên<input name="name" required></label><label>Mục tiêu<input name="target" type="number" required></label><label>Đã có<input name="saved" type="number" value="0"></label><label>Ngày dự kiến<input name="deadline" type="date"></label><button class="primary wide">Lưu</button></form>`); $("goalForm").onsubmit = async event => { event.preventDefault(); const data = Object.fromEntries(new FormData(event.target)); state.goals.push({ ...data, id: uid(), target: Number(data.target), saved: Number(data.saved) }); await saveState(); closeModal(); renderGoals(); }; };
}

function renderReports() {
  const months = [...new Set(state.transactions.map(item => item.date.slice(0, 7)))].sort().reverse();
  $("reports").innerHTML = `<div class="card"><div class="head"><h2>Báo cáo theo tháng</h2><button class="btn" id="exportCsv">Xuất CSV</button></div>${months.length ? `<table class="summary-table"><thead><tr><th>Tháng</th><th>Thu</th><th>Chi</th><th>Tiết kiệm</th></tr></thead><tbody>${months.map(month => { const item = totals(monthTransactions(month)); return `<tr><td>${month}</td><td>${money(item.income)}</td><td>${money(item.expense)}</td><td>${money(item.saving)}</td></tr>`; }).join("")}</tbody></table>` : '<div class="empty">Chưa có dữ liệu.</div>'}</div>`;
  $("exportCsv").onclick = exportCSV;
}

function renderSettings() {
  $("settings").innerHTML = `<div class="grid2"><div class="card"><h2>Giao diện & tiền tệ</h2><form id="settingsForm" class="form-grid"><label>Tên<input name="name" value="${esc(state.profile.name)}"></label><label>Tiền tệ<select name="currency"><option value="VND">VND</option><option value="USD">USD</option><option value="CNY">CNY</option></select></label><button class="primary wide">Lưu</button></form></div><div class="card"><h2>Sao lưu</h2><div class="actions"><button class="primary" id="exportJson">Xuất JSON</button><label class="btn">Nhập JSON<input hidden id="importJson" type="file" accept=".json"></label></div></div></div>`;
  $("settingsForm").currency.value = state.currency;
  $("settingsForm").onsubmit = async event => { event.preventDefault(); const data = Object.fromEntries(new FormData(event.target)); state.profile.name = data.name || "Elite"; state.currency = data.currency; await saveState(); toast("Đã lưu cài đặt"); };
  $("exportJson").onclick = exportJSON;
  $("importJson").onchange = importJSON;
}

function exportJSON() { download(`EliteFinance-Backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify({ app: "EliteFinance", version: "2.0", data: state }, null, 2), "application/json"); }
function exportCSV() { const header = "date,type,amount,category,account,note\n"; const rows = state.transactions.map(item => [item.date, item.type, item.amount, item.category, state.accounts.find(account => account.id === item.accountId)?.name || "", item.note || ""].map(value => `"${String(value).replace(/"/g, '""')}"`).join(",")).join("\n"); download("EliteFinance-Transactions.csv", `\ufeff${header}${rows}`, "text/csv"); }
function download(name, text, type) { const anchor = document.createElement("a"); anchor.href = URL.createObjectURL(new Blob([text], { type })); anchor.download = name; anchor.click(); setTimeout(() => URL.revokeObjectURL(anchor.href), 1000); }
function importJSON(event) { const file = event.target.files[0]; if (!file) return; const reader = new FileReader(); reader.onload = async () => { try { const parsed = JSON.parse(reader.result); const incoming = parsed.data || parsed; if (!Array.isArray(incoming.transactions) || !Array.isArray(incoming.accounts)) throw Error(); state = { ...JSON.parse(JSON.stringify(DEFAULT_STATE)), ...incoming }; migrateCategories(); await saveState(); go("dashboard"); toast("Đã nhập dữ liệu"); } catch { toast("JSON không hợp lệ"); } event.target.value = ""; }; reader.readAsText(file, "UTF-8"); }

function showModal(eyebrow, title, body) { const eyebrowNode = $("modalEyebrow") || $("modalKind"); if (eyebrowNode) eyebrowNode.textContent = eyebrow; $("modalTitle").textContent = title; $("modalBody").innerHTML = body; $("modal").classList.remove("hidden"); }
function closeModal() { $("modal").classList.add("hidden"); $("modalBody").innerHTML = ""; }

async function init() {
  try { state = { ...JSON.parse(JSON.stringify(DEFAULT_STATE)), ...(await loadState()) }; migrateCategories(); await saveState(); } catch (error) { console.error(error); toast("Không mở được dữ liệu"); }
  document.body.className = state.theme || "light";
  buildNavigation();
  document.addEventListener("click", event => {
    const edit = event.target.closest("[data-action='edit']");
    const remove = event.target.closest("[data-action='delete']");
    if (edit) openTransaction(edit.dataset.id);
    if (remove) deleteTransaction(remove.dataset.id);
  });
  if ($("menuBtn")) $("menuBtn").onclick = () => document.body.classList.toggle("menu");
  if ($("quickAdd")) $("quickAdd").onclick = () => openTransaction();
  if ($("headerAdd")) $("headerAdd").onclick = () => openTransaction();
  if ($("fab")) $("fab").onclick = () => openTransaction();
  if ($("closeModal")) $("closeModal").onclick = closeModal;
  if ($("themeBtn")) $("themeBtn").onclick = async () => { state.theme = state.theme === "dark" ? "light" : "dark"; document.body.className = state.theme; await saveState(); };
  go("dashboard");
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) navigator.serviceWorker.register("service-worker.js").catch(() => {});
}

init();
