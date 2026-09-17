const state = {
  branch: null,
  data: null,
  stock: {},     // "catIdx-itemIdx" -> current stock count
  toOrder: {},   // "catIdx-itemIdx" -> qty to order
  completed: {}  // catIdx -> true
};

const STORAGE_KEY = "mojos_order_draft_v2";

function $(sel, el = document) { return el.querySelector(sel); }
function $all(sel, el = document) { return [...el.querySelectorAll(sel)]; }

function showScreen(id) {
  $all(".screen").forEach(s => s.classList.remove("active"));
  $("#" + id).classList.add("active");
  window.scrollTo(0, 0);
}

function saveDraft() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    branch: state.branch ? state.branch.id : null,
    stock: state.stock,
    toOrder: state.toOrder,
    completed: state.completed
  }));
}

function loadDraft() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const draft = JSON.parse(raw);
    if (draft.stock) state.stock = draft.stock;
    if (draft.toOrder) state.toOrder = draft.toOrder;
    if (draft.completed) state.completed = draft.completed;
    if (draft.branch) {
      const b = CONFIG.branches.find(b => b.id === draft.branch);
      if (b) state.branch = b;
    }
  } catch (e) { /* ignore corrupt draft */ }
}

function itemKey(catIdx, itemIdx) { return catIdx + "-" + itemIdx; }

function totalItemsSelected() {
  return Object.values(state.toOrder).filter(v => v > 0).length;
}

function totalEstimatedCost() {
  let total = 0;
  state.data.categories.forEach((cat, ci) => {
    cat.items.forEach((item, ii) => {
      const key = itemKey(ci, ii);
      const qty = state.toOrder[key] || 0;
      total += qty * (item.price || 0);
    });
  });
  return total;
}

function formatMoney(n) {
  return "฿" + Math.round(n).toLocaleString();
}

function renderBranchScreen() {
  const grid = $("#branchGrid");
  grid.innerHTML = "";
  CONFIG.branches.forEach(b => {
    const btn = document.createElement("button");
    btn.className = "branch-btn";
    btn.textContent = b.name;
    btn.addEventListener("click", () => {
      state.branch = b;
      saveDraft();
      renderOrderScreen();
      showScreen("orderScreen");
    });
    grid.appendChild(btn);
  });
}

function renderOrderScreen() {
  $("#branchTag").textContent = state.branch.name + " branch";
  const content = $("#orderContent");
  content.innerHTML = "";

  state.data.categories.forEach((cat, ci) => {
    const catEl = document.createElement("div");
    catEl.className = "category";
    catEl.dataset.catIdx = ci;
    if (state.completed[ci]) catEl.classList.add("completed");

    const header = document.createElement("button");
    header.className = "category-header";
    header.innerHTML = `<span><span class="check">&#10003;</span>${cat.name} <span class="meta">(${cat.items.length})</span></span><span class="chev">&#9662;</span>`;
    header.addEventListener("click", () => {
      catEl.classList.toggle("open");
    });

    const body = document.createElement("div");
    body.className = "category-body";

    cat.items.forEach((item, ii) => {
      const key = itemKey(ci, ii);
      const par = item.par || 0;
      const row = document.createElement("div");
      row.className = "item-row";
      row.dataset.key = key;

      row.innerHTML = `
        <div class="item-name">${item.name}</div>
        <div class="item-sub">${item.unit} &middot; ${item.price ? "฿" + item.price : ""}</div>
        <div class="fields-row">
          <div class="field par">
            <label>Par</label>
            <div class="par-value">${par}</div>
          </div>
          <div class="field stock">
            <label>Stock</label>
            <input type="number" inputmode="numeric" min="0" class="stock-input" value="${state.stock[key] ?? ""}" placeholder="0">
          </div>
          <div class="field order">
            <label>To Order</label>
            <div class="stepper">
              <button type="button" class="dec" aria-label="decrease">&minus;</button>
              <input type="number" inputmode="numeric" min="0" class="order-input" value="${state.toOrder[key] || 0}">
              <button type="button" class="inc" aria-label="increase">&plus;</button>
            </div>
          </div>
        </div>
      `;

      const stockInput = $(".stock-input", row);
      const orderInput = $(".order-input", row);
      const dec = $(".dec", row);
      const inc = $(".inc", row);

      function setOrder(v, { fromCalc = false } = {}) {
        v = Math.max(0, Math.floor(Number(v) || 0));
        orderInput.value = v;
        if (v > 0) { state.toOrder[key] = v; row.classList.add("has-qty"); }
        else { delete state.toOrder[key]; row.classList.remove("has-qty"); }
        saveDraft();
        updateBottomBar();
      }

      function setStock(v) {
        v = v === "" ? "" : Math.max(0, Math.floor(Number(v) || 0));
        if (v === "") delete state.stock[key];
        else state.stock[key] = v;
        saveDraft();
        // auto-suggest to-order from par minus stock
        const suggested = Math.max(par - (v === "" ? 0 : v), 0);
        setOrder(suggested, { fromCalc: true });
      }

      stockInput.addEventListener("change", () => setStock(stockInput.value));
      dec.addEventListener("click", () => setOrder((Number(orderInput.value) || 0) - 1));
      inc.addEventListener("click", () => setOrder((Number(orderInput.value) || 0) + 1));
      orderInput.addEventListener("change", () => setOrder(orderInput.value));

      if (state.toOrder[key] > 0) row.classList.add("has-qty");
      body.appendChild(row);
    });

    const completeBtn = document.createElement("button");
    completeBtn.className = "complete-btn";
    completeBtn.textContent = state.completed[ci] ? "Category Completed ✓" : "Mark Category Complete";
    completeBtn.addEventListener("click", () => {
      state.completed[ci] = !state.completed[ci];
      catEl.classList.toggle("completed", !!state.completed[ci]);
      completeBtn.textContent = state.completed[ci] ? "Category Completed ✓" : "Mark Category Complete";
      saveDraft();
      updateIncompleteWarning();
    });
    body.appendChild(completeBtn);

    catEl.appendChild(header);
    catEl.appendChild(body);
    content.appendChild(catEl);
  });

  updateBottomBar();
}

function updateBottomBar() {
  const n = totalItemsSelected();
  $("#selectedCount").textContent = n;
  $("#estTotal").textContent = formatMoney(totalEstimatedCost());
  $("#reviewBtn").disabled = n === 0;
  updateIncompleteWarning();
}

function updateIncompleteWarning() {
  const total = state.data.categories.length;
  const incomplete = state.data.categories.filter((_, ci) => !state.completed[ci]);
  const warning = $("#incompleteWarning");
  if (incomplete.length === 0) {
    warning.classList.add("hidden");
    document.body.classList.remove("has-warning");
    return;
  }
  const names = incomplete.map(c => c.name).join(", ");
  $("#incompleteText").textContent =
    incomplete.length === total
      ? `No categories marked complete yet (${total} remaining).`
      : `${incomplete.length} of ${total} categories not marked complete: ${names}`;
  warning.classList.remove("hidden");
  document.body.classList.add("has-warning");
}

function filterItems(query) {
  const q = query.trim().toLowerCase();
  $all(".category").forEach(catEl => {
    let anyVisible = false;
    $all(".item-row", catEl).forEach(row => {
      const name = $(".item-name", row).textContent.toLowerCase();
      const match = !q || name.includes(q);
      row.style.display = match ? "" : "none";
      if (match) anyVisible = true;
    });
    catEl.style.display = anyVisible ? "" : "none";
    if (q && anyVisible) catEl.classList.add("open");
  });
}

function renderReviewScreen() {
  const list = $("#reviewList");
  list.innerHTML = "";
  const n = totalItemsSelected();

  if (n === 0) {
    list.innerHTML = `<div class="review-empty">No items selected yet.</div>`;
    return;
  }

  state.data.categories.forEach((cat, ci) => {
    const rows = cat.items
      .map((item, ii) => ({ item, key: itemKey(ci, ii) }))
      .filter(({ key }) => state.toOrder[key] > 0);
    if (rows.length === 0) return;

    const catBlock = document.createElement("div");
    catBlock.className = "review-cat";
    catBlock.innerHTML = `<h3>${cat.name}</h3>`;
    rows.forEach(({ item, key }) => {
      const qty = state.toOrder[key];
      const lineTotal = qty * (item.price || 0);
      const row = document.createElement("div");
      row.className = "review-item";
      row.innerHTML = `<span>${item.name}</span><span class="qty">x${qty} ${item.unit}${item.price ? `<span class="price">${formatMoney(lineTotal)}</span>` : ""}</span>`;
      catBlock.appendChild(row);
    });
    list.appendChild(catBlock);
  });

  const totalRow = document.createElement("div");
  totalRow.className = "review-total";
  totalRow.innerHTML = `<span>Estimated Total</span><span>${formatMoney(totalEstimatedCost())}</span>`;
  list.appendChild(totalRow);
}

function buildOrderText() {
  const lines = [];
  const now = new Date();
  lines.push(`Mojo's Order - ${state.branch.name} branch`);
  lines.push(`Date: ${now.toLocaleDateString()} ${now.toLocaleTimeString()}`);
  lines.push("");

  state.data.categories.forEach((cat, ci) => {
    const rows = cat.items
      .map((item, ii) => ({ item, key: itemKey(ci, ii) }))
      .filter(({ key }) => state.toOrder[key] > 0);
    if (rows.length === 0) return;
    lines.push(`${cat.name.toUpperCase()}${state.completed[ci] ? " (COMPLETE)" : ""}`);
    rows.forEach(({ item, key }) => {
      const stock = state.stock[key] ?? "-";
      const par = item.par || 0;
      lines.push(`  - ${item.name} : Par ${par} | Stock ${stock} | Order ${state.toOrder[key]} ${item.unit}`);
    });
    lines.push("");
  });

  lines.push(`Total line items: ${totalItemsSelected()}`);
  lines.push(`Estimated total cost: ${formatMoney(totalEstimatedCost())}`);
  return lines.join("\n");
}

function sendOrder() {
  const subject = `Mojo's Order - ${state.branch.name} - ${new Date().toLocaleDateString()}`;
  const body = buildOrderText();
  let mailto = `mailto:${encodeURIComponent(state.branch.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  if (CONFIG.ccEmail) mailto += `&cc=${encodeURIComponent(CONFIG.ccEmail)}`;
  window.location.href = mailto;

  localStorage.removeItem(STORAGE_KEY);
  setTimeout(() => showScreen("confirmScreen"), 400);
}

function resetOrder() {
  state.stock = {};
  state.toOrder = {};
  state.completed = {};
  state.branch = null;
  localStorage.removeItem(STORAGE_KEY);
  showScreen("branchScreen");
}

function clearAll() {
  const n = totalItemsSelected();
  const msg = n > 0
    ? `Clear all stock counts and order quantities for ${state.branch.name}? This cannot be undone.`
    : "Clear all stock counts and category progress? This cannot be undone.";
  if (!confirm(msg)) return;
  state.stock = {};
  state.toOrder = {};
  state.completed = {};
  saveDraft();
  renderOrderScreen();
}

function init() {
  state.data = DATA;

  loadDraft();
  renderBranchScreen();

  $("#backToOrder").addEventListener("click", () => showScreen("orderScreen"));
  $("#reviewBtn").addEventListener("click", () => {
    renderReviewScreen();
    showScreen("reviewScreen");
  });
  $("#sendBtn").addEventListener("click", sendOrder);
  $("#switchBranch").addEventListener("click", () => {
    if (confirm("Switch branch? Your current quantities stay saved.")) {
      showScreen("branchScreen");
    }
  });
  $("#newOrderBtn").addEventListener("click", resetOrder);
  $("#clearAllBtn").addEventListener("click", clearAll);
  $("#searchInput").addEventListener("input", e => filterItems(e.target.value));

  if (state.branch) {
    renderOrderScreen();
    showScreen("orderScreen");
  } else {
    showScreen("branchScreen");
  }
}

init();
