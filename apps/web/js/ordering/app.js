const state = {
  branch: null,
  supplier: null,
  data: null,
  stock: {},     // "catIdx-itemIdx" -> current stock count
  toOrder: {},   // "catIdx-itemIdx" -> qty to order
  completed: {}, // catIdx -> true
  skipped: {}    // "catIdx-itemIdx" -> true (deliberately not ordering this item)
};

// Drafts live in localStorage, keyed by branch and supplier. Items are stored under a stable id
// (category name + item id), not their position, so editing config/data.js never shifts a saved
// order onto the wrong items. Inside the app, state still uses position keys ("catIdx-itemIdx");
// toStable / fromStable convert at the storage boundary.
const STORAGE_KEY = "mojos_order_drafts_v4";
const LEGACY_STORAGE_KEY = "mojos_order_drafts_v3"; // position-based, migrated once
const LAST_SENT_KEY = "mojos_last_sent_v1";       // copy of the last order sent, so it can be restored
const LAST_SELECTION_KEY = "mojos_last_selection";

function $(sel, el = document) { return el.querySelector(sel); }
function $all(sel, el = document) { return [...el.querySelectorAll(sel)]; }

const THEME_KEY = "mojos_theme";

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  storageSet(THEME_KEY, theme);
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

// ---- storage helpers: a full or blocked store must never break the form ----
function storageGet(key) {
  try { return localStorage.getItem(key); } catch (e) { return null; }
}
function storageSet(key, value) {
  try {
    localStorage.setItem(key, value);
    setStorageNotice(false);
    return true;
  } catch (e) {
    setStorageNotice(true);
    return false;
  }
}
function storageRemove(key) {
  try { localStorage.removeItem(key); } catch (e) { /* nothing to remove */ }
}
function setStorageNotice(show) {
  const el = document.getElementById("storageNotice");
  if (el) el.classList.toggle("hidden", !show);
}

// The one message toast. tone "danger" is used for the two-tap Clear warning.
let toastTimer = null;
function showGlobalToast(message, ms = 4500, tone = "") {
  const el = document.getElementById("globalToast");
  if (!el) return;
  el.textContent = message;
  el.classList.toggle("is-danger", tone === "danger");
  el.classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add("hidden"), ms);
}

function hideGlobalToast() {
  clearTimeout(toastTimer);
  const el = document.getElementById("globalToast");
  if (el) el.classList.add("hidden");
}

// ---- stable item ids ----
function itemId(cat, item) { return cat.name + "|" + (item.id || item.name); }

function toStable(slice, data) {
  const out = emptySlice();
  for (const field of ["stock", "toOrder", "skipped"]) {
    for (const key of Object.keys(slice[field] || {})) {
      const [ci, ii] = key.split("-").map(Number);
      const cat = data.categories[ci];
      const item = cat && cat.items[ii];
      if (item) out[field][itemId(cat, item)] = slice[field][key];
    }
  }
  for (const ci of Object.keys(slice.completed || {})) {
    const cat = data.categories[ci];
    if (cat && slice.completed[ci]) out.completed[cat.name] = true;
  }
  return out;
}

function fromStable(slice, data) {
  const byId = {};
  const byCategory = {};
  data.categories.forEach((cat, ci) => {
    byCategory[cat.name] = ci;
    cat.items.forEach((item, ii) => { byId[itemId(cat, item)] = itemKey(ci, ii); });
  });
  const out = emptySlice();
  for (const field of ["stock", "toOrder", "skipped"]) {
    for (const id of Object.keys(slice[field] || {})) {
      if (byId[id] !== undefined) out[field][byId[id]] = slice[field][id]; // items removed from the data are dropped
    }
  }
  for (const name of Object.keys(slice.completed || {})) {
    if (byCategory[name] !== undefined && slice.completed[name]) out.completed[byCategory[name]] = true;
  }
  return out;
}

// ---- drafts: always read fresh and write only the slice that changed, so two tabs never overwrite each other ----
function readAllDrafts() {
  const raw = storageGet(STORAGE_KEY);
  if (raw) {
    try { return JSON.parse(raw) || {}; } catch (e) { return {}; }
  }
  return migrateLegacyDrafts();
}

function migrateLegacyDrafts() {
  const raw = storageGet(LEGACY_STORAGE_KEY);
  if (!raw) return {};
  let old;
  try { old = JSON.parse(raw) || {}; } catch (e) { return {}; }
  const out = {};
  for (const b of Object.keys(old)) {
    for (const s of Object.keys(old[b] || {})) {
      if (!DATA[s]) continue;
      out[b] = out[b] || {};
      out[b][s] = toStable({ ...emptySlice(), ...old[b][s] }, DATA[s]);
    }
  }
  storageSet(STORAGE_KEY, JSON.stringify(out));
  return out;
}

function writeSlice(branchId, supplierId, stableSlice) {
  const all = readAllDrafts();
  if (stableSlice) {
    all[branchId] = all[branchId] || {};
    all[branchId][supplierId] = stableSlice;
  } else if (all[branchId]) {
    delete all[branchId][supplierId];
  }
  return storageSet(STORAGE_KEY, JSON.stringify(all));
}

function getSlice(branchId, supplierId) {
  const data = DATA[supplierId] || { categories: [] };
  const all = readAllDrafts();
  const stable = (all[branchId] && all[branchId][supplierId]) || emptySlice();
  return fromStable({ ...emptySlice(), ...stable }, data);
}

function saveDraft() {
  if (!state.branch || !state.supplier) return;
  const slice = { stock: state.stock, toOrder: state.toOrder, completed: state.completed, skipped: state.skipped };
  writeSlice(state.branch.id, state.supplier.id, toStable(slice, state.data));
  storageSet(LAST_SELECTION_KEY, JSON.stringify({ branch: state.branch.id, supplier: state.supplier.id }));
}

function loadLastSelection() {
  try {
    const raw = storageGet(LAST_SELECTION_KEY);
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

// The top bar is pinned, so a plain scrollIntoView puts the target underneath it.
// Scroll so it lands just below the bar.
function scrollBelowStickyBars(el) {
  const topbar = $("#orderScreen .topbar");
  const stuck = topbar ? topbar.offsetHeight : 0; // the search bar slides away while scrolling down
  const y = el.getBoundingClientRect().top + window.scrollY - stuck - 8;
  window.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
}

function setCategoryCompleted(ci, catEl, completed) {
  state.completed[ci] = completed;
  catEl.classList.toggle("completed", completed);
  saveDraft();
  updateIncompleteWarning();
  if (completed) {
    setCategoryOpen(catEl, false);
    const next = catEl.nextElementSibling;
    if (next && next.classList.contains("category")) {
      setCategoryOpen(next, true);
      scrollBelowStickyBars(next);
    }
  }
}

// Once every item in a category has been reviewed (stock entered, order set,
// or skipped), the category completes itself. There is no manual "complete"
// button: the review step needs every category finished, so every item is looked at.
//
// Collapsing the instant the last item is touched doesn't leave a window to
// bump a quantity right after typing it, so the actual collapse is delayed -
// any further edit in the category (including the one that just finished it)
// pushes the collapse back instead of firing immediately.
const AUTO_COMPLETE_DELAY_MS = 1500;
const autoCompleteTimers = {}; // catIdx -> timeout id

function maybeAutoComplete(ci, catEl, cat) {
  if (autoCompleteTimers[ci]) {
    clearTimeout(autoCompleteTimers[ci]);
    delete autoCompleteTimers[ci];
  }
  if (state.completed[ci]) return;
  const allTouched = cat.items.every((item, ii) => isItemTouched(item, itemKey(ci, ii)));
  if (!allTouched) return;
  autoCompleteTimers[ci] = setTimeout(() => {
    delete autoCompleteTimers[ci];
    if (state.completed[ci]) return;
    const stillAllTouched = cat.items.every((item, ii) => isItemTouched(item, itemKey(ci, ii)));
    if (stillAllTouched) setCategoryCompleted(ci, catEl, true);
  }, AUTO_COMPLETE_DELAY_MS);
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

  const regions = [];
  CONFIG.branches.forEach(b => {
    const region = b.region || "";
    let group = regions.find(r => r.name === region);
    if (!group) { group = { name: region, branches: [] }; regions.push(group); }
    group.branches.push(b);
  });

  regions.forEach(region => {
    const wrap = document.createElement("div");
    wrap.className = "region";
    if (region.name) {
      const heading = document.createElement("div");
      heading.className = "region-heading";
      heading.textContent = region.name.toUpperCase();
      wrap.appendChild(heading);
    }
    const regionGrid = document.createElement("div");
    regionGrid.className = "branch-grid";
    region.branches.forEach(b => {
      const btn = document.createElement("button");
      btn.className = "branch-btn";
      btn.textContent = b.name;
      btn.addEventListener("click", () => selectBranch(b));
      regionGrid.appendChild(btn);
    });
    wrap.appendChild(regionGrid);
    grid.appendChild(wrap);
  });
}

function selectBranch(b) {
  state.branch = b;
  renderSupplierScreen();
  showScreen("supplierScreen");
}

function renderSupplierScreen() {
  $("#supplierBranchTag").textContent = state.branch.name;
  const grid = $("#supplierGrid");
  grid.innerHTML = "";
  const allowedIds = state.branch.suppliers || CONFIG.suppliers.map(s => s.id);
  const suppliers = CONFIG.suppliers.filter(s => allowedIds.includes(s.id));
  suppliers.forEach(s => {
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
  $("#branchTag").textContent = state.branch.name;
  const content = $("#orderContent");
  content.innerHTML = "";

  const showResumeNotice = pendingResumeNotice;
  pendingResumeNotice = false;
  if (showResumeNotice) {
    const n = totalItemsTouched();
    const notice = document.createElement("div");
    notice.className = "resume-notice";
    notice.innerHTML = `
      <span>Continuing an order for ${state.supplier.name} at ${state.branch.name}. ${n} item${n === 1 ? "" : "s"} already entered. Not yours? Tap Supplier to go back.</span>
      <button type="button" class="resume-notice-dismiss" aria-label="Dismiss">&times;</button>
    `;
    $(".resume-notice-dismiss", notice).addEventListener("click", () => notice.remove());
    content.appendChild(notice);
  }

  if (state.data.categories.length === 0) {
    content.insertAdjacentHTML("beforeend", `<div class="review-empty">No items for this supplier yet.<br>Add them in config/data.js.</div>`);
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
    header.innerHTML = `<span><span class="check">&#10003;</span>${cat.name} <span class="meta">(${cat.items.length})</span><span class="skip-tag">skipped</span></span><span class="chev">&#9662;</span>`;
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

    // Per-item hooks so the "Skip whole category" button can drive every row
    // through the same code path as the individual Skip checkbox.
    const rowSkip = [];

    const catSkipBtn = document.createElement("button");
    catSkipBtn.type = "button";
    catSkipBtn.className = "cat-skip-btn";
    let catSkipArmTimer = null;

    function categoryIsSkipped() {
      const skippable = cat.items.map((item, ii) => ({ item, key: itemKey(ci, ii) })).filter(({ item }) => !item.noParStock);
      return skippable.length > 0 && skippable.every(({ key }) => state.skipped[key]);
    }

    function enteredCount() {
      return cat.items.filter((_, ii) => {
        const key = itemKey(ci, ii);
        return state.toOrder[key] > 0 || Object.prototype.hasOwnProperty.call(state.stock, key);
      }).length;
    }

    function updateCatSkipBtn() {
      const skipped = categoryIsSkipped();
      catEl.classList.toggle("cat-skipped", skipped);
      catSkipBtn.classList.remove("armed");
      clearTimeout(catSkipArmTimer);
      catSkipBtn.textContent = skipped ? "Category skipped \u2713 Tap to undo" : "Nothing needed: skip whole category";
    }

    catSkipBtn.addEventListener("click", () => {
      if (categoryIsSkipped()) {
        rowSkip.forEach(fn => fn && fn(false));
        updateCatSkipBtn();
        setCategoryCompleted(ci, catEl, false);
        return;
      }
      const n = enteredCount();
      if (n > 0 && !catSkipBtn.classList.contains("armed")) {
        // entered numbers would be wiped: make staff tap twice
        catSkipBtn.classList.add("armed");
        catSkipBtn.textContent = `Tap again to clear ${n} entered item${n === 1 ? "" : "s"} and skip`;
        catSkipArmTimer = setTimeout(updateCatSkipBtn, 4000);
        return;
      }
      rowSkip.forEach(fn => fn && fn(true));
      updateCatSkipBtn();
      if (!state.completed[ci]) setCategoryCompleted(ci, catEl, true);
    });

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
        <div class="item-sub">${item.unit}${item.price ? " &middot; ฿" + item.price : ""} &middot; <span class="par-text${parUnset ? " par-unset" : ""}">Par ${parUnset ? "not set" : par}</span></div>
        <label class="skip-toggle">
          <input type="checkbox" class="skip-checkbox"${isSkipped ? " checked" : ""} aria-label="Skip ${item.name}, not ordering it this time">
          Skip this item
        </label>
        <div class="fields-row">
          <div class="field stock">
            <label>Stock</label>
            <input type="number" inputmode="numeric" min="0" class="stock-input" value="${state.stock[key] ?? ""}" placeholder="0" aria-label="${item.name} current stock">
          </div>
          <div class="field order">
            <label>To order</label>
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

      // Skips or un-skips this row. Also used by the category-level skip
      // button, which passes scroll=false so the page doesn't jump per row.
      function applySkip(on, scroll) {
        if (!skipCheckbox) {
          // no-par items (e.g. Bottles to Return) can't be "skipped", just zeroed
          if (on) setOrder(0);
          return;
        }
        skipCheckbox.checked = on;
        if (on) {
          state.skipped[key] = true;
          row.classList.add("skipped");
          if (stockInput) stockInput.value = "";
          delete state.stock[key];
          setOrder(0); // clears any qty, saves draft, and checks auto-complete
          if (scroll) {
            const nextRow = row.nextElementSibling;
            if (nextRow) nextRow.scrollIntoView({ behavior: "smooth", block: "nearest" });
          }
        } else {
          delete state.skipped[key];
          row.classList.remove("skipped");
          saveDraft();
        }
        updateCatSkipBtn();
      }
      rowSkip[ii] = (on) => applySkip(on, false);

      if (skipCheckbox) {
        skipCheckbox.addEventListener("change", () => applySkip(skipCheckbox.checked, true));
      }

      if (state.toOrder[key] > 0) row.classList.add("has-qty");
      body.appendChild(row);

      if (cat.combo && ii === Math.max(...cat.combo.itemIndices)) {
        updateComboBox();
        body.appendChild(comboBox);
      }
    });

    // categories made only of no-par items (e.g. Bottles to Return) have nothing to skip
    if (cat.items.some(item => !item.noParStock)) {
      updateCatSkipBtn();
      body.insertBefore(catSkipBtn, body.firstChild);
    }


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

let warnLineCount = 0;

function updateIncompleteWarning() {
  const warning = $("#incompleteWarning");
  const lines = [];

  const { total, incomplete } = incompleteCategories();
  if (total > 0) {
    if (incomplete.length > 0) {
      lines.push(
        incomplete.length === total
          ? `No categories finished yet (${total} to go).`
          : `${incomplete.length} categor${incomplete.length === 1 ? "y" : "ies"} left to finish.`
      );
    }
  }

  const shortfall = moqShortfall();
  if (shortfall > 0) {
    lines.push(`Minimum order is ${state.data.moq} ${state.data.moqLabel || "units"}. Add ${shortfall} more.`);
  }

  lines.push(...comboMismatches());

  if (lines.length === 0) {
    warning.classList.add("hidden");
    document.body.classList.remove("has-warning");
    return;
  }
  $("#incompleteText").innerHTML = lines.map(l => `<span class="warn-line">${l}</span>`).join("");
  const toggle = $("#warnToggle");
  toggle.classList.toggle("hidden", lines.length < 2);
  if (lines.length < 2) warning.classList.remove("expanded");
  warnLineCount = lines.length;
  syncWarnToggle(lines.length);
  warning.classList.remove("hidden");
  document.body.classList.add("has-warning");
}

// The warning bar shows its first line; "+N more" opens the rest.
function syncWarnToggle(count) {
  const warning = $("#incompleteWarning");
  const toggle = $("#warnToggle");
  const open = warning.classList.contains("expanded");
  toggle.setAttribute("aria-expanded", String(open));
  toggle.textContent = open ? "Show less" : `+${count - 1} more`;
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
  const nothing = (q || onlyTouched) && $all(".category").every(c => c.style.display === "none");
  $("#noResults").classList.toggle("hidden", !nothing);
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
    gateLines.push(`${incomplete.length} categor${incomplete.length === 1 ? "y" : "ies"} still to finish: ${names}.`);
  }
  const shortfall = moqShortfall();
  if (shortfall > 0) {
    gateLines.push(`Minimum order is ${state.data.moq} ${state.data.moqLabel || "units"}. Add ${shortfall} more.`);
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
  const priceRows = [];
  priceRows.push([`${state.supplier.name} - ${state.branch.name} branch`]);
  priceRows.push([`Order date: ${formatDateDDMMYYYY(new Date())}`]);
  priceRows.push([]);
  priceRows.push(["Category", "Article No.", "Description", "Unit", "Unit Price (THB)", "Qty", "Line Total (THB)"]);

  const plainRows = [];
  plainRows.push([`${state.supplier.name} - ${state.branch.name} branch`]);
  plainRows.push([`Order date: ${formatDateDDMMYYYY(new Date())}`]);
  plainRows.push([]);
  plainRows.push(["Category", "Article No.", "Description", "Unit", "Qty"]);

  state.data.categories.forEach((cat, ci) => {
    cat.items.forEach((item, ii) => {
      const key = itemKey(ci, ii);
      const qty = state.toOrder[key] || 0;
      if (qty <= 0) return;
      priceRows.push([cat.name, item.id || "", item.name, item.unit, item.price || 0, qty, qty * (item.price || 0)]);
      plainRows.push([cat.name, item.id || "", item.name, item.unit, qty]);
    });
  });

  const subtotal = totalEstimatedCost();
  const vat = subtotal * VAT_RATE;
  priceRows.push([]);
  priceRows.push(["", "", "", "", "", "Subtotal", Math.round(subtotal)]);
  priceRows.push(["", "", "", "", "", "VAT (7%)", Math.round(vat)]);
  priceRows.push(["", "", "", "", "", "Total (incl. VAT)", Math.round(subtotal + vat)]);

  const wsPrice = XLSX.utils.aoa_to_sheet(priceRows);
  wsPrice["!cols"] = [{ wch: 20 }, { wch: 12 }, { wch: 38 }, { wch: 12 }, { wch: 14 }, { wch: 8 }, { wch: 16 }];

  const wsPlain = XLSX.utils.aoa_to_sheet(plainRows);
  wsPlain["!cols"] = [{ wch: 20 }, { wch: 12 }, { wch: 38 }, { wch: 12 }, { wch: 8 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, wsPrice, "Order");
  XLSX.utils.book_append_sheet(wb, wsPlain, "Order (No Prices)");
  return wb;
}

let excelBusy = false;

async function sendOrderAsExcel() {
  if (excelBusy) return;
  if (typeof XLSX === "undefined") {
    showGlobalToast("Excel isn't available right now. Use Email or Copy instead.");
    return;
  }
  excelBusy = true;
  const buttons = [$("#excelReviewBtn"), $("#excelConfirmBtn")];
  buttons.forEach(b => { b.disabled = true; });
  try {
    await buildAndSendExcel();
  } catch (e) {
    showGlobalToast("Couldn't create the Excel file. Use Email or Copy instead.");
  } finally {
    excelBusy = false;
    buttons.forEach(b => { b.disabled = false; });
  }
}

async function buildAndSendExcel() {
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
  // Clear this branch+supplier's draft now that it's been submitted, but keep one copy of it:
  // opening the mail app does not prove the email was sent, so the confirm screen can restore it.
  const all = readAllDrafts();
  const slice = all[state.branch.id] && all[state.branch.id][state.supplier.id];
  if (slice) {
    storageSet(LAST_SENT_KEY, JSON.stringify({ branch: state.branch.id, supplier: state.supplier.id, slice, at: Date.now() }));
  }
  writeSlice(state.branch.id, state.supplier.id, null);
}

function restoreLastSent() {
  const raw = storageGet(LAST_SENT_KEY);
  if (!raw) return;
  let sent;
  try { sent = JSON.parse(raw); } catch (e) { return; }
  const branch = CONFIG.branches.find(x => x.id === sent.branch);
  const supplier = CONFIG.suppliers.find(x => x.id === sent.supplier);
  if (!branch || !supplier || !sent.slice) return;
  writeSlice(branch.id, supplier.id, sent.slice);
  storageRemove(LAST_SENT_KEY);
  state.branch = branch;
  selectSupplier(supplier);
  showGlobalToast("Order restored. Check it, then send again.");
}

function showConfirmScreen(heading, body) {
  $("#confirmHeading").textContent = heading;
  $("#confirmBody").textContent = body;
  $("#restoreOrderBtn").classList.toggle("hidden", !storageGet(LAST_SENT_KEY));
  showScreen("confirmScreen");
}

function emailOrder() {
  const subject = `${supplierShortName()} ${state.branch.name.toUpperCase()} ORDER ${formatDateDDMMYYYY(new Date())}`;
  const body = buildOrderText();
  lastOrderText = body;
  let mailto = `mailto:${encodeURIComponent(state.branch.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  if (CONFIG.ccEmail) mailto += `&cc=${encodeURIComponent(CONFIG.ccEmail)}`;
  // Many mail apps cut a mailto: link off around 2,000 characters.
  const tooLong = mailto.length > 1900;
  window.location.href = mailto;

  clearSentDraft();
  setTimeout(() => showConfirmScreen(
    tooLong ? "Check your email" : "Email ready to send",
    tooLong
      ? "This order is long, so your mail app may have cut it off. Check the email before sending, or share the Excel file or copy the order instead."
      : "Your mail app has opened with the order. Tap Send there. If you did not send it, restore your order below."
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
    const original = "\u{1F4CB} Copy order";
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
  storageRemove(LAST_SELECTION_KEY);
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

// Two-tap guard, used only for Clear (the one action that really deletes work).
const armedTimers = new WeakMap();

function armConfirm(btn, message, onConfirm) {
  if (btn.classList.contains("armed")) {
    disarmConfirm(btn);
    onConfirm();
    return;
  }
  btn.classList.add("armed");
  showGlobalToast(message, 3000, "danger");
  armedTimers.set(btn, setTimeout(() => disarmConfirm(btn), 3000));
}

function disarmConfirm(btn) {
  btn.classList.remove("armed");
  clearTimeout(armedTimers.get(btn));
  armedTimers.delete(btn);
  hideGlobalToast();
}

// The par/stock/to-order legend is shown until it has been read once on this device.
const HOWTO_KEY = "mojos_howto_seen";

function init() {
  renderBranchScreen();
  applyTheme(document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark");

  $("#backToBranch").addEventListener("click", () => showScreen("branchScreen"));
  $("#backToOrder").addEventListener("click", () => showScreen("orderScreen"));
  $("#reviewBtn").addEventListener("click", () => {
    renderReviewScreen();
    showScreen("reviewScreen");
  });
  $("#emailOrderBtn").addEventListener("click", emailOrder);
  $("#copyReviewBtn").addEventListener("click", copyOrderFromReview);
  $("#excelReviewBtn").addEventListener("click", sendOrderAsExcel);
  // Progress is saved as you type, so leaving the order needs no confirmation.
  $("#switchBranch").addEventListener("click", () => {
    renderSupplierScreen();
    showScreen("supplierScreen");
  });
  $("#newOrderBtn").addEventListener("click", () => {
    resetOrder();
    showScreen("launcherScreen");
  });
  $("#nextSupplierBtn").addEventListener("click", nextSupplier);
  $("#restoreOrderBtn").addEventListener("click", restoreLastSent);
  $("#clearSearchBtn").addEventListener("click", () => {
    $("#searchInput").value = "";
    $("#onlyTouchedToggle").checked = false;
    applyFilters();
  });
  $("#emailConfirmBtn").addEventListener("click", emailOrder);
  $("#copyOrderBtn").addEventListener("click", copyOrderText);
  $("#excelConfirmBtn").addEventListener("click", sendOrderAsExcel);
  const howTo = $("#howTo");
  if (storageGet(HOWTO_KEY)) howTo.classList.add("hidden");
  $("#howToDismiss").addEventListener("click", () => {
    storageSet(HOWTO_KEY, "1");
    howTo.classList.add("hidden");
  });
  $("#clearAllBtn").addEventListener("click", () => {
    const n = totalItemsSelected();
    const msg = n > 0
      ? `Tap Clear again to clear all stock counts and quantities for ${state.supplier.name}. This can't be undone.`
      : `Tap Clear again to clear your category progress for ${state.supplier.name}. This can't be undone.`;
    armConfirm($("#clearAllBtn"), msg, clearAllNow);
  });
  $("#warnToggle").addEventListener("click", () => {
    $("#incompleteWarning").classList.toggle("expanded");
    syncWarnToggle(warnLineCount);
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
