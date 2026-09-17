const state = {
  branch: null,
  supplier: null,
  data: null,
  stock: {},     // "catIdx-itemIdx" -> current stock count
  toOrder: {},   // "catIdx-itemIdx" -> qty to order
  completed: {}  // catIdx -> true
};

const STORAGE_KEY = "mojos_order_drafts_v3";
let allDrafts = {}; // { [branchId]: { [supplierId]: {stock, toOrder, completed} } }

function $(sel, el = document) { return el.querySelector(sel); }
function $all(sel, el = document) { return [...el.querySelectorAll(sel)]; }

function showScreen(id) {
  $all(".screen").forEach(s => s.classList.remove("active"));
  $("#" + id).classList.add("active");
  window.scrollTo(0, 0);
}

function emptySlice() { return { stock: {}, toOrder: {}, completed: {} }; }

function loadAllDrafts() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) { return {}; }
}

function getSlice(branchId, supplierId) {
  return (allDrafts[branchId] && allDrafts[branchId][supplierId]) || emptySlice();
}

function persistAllDrafts() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(allDrafts));
}

function saveDraft() {
  if (!state.branch || !state.supplier) return;
  allDrafts[state.branch.id] = allDrafts[state.branch.id] || {};
  allDrafts[state.branch.id][state.supplier.id] = {
    stock: state.stock,
    toOrder: state.toOrder,
    completed: state.completed
  };
  persistAllDrafts();
  localStorage.setItem("mojos_last_selection", JSON.stringify({ branch: state.branch.id, supplier: state.supplier.id }));
}

function loadLastSelection() {
  try {
    const raw = localStorage.getItem("mojos_last_selection");
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}

function itemKey(catIdx, itemIdx) { return catIdx + "-" + itemIdx; }

function totalItemsSelected() {
  return Object.values(state.toOrder).filter(v => v > 0).length;
}

function totalUnitsSelected() {
  return Object.values(state.toOrder).reduce((sum, v) => sum + (v > 0 ? v : 0), 0);
}

function moqShortfall() {
  const moq = state.data.moq;
  if (!moq) return 0;
  return Math.max(0, moq - totalUnitsSelected());
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
    btn.addEventListener("click", () => selectBranch(b));
    grid.appendChild(btn);
  });
}

function selectBranch(b) {
  state.branch = b;
  renderSupplierScreen();
  showScreen("supplierScreen");
}

function renderSupplierScreen() {
  $("#supplierBranchTag").textContent = state.branch.name + " branch — choose an order sheet";
  const grid = $("#supplierGrid");
  grid.innerHTML = "";
  CONFIG.suppliers.forEach(s => {
    const count = (DATA[s.id] && DATA[s.id].categories.length) || 0;
    const btn = document.createElement("button");
    btn.className = "branch-btn";
    btn.innerHTML = count === 0
      ? `${s.name} <span class="supplier-empty">(no items yet)</span>`
      : s.name;
    btn.addEventListener("click", () => selectSupplier(s));
    grid.appendChild(btn);
  });
}

function selectSupplier(s) {
  state.supplier = s;
  state.data = DATA[s.id] || { categories: [] };
  const slice = getSlice(state.branch.id, s.id);
  state.stock = slice.stock;
  state.toOrder = slice.toOrder;
  state.completed = slice.completed;
  saveDraft();
  renderOrderScreen();
  showScreen("orderScreen");
}

function renderOrderScreen() {
  $("#supplierTitle").textContent = state.supplier.name;
  $("#branchTag").textContent = state.branch.name + " branch";
  const content = $("#orderContent");
  content.innerHTML = "";

  if (state.data.categories.length === 0) {
    content.innerHTML = `<div class="review-empty">No items in this order sheet yet.<br>Add categories/items to data.js.</div>`;
    updateBottomBar();
    return;
  }

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

    const comboBox = cat.combo ? document.createElement("div") : null;
    function updateComboBox() {
      if (!comboBox) return;
      const totalG = cat.combo.itemIndices.reduce(
        (sum, idx) => sum + (state.toOrder[itemKey(ci, idx)] || 0), 0
      ) * (cat.combo.unitGrams || 1000);
      const patties = Math.floor(totalG / cat.combo.pattyWeightG);
      comboBox.className = "combo-box";
      comboBox.innerHTML = `<strong>${patties}</strong> ${cat.combo.label} <span class="combo-sub">${(totalG / 1000).toFixed(totalG % 1000 ? 1 : 0)}kg &divide; ${cat.combo.pattyWeightG}g each</span>`;
    }

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

      function setOrder(v) {
        v = Math.max(0, Math.floor(Number(v) || 0));
        orderInput.value = v;
        if (v > 0) { state.toOrder[key] = v; row.classList.add("has-qty"); }
        else { delete state.toOrder[key]; row.classList.remove("has-qty"); }
        saveDraft();
        updateBottomBar();
        if (cat.combo && cat.combo.itemIndices.includes(ii)) updateComboBox();
      }

      function setStock(v) {
        v = v === "" ? "" : Math.max(0, Math.floor(Number(v) || 0));
        if (v === "") delete state.stock[key];
        else state.stock[key] = v;
        saveDraft();
        // auto-suggest to-order from par minus stock
        const suggested = Math.max(par - (v === "" ? 0 : v), 0);
        setOrder(suggested);
      }

      stockInput.addEventListener("change", () => setStock(stockInput.value));
      dec.addEventListener("click", () => setOrder((Number(orderInput.value) || 0) - 1));
      inc.addEventListener("click", () => setOrder((Number(orderInput.value) || 0) + 1));
      orderInput.addEventListener("change", () => setOrder(orderInput.value));

      if (state.toOrder[key] > 0) row.classList.add("has-qty");
      body.appendChild(row);

      if (cat.combo && ii === Math.max(...cat.combo.itemIndices)) {
        updateComboBox();
        body.appendChild(comboBox);
      }
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

      if (state.completed[ci]) {
        catEl.classList.remove("open");
        const next = content.children[ci + 1];
        if (next) {
          next.classList.add("open");
          next.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }
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
  $("#reviewBtn").disabled = n === 0 || moqShortfall() > 0;
  updateIncompleteWarning();
}

function updateIncompleteWarning() {
  const warning = $("#incompleteWarning");
  const lines = [];

  const total = state.data.categories.length;
  if (total > 0) {
    const incomplete = state.data.categories.filter((_, ci) => !state.completed[ci]);
    if (incomplete.length > 0) {
      const names = incomplete.map(c => c.name).join(", ");
      lines.push(
        incomplete.length === total
          ? `No categories marked complete yet (${total} remaining).`
          : `${incomplete.length} of ${total} categories not marked complete: ${names}`
      );
    }
  }

  const shortfall = moqShortfall();
  if (shortfall > 0) {
    lines.push(`Minimum order is ${state.data.moq} ${state.data.moqLabel || "units"} — add ${shortfall} more to meet MOQ.`);
  }

  if (lines.length === 0) {
    warning.classList.add("hidden");
    document.body.classList.remove("has-warning");
    return;
  }
  $("#incompleteText").innerHTML = lines.join("<br>");
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
  lines.push(`Mojo's Order - ${state.supplier.name} - ${state.branch.name} branch`);
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

function formatDateDDMMYYYY(d) {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

function supplierShortName() {
  return state.supplier.name.replace(/^Order\s+/i, "").toUpperCase();
}

let lastOrderText = "";

function sendOrder() {
  const subject = `${supplierShortName()} ${state.branch.name.toUpperCase()} ORDER ${formatDateDDMMYYYY(new Date())}`;
  const body = buildOrderText();
  lastOrderText = body;
  let mailto = `mailto:${encodeURIComponent(state.branch.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  if (CONFIG.ccEmail) mailto += `&cc=${encodeURIComponent(CONFIG.ccEmail)}`;
  window.location.href = mailto;

  // clear this branch+supplier's draft now that it's been sent
  if (allDrafts[state.branch.id]) delete allDrafts[state.branch.id][state.supplier.id];
  persistAllDrafts();

  setTimeout(() => showScreen("confirmScreen"), 400);
}

function copyOrderText() {
  const btn = $("#copyOrderBtn");
  const done = () => {
    const original = "\u{1F4CB} Copy Order Text";
    btn.textContent = "✓ Copied to clipboard";
    btn.classList.add("copied");
    setTimeout(() => {
      btn.textContent = original;
      btn.classList.remove("copied");
    }, 2000);
  };

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(lastOrderText).then(done).catch(() => fallbackCopy(lastOrderText, done));
  } else {
    fallbackCopy(lastOrderText, done);
  }
}

function fallbackCopy(text, onDone) {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  try { document.execCommand("copy"); } catch (e) { /* ignore */ }
  document.body.removeChild(textarea);
  onDone();
}

function resetOrder() {
  state.branch = null;
  state.supplier = null;
  state.stock = {};
  state.toOrder = {};
  state.completed = {};
  localStorage.removeItem("mojos_last_selection");
  showScreen("branchScreen");
}

function clearAll() {
  const n = totalItemsSelected();
  const msg = n > 0
    ? `Clear all stock counts and order quantities for ${state.branch.name} – ${state.supplier.name}? This cannot be undone.`
    : "Clear all stock counts and category progress for this order sheet? This cannot be undone.";
  if (!confirm(msg)) return;
  state.stock = {};
  state.toOrder = {};
  state.completed = {};
  saveDraft();
  renderOrderScreen();
}

function init() {
  allDrafts = loadAllDrafts();
  renderBranchScreen();

  $("#backToBranch").addEventListener("click", () => showScreen("branchScreen"));
  $("#backToOrder").addEventListener("click", () => showScreen("orderScreen"));
  $("#reviewBtn").addEventListener("click", () => {
    renderReviewScreen();
    showScreen("reviewScreen");
  });
  $("#sendBtn").addEventListener("click", sendOrder);
  $("#switchBranch").addEventListener("click", () => {
    if (confirm("Change order sheet? Your current quantities stay saved.")) {
      renderSupplierScreen();
      showScreen("supplierScreen");
    }
  });
  $("#newOrderBtn").addEventListener("click", resetOrder);
  $("#copyOrderBtn").addEventListener("click", copyOrderText);
  $("#clearAllBtn").addEventListener("click", clearAll);
  $("#searchInput").addEventListener("input", e => filterItems(e.target.value));

  const last = loadLastSelection();
  if (last) {
    const b = CONFIG.branches.find(x => x.id === last.branch);
    const s = CONFIG.suppliers.find(x => x.id === last.supplier);
    if (b && s) {
      state.branch = b;
      selectSupplier(s);
      return;
    }
  }
  showScreen("branchScreen");
}

init();
