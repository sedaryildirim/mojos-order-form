const state = {
  branch: null,
  supplier: null,
  data: null,
  stock: {},     // "catIdx-itemIdx" -> current stock count
  toOrder: {},   // "catIdx-itemIdx" -> qty to order
  completed: {}, // catIdx -> true
  skipped: {}    // "catIdx-itemIdx" -> true (deliberately not ordering this item)
};

const STORAGE_KEY = "mojos_order_drafts_v3";
let allDrafts = {}; // { [branchId]: { [supplierId]: {stock, toOrder, completed, skipped} } }

function $(sel, el = document) { return el.querySelector(sel); }
function $all(sel, el = document) { return [...el.querySelectorAll(sel)]; }

const THEME_KEY = "mojos_theme";

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem(THEME_KEY, theme);
  const btn = $("#themeToggle");
  if (!btn) return;
  const switchTo = theme === "light" ? "dark" : "light";
  btn.textContent = theme === "light" ? "☽" : "☀";
  btn.title = `Switch to ${switchTo} mode`;
  btn.setAttribute("aria-label", `Switch to ${switchTo} mode`);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
  applyTheme(current === "light" ? "dark" : "light");
}

function showScreen(id) {
  $all(".screen").forEach(s => s.classList.remove("active"));
  $("#" + id).classList.add("active");
  window.scrollTo(0, 0);
}

function emptySlice() { return { stock: {}, toOrder: {}, completed: {}, skipped: {} }; }

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
    completed: state.completed,
    skipped: state.skipped
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

function setCategoryOpen(catEl, open) {
  catEl.classList.toggle("open", open);
  const header = $(".category-header", catEl);
  if (header) header.setAttribute("aria-expanded", String(open));
}

// An item counts as "reviewed" once staff have entered a stock count, set an
// order quantity, or explicitly skipped it. Items with no par/stock tracking
// (e.g. "Bottles to Return") don't need review to count as touched.
function isItemTouched(item, key) {
  if (item.noParStock) return true;
  if (Object.prototype.hasOwnProperty.call(state.stock, key)) return true;
  if (state.skipped[key]) return true;
  if (state.toOrder[key] > 0) return true;
  return false;
}

function setCategoryCompleted(ci, catEl, completed) {
  state.completed[ci] = completed;
  catEl.classList.toggle("completed", completed);
  const btn = $(".complete-btn", catEl);
  if (btn) btn.textContent = completed ? "Category Completed ✓" : "Mark Category Complete";
  saveDraft();
  updateIncompleteWarning();
  if (completed) {
    setCategoryOpen(catEl, false);
    const next = catEl.nextElementSibling;
    if (next && next.classList.contains("category")) {
      setCategoryOpen(next, true);
      next.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }
}

// Once every item in a category has been reviewed (stock entered, order set,
// or skipped), mark it complete automatically so staff don't have to tap
// "Mark Category Complete" by hand for every one of a dozen categories.
function maybeAutoComplete(ci, catEl, cat) {
  if (state.completed[ci]) return;
  const allTouched = cat.items.every((item, ii) => isItemTouched(item, itemKey(ci, ii)));
  if (allTouched) setCategoryCompleted(ci, catEl, true);
}

function totalItemsSelected() {
  return Object.values(state.toOrder).filter(v => v > 0).length;
}

// Counts items with real entered data (stock, an order qty, or an explicit
// skip) - unlike isItemTouched(), this doesn't treat noParStock items as
// automatically touched, since this is reporting what was actually typed in.
function totalItemsTouched() {
  const keys = new Set([
    ...Object.keys(state.stock),
    ...Object.keys(state.toOrder).filter(k => state.toOrder[k] > 0),
    ...Object.keys(state.skipped)
  ]);
  return keys.size;
}

function totalUnitsSelected() {
  return Object.values(state.toOrder).reduce((sum, v) => sum + (v > 0 ? v : 0), 0);
}

function incompleteCategories() {
  const total = state.data.categories.length;
  const incomplete = state.data.categories.filter((_, ci) => !state.completed[ci]);
  return { total, incomplete };
}

function moqShortfall() {
  const moq = state.data.moq;
  if (!moq) return 0;
  return Math.max(0, moq - totalUnitsSelected());
}

function comboMismatches() {
  const messages = [];
  state.data.categories.forEach((cat, ci) => {
    if (!cat.combo || !cat.combo.requireTogether) return;
    const minEach = cat.combo.minEach || 1;
    const qtys = cat.combo.itemIndices.map(idx => state.toOrder[itemKey(ci, idx)] || 0);
    const anyTouched = qtys.some(q => q > 0);
    const allMet = qtys.every(q => q >= minEach);
    if (anyTouched && !allMet) {
      const names = cat.combo.itemIndices.map(idx => cat.items[idx].name).join(" and ");
      messages.push(`${names} must be ordered together (minimum ${minEach} kg each).`);
    }
  });
  return messages;
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

const VAT_RATE = 0.07;

function totalWithVat() {
  return totalEstimatedCost() * (1 + VAT_RATE);
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

let pendingResumeNotice = false;

function selectSupplier(s) {
  state.supplier = s;
  state.data = DATA[s.id] || { categories: [] };
  const slice = getSlice(state.branch.id, s.id);
  state.stock = slice.stock;
  state.toOrder = slice.toOrder;
  state.completed = slice.completed;
  state.skipped = slice.skipped || {};
  pendingResumeNotice = Object.keys(slice.stock).length > 0
    || Object.keys(slice.toOrder).length > 0
    || Object.keys(slice.skipped).length > 0;
  saveDraft();
  renderOrderScreen();
  showScreen("orderScreen");
}

function renderOrderScreen() {
  $("#supplierTitle").textContent = state.supplier.name;
  $("#branchTag").textContent = state.branch.name + " branch";
  const content = $("#orderContent");
  content.innerHTML = "";

  const showResumeNotice = pendingResumeNotice;
  pendingResumeNotice = false;
  if (showResumeNotice) {
    const n = totalItemsTouched();
    const notice = document.createElement("div");
    notice.className = "resume-notice";
    notice.innerHTML = `
      <span>Resuming ${state.branch.name} → ${state.supplier.name} — ${n} item${n === 1 ? "" : "s"} already entered. Not you? Tap &#8962; to start over.</span>
      <button type="button" class="resume-notice-dismiss" aria-label="Dismiss">&times;</button>
    `;
    $(".resume-notice-dismiss", notice).addEventListener("click", () => notice.remove());
    content.appendChild(notice);
  }

  if (state.data.categories.length === 0) {
    content.insertAdjacentHTML("beforeend", `<div class="review-empty">No items in this order sheet yet.<br>Add categories/items to data.js.</div>`);
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
    header.setAttribute("aria-expanded", "false");
    header.innerHTML = `<span><span class="check">&#10003;</span>${cat.name} <span class="meta">(${cat.items.length})</span></span><span class="chev">&#9662;</span>`;
    header.addEventListener("click", () => {
      setCategoryOpen(catEl, !catEl.classList.contains("open"));
    });

    const body = document.createElement("div");
    body.className = "category-body";

    const comboBox = cat.combo ? document.createElement("div") : null;
    function updateComboBox() {
      if (!comboBox) return;
      const qtys = cat.combo.itemIndices.map(idx => state.toOrder[itemKey(ci, idx)] || 0);
      const totalG = qtys.reduce((sum, q) => sum + q, 0) * (cat.combo.unitGrams || 1000);
      const patties = Math.floor(totalG / cat.combo.pattyWeightG);
      let html = `<strong>${patties}</strong> ${cat.combo.label} <span class="combo-sub">${(totalG / 1000).toFixed(totalG % 1000 ? 1 : 0)}kg &divide; ${cat.combo.pattyWeightG}g each</span>`;
      let mismatched = false;

      if (cat.combo.requireTogether) {
        const minEach = cat.combo.minEach || 1;
        const anyTouched = qtys.some(q => q > 0);
        const allMet = qtys.every(q => q >= minEach);
        mismatched = anyTouched && !allMet;
        html += mismatched
          ? `<span class="combo-warning">&#9888; Order both items together, minimum ${minEach} kg each</span>`
          : `<span class="combo-note">Must be ordered together, minimum ${minEach} kg each</span>`;
      }

      comboBox.className = "combo-box" + (mismatched ? " combo-box-warning" : "");
      comboBox.innerHTML = html;
    }

    cat.items.forEach((item, ii) => {
      const key = itemKey(ci, ii);
      const parUnset = item.par === null || item.par === undefined;
      const par = parUnset ? 0 : item.par;
      const step = item.step || 1;
      const isSkipped = !!state.skipped[key];
      const row = document.createElement("div");
      row.className = "item-row" + (isSkipped ? " skipped" : "");
      row.dataset.key = key;

      row.innerHTML = item.noParStock ? `
        <div class="item-name">${item.name}</div>
        <div class="item-sub">${item.unit}${item.price ? " &middot; ฿" + item.price : ""}${step > 1 ? ` &middot; orders in multiples of ${step}` : ""}</div>
        <div class="stepper stepper-wide">
          <button type="button" class="dec" aria-label="Decrease ${item.name}">&minus;</button>
          <input type="number" inputmode="numeric" min="0" step="${step}" class="order-input" value="${state.toOrder[key] || 0}" aria-label="${item.name}">
          <button type="button" class="inc" aria-label="Increase ${item.name}">&plus;</button>
        </div>
      ` : `
        <div class="item-name">${item.name}</div>
        <div class="item-sub">${item.unit} &middot; ${item.price ? "฿" + item.price : ""}</div>
        <label class="skip-toggle">
          <input type="checkbox" class="skip-checkbox"${isSkipped ? " checked" : ""} aria-label="Skip ${item.name}, not ordering it this time">
          Skip this item
        </label>
        <div class="fields-row">
          <div class="field par">
            <label>Par</label>
            <div class="par-value${parUnset ? " par-unset" : ""}" title="${parUnset ? "Par not set yet" : ""}">${parUnset ? "—" : par}</div>
          </div>
          <div class="field stock">
            <label>Stock</label>
            <input type="number" inputmode="numeric" min="0" class="stock-input" value="${state.stock[key] ?? ""}" placeholder="0" aria-label="${item.name} current stock">
          </div>
          <div class="field order">
            <label>To Order</label>
            <div class="stepper">
              <button type="button" class="dec" aria-label="Decrease ${item.name} to order">&minus;</button>
              <input type="number" inputmode="numeric" min="0" class="order-input" value="${state.toOrder[key] || 0}" aria-label="${item.name} to order">
              <button type="button" class="inc" aria-label="Increase ${item.name} to order">&plus;</button>
            </div>
          </div>
        </div>
      `;

      const stockInput = $(".stock-input", row);
      const orderInput = $(".order-input", row);
      const dec = $(".dec", row);
      const inc = $(".inc", row);
      const skipCheckbox = $(".skip-checkbox", row);

      // Once the user has directly set a To Order value, stop overwriting it
      // when Stock changes again - "auto-calculates but stays manually
      // overridable" means the override has to actually stick.
      let orderManuallySet = (state.toOrder[key] || 0) > 0;

      function setOrder(v) {
        v = Math.max(0, Math.floor(Number(v) || 0));
        if (step > 1) v = Math.round(v / step) * step;
        orderInput.value = v;
        if (v > 0) { state.toOrder[key] = v; row.classList.add("has-qty"); }
        else { delete state.toOrder[key]; row.classList.remove("has-qty"); }
        saveDraft();
        updateBottomBar();
        if (cat.combo && cat.combo.itemIndices.includes(ii)) updateComboBox();
        if ($("#onlyTouchedToggle").checked) applyFilters();
        maybeAutoComplete(ci, catEl, cat);
      }

      function setOrderManual(v) {
        orderManuallySet = true;
        setOrder(v);
      }

      function setStock(v) {
        v = v === "" ? "" : Math.max(0, Math.floor(Number(v) || 0));
        if (v === "") delete state.stock[key];
        else state.stock[key] = v;
        saveDraft();
        maybeAutoComplete(ci, catEl, cat);
        if (orderManuallySet) return;
        // auto-suggest to-order from par minus stock, only while the user
        // hasn't overridden it yet
        const suggested = Math.max(par - (v === "" ? 0 : v), 0);
        setOrder(suggested);
      }

      if (stockInput) stockInput.addEventListener("change", () => setStock(stockInput.value));
      dec.addEventListener("click", () => setOrderManual((Number(orderInput.value) || 0) - step));
      inc.addEventListener("click", () => setOrderManual((Number(orderInput.value) || 0) + step));
      orderInput.addEventListener("change", () => setOrderManual(orderInput.value));

      if (skipCheckbox) {
        skipCheckbox.addEventListener("change", () => {
          if (skipCheckbox.checked) {
            state.skipped[key] = true;
            row.classList.add("skipped");
            if (stockInput) stockInput.value = "";
            delete state.stock[key];
            setOrder(0); // clears any qty, saves draft, and checks auto-complete
            const nextRow = row.nextElementSibling;
            if (nextRow) nextRow.scrollIntoView({ behavior: "smooth", block: "nearest" });
          } else {
            delete state.skipped[key];
            row.classList.remove("skipped");
            saveDraft();
          }
        });
      }

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
      setCategoryCompleted(ci, catEl, !state.completed[ci]);
    });
    body.appendChild(completeBtn);

    catEl.appendChild(header);
    catEl.appendChild(body);
    content.appendChild(catEl);
  });

  updateBottomBar();
  applyFilters();
}

function updateBottomBar() {
  const n = totalItemsSelected();
  $("#selectedCount").textContent = n;
  $("#estTotal").textContent = formatMoney(totalWithVat()) + " incl. VAT";
  $("#reviewBtn").disabled = n === 0 || moqShortfall() > 0 || comboMismatches().length > 0;
  updateIncompleteWarning();
}

function updateIncompleteWarning() {
  const warning = $("#incompleteWarning");
  const lines = [];

  const { total, incomplete } = incompleteCategories();
  if (total > 0) {
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

  lines.push(...comboMismatches());

  if (lines.length === 0) {
    warning.classList.add("hidden");
    document.body.classList.remove("has-warning");
    return;
  }
  $("#incompleteText").innerHTML = lines.join("<br>");
  warning.classList.remove("hidden");
  document.body.classList.add("has-warning");
}

function applyFilters() {
  const q = $("#searchInput").value.trim().toLowerCase();
  const onlyTouched = $("#onlyTouchedToggle").checked;
  $all(".category").forEach(catEl => {
    let anyVisible = false;
    $all(".item-row", catEl).forEach(row => {
      const name = $(".item-name", row).textContent.toLowerCase();
      const matchesSearch = !q || name.includes(q);
      const matchesTouched = !onlyTouched || (state.toOrder[row.dataset.key] || 0) > 0;
      const match = matchesSearch && matchesTouched;
      row.style.display = match ? "" : "none";
      if (match) anyVisible = true;
    });
    catEl.style.display = anyVisible ? "" : "none";
    if ((q || onlyTouched) && anyVisible) setCategoryOpen(catEl, true);
  });
}

function renderReviewScreen() {
  const list = $("#reviewList");
  list.innerHTML = "";
  const n = totalItemsSelected();

  if (n === 0) {
    list.innerHTML = `<div class="review-empty">No items selected yet.</div>`;
    setSubmitButtonsDisabled(true);
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

  const subtotal = totalEstimatedCost();
  const vat = subtotal * VAT_RATE;

  const subtotalRow = document.createElement("div");
  subtotalRow.className = "review-subtotal";
  subtotalRow.innerHTML = `<span>Subtotal</span><span>${formatMoney(subtotal)}</span>`;
  list.appendChild(subtotalRow);

  const vatRow = document.createElement("div");
  vatRow.className = "review-subtotal";
  vatRow.innerHTML = `<span>VAT (7%)</span><span>${formatMoney(vat)}</span>`;
  list.appendChild(vatRow);

  const totalRow = document.createElement("div");
  totalRow.className = "review-total";
  totalRow.innerHTML = `<span>Estimated Total</span><span>${formatMoney(subtotal + vat)}</span>`;
  list.appendChild(totalRow);

  const gateLines = [];
  const { total, incomplete } = incompleteCategories();
  if (total > 0 && incomplete.length > 0) {
    const names = incomplete.map(c => c.name).join(", ");
    gateLines.push(`${incomplete.length} of ${total} categories not marked complete: ${names}.`);
  }
  const shortfall = moqShortfall();
  if (shortfall > 0) {
    gateLines.push(`Minimum order is ${state.data.moq} ${state.data.moqLabel || "units"} — add ${shortfall} more to meet MOQ.`);
  }
  gateLines.push(...comboMismatches());

  if (gateLines.length > 0) {
    const gate = document.createElement("div");
    gate.className = "review-gate-warning";
    gate.innerHTML = `&#9888; ${gateLines.join("<br>")} Go back and fix this before sending.`;
    list.appendChild(gate);
    setSubmitButtonsDisabled(true);
  } else {
    setSubmitButtonsDisabled(false);
  }
}

function setSubmitButtonsDisabled(disabled) {
  $("#emailOrderBtn").disabled = disabled;
  $("#copyReviewBtn").disabled = disabled;
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
      const par = (item.par === null || item.par === undefined) ? "-" : item.par;
      lines.push(`  - ${item.name} : Par ${par} | Stock ${stock} | Order ${state.toOrder[key]} ${item.unit}`);
    });
    lines.push("");
  });

  const subtotal = totalEstimatedCost();
  const vat = subtotal * VAT_RATE;
  lines.push(`Total line items: ${totalItemsSelected()}`);
  lines.push(`Subtotal: ${formatMoney(subtotal)}`);
  lines.push(`VAT (7%): ${formatMoney(vat)}`);
  lines.push(`Estimated total cost (incl. VAT): ${formatMoney(subtotal + vat)}`);
  return lines.join("\n");
}

function orderFileName() {
  const supplier = supplierShortName().replace(/\s+/g, "_");
  const branch = state.branch.name.replace(/\s+/g, "_");
  const date = formatDateDDMMYYYY(new Date()).replace(/\//g, "-");
  return `${supplier}_${branch}_${date}.xlsx`;
}

function buildOrderWorkbook() {
  const rows = [];
  rows.push([`${state.supplier.name} - ${state.branch.name} branch`]);
  rows.push([`Order date: ${formatDateDDMMYYYY(new Date())}`]);
  rows.push([]);
  rows.push(["Category", "Article No.", "Description", "Unit", "Unit Price (THB)", "Qty", "Line Total (THB)"]);

  state.data.categories.forEach((cat, ci) => {
    cat.items.forEach((item, ii) => {
      const key = itemKey(ci, ii);
      const qty = state.toOrder[key] || 0;
      if (qty <= 0) return;
      rows.push([cat.name, item.id || "", item.name, item.unit, item.price || 0, qty, qty * (item.price || 0)]);
    });
  });

  const subtotal = totalEstimatedCost();
  const vat = subtotal * VAT_RATE;
  rows.push([]);
  rows.push(["", "", "", "", "", "Subtotal", Math.round(subtotal)]);
  rows.push(["", "", "", "", "", "VAT (7%)", Math.round(vat)]);
  rows.push(["", "", "", "", "", "Total (incl. VAT)", Math.round(subtotal + vat)]);

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [{ wch: 20 }, { wch: 12 }, { wch: 38 }, { wch: 12 }, { wch: 14 }, { wch: 8 }, { wch: 16 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Order");
  return wb;
}

async function sendOrderAsExcel() {
  const wb = buildOrderWorkbook();
  const wbArray = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([wbArray], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const filename = orderFileName();

  if (navigator.share && navigator.canShare) {
    try {
      const file = new File([blob], filename, { type: blob.type });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `${state.supplier.name} order`,
          text: `${state.supplier.name} order for ${state.branch.name} branch`
        });
        clearSentDraft();
        showConfirmScreen("Order shared", "The Excel file has been shared.");
        return;
      }
    } catch (e) {
      if (e && e.name === "AbortError") return; // user cancelled the share sheet, do nothing
      // any other failure: fall through to the plain download below
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  clearSentDraft();
  showConfirmScreen("Order downloaded", "The Excel file has been saved to your device.");
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

function clearSentDraft() {
  // clear this branch+supplier's draft now that it's been submitted
  if (allDrafts[state.branch.id]) delete allDrafts[state.branch.id][state.supplier.id];
  persistAllDrafts();
}

function showConfirmScreen(heading, body) {
  $("#confirmHeading").textContent = heading;
  $("#confirmBody").textContent = body;
  showScreen("confirmScreen");
}

function emailOrder() {
  const subject = `${supplierShortName()} ${state.branch.name.toUpperCase()} ORDER ${formatDateDDMMYYYY(new Date())}`;
  const body = buildOrderText();
  lastOrderText = body;
  let mailto = `mailto:${encodeURIComponent(state.branch.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  if (CONFIG.ccEmail) mailto += `&cc=${encodeURIComponent(CONFIG.ccEmail)}`;
  window.location.href = mailto;

  clearSentDraft();
  setTimeout(() => showConfirmScreen(
    "Order sent",
    "Your mail app has opened with the order pre-filled. Tap send there to confirm."
  ), 400);
}

function copyOrderFromReview() {
  const body = buildOrderText();
  lastOrderText = body;
  copyTextToClipboard(body, () => {
    clearSentDraft();
    showConfirmScreen(
      "Order copied",
      "The order has been copied to your clipboard. Paste it into WhatsApp, Line, email, or wherever you send orders."
    );
  });
}

function copyTextToClipboard(text, onDone) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(onDone).catch(() => fallbackCopy(text, onDone));
  } else {
    fallbackCopy(text, onDone);
  }
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
  copyTextToClipboard(lastOrderText, done);
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
  state.skipped = {};
  localStorage.removeItem("mojos_last_selection");
  showScreen("branchScreen");
}

function clearAllNow() {
  state.stock = {};
  state.toOrder = {};
  state.completed = {};
  state.skipped = {};
  saveDraft();
  renderOrderScreen();
}

function nextSupplier() {
  renderSupplierScreen();
  showScreen("supplierScreen");
}

const armedTimers = new WeakMap();

function armConfirm(btn, message, onConfirm, variant = "danger") {
  if (btn.classList.contains("armed")) {
    disarmConfirm(btn);
    onConfirm();
    return;
  }
  btn.classList.add("armed");
  if (variant === "neutral") btn.classList.add("confirm-neutral");
  showActionToast(message, variant);
  const timer = setTimeout(() => disarmConfirm(btn), 3000);
  armedTimers.set(btn, timer);
}

function disarmConfirm(btn) {
  btn.classList.remove("armed", "confirm-neutral");
  clearTimeout(armedTimers.get(btn));
  armedTimers.delete(btn);
  hideActionToast();
}

function showActionToast(message, variant = "danger") {
  const toast = $("#actionToast");
  toast.textContent = message;
  toast.classList.toggle("neutral", variant === "neutral");
  toast.classList.remove("hidden");
}

function hideActionToast() {
  $("#actionToast").classList.add("hidden");
}

function init() {
  allDrafts = loadAllDrafts();
  renderBranchScreen();
  applyTheme(document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark");
  $("#themeToggle").addEventListener("click", toggleTheme);

  $("#backToBranch").addEventListener("click", () => showScreen("branchScreen"));
  $("#backToOrder").addEventListener("click", () => showScreen("orderScreen"));
  $("#reviewBtn").addEventListener("click", () => {
    renderReviewScreen();
    showScreen("reviewScreen");
  });
  $("#emailOrderBtn").addEventListener("click", emailOrder);
  $("#copyReviewBtn").addEventListener("click", copyOrderFromReview);
  $("#excelReviewBtn").addEventListener("click", sendOrderAsExcel);
  $("#switchBranch").addEventListener("click", () => {
    armConfirm($("#switchBranch"), "Tap ⇆ again to change order sheet — your progress stays saved.", () => {
      renderSupplierScreen();
      showScreen("supplierScreen");
    }, "neutral");
  });
  $("#newOrderBtn").addEventListener("click", resetOrder);
  $("#nextSupplierBtn").addEventListener("click", nextSupplier);
  $("#emailConfirmBtn").addEventListener("click", emailOrder);
  $("#copyOrderBtn").addEventListener("click", copyOrderText);
  $("#excelConfirmBtn").addEventListener("click", sendOrderAsExcel);
  $("#startOverBtn").addEventListener("click", () => {
    armConfirm($("#startOverBtn"), "Tap ⌂ again to return to the start — your progress stays saved.", resetOrder, "neutral");
  });
  $("#startOverReviewBtn").addEventListener("click", () => {
    armConfirm($("#startOverReviewBtn"), "Tap ⌂ again to return to the start — your progress stays saved.", resetOrder, "neutral");
  });
  $("#clearAllBtn").addEventListener("click", () => {
    const n = totalItemsSelected();
    const msg = n > 0
      ? `Tap \u{1F5D1} again to clear all stock counts and order quantities for ${state.supplier.name}. This cannot be undone.`
      : `Tap \u{1F5D1} again to clear category progress for ${state.supplier.name}. This cannot be undone.`;
    armConfirm($("#clearAllBtn"), msg, clearAllNow);
  });
  $("#searchInput").addEventListener("input", applyFilters);
  $("#onlyTouchedToggle").addEventListener("change", applyFilters);

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
