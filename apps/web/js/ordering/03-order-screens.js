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

  const history = renderHistory();
  if (history) content.appendChild(history);

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
      const c = cat.combo;
      const qtys = c.itemIndices.map(idx => state.toOrder[itemKey(ci, idx)] || 0);
      const unitKg = (c.unitGrams || 1000) / 1000;
      // Patties are only made from matched weight: 9 kg of one cut with 6 kg of the other
      // makes patties from 6 + 6 kg, and the extra 3 kg is called out below.
      const matched = Math.min(...qtys);
      const patties = Math.floor((matched * qtys.length * (c.unitGrams || 1000)) / c.pattyWeightG);
      const perBurger = c.pattiesPerBurger || 0;
      const fmtKg = q => (q * unitKg).toFixed((q * unitKg) % 1 ? 1 : 0);
      let html = `<span class="combo-line">Your order makes <strong>${patties}</strong> ${c.label}` +
        (perBurger ? ` or <strong>${Math.floor(patties / perBurger)}</strong> ${c.burgerLabel || "Burgers"}` : "") + `</span>`;
      html += `<span class="combo-sub">${fmtKg(matched * qtys.length)}kg matched &divide; ${c.pattyWeightG}g each${perBurger ? `, ${perBurger} patties per burger` : ""}</span>`;
      let mismatched = false;

      if (c.requireTogether) {
        const minEach = c.minEach || 1;
        const anyTouched = qtys.some(q => q > 0);
        const allMet = qtys.every(q => q >= minEach);
        mismatched = anyTouched && !allMet;
        html += mismatched
          ? `<span class="combo-warning">&#9888; Order both items together, minimum ${minEach} kg each</span>`
          : `<span class="combo-note">Must be ordered together, minimum ${minEach} kg each</span>`;
      }

      // anything ordered beyond the matched amount does not turn into patties
      c.itemIndices.forEach((idx, n) => {
        const extra = qtys[n] - matched;
        if (extra > 0 && matched > 0) {
          html += `<span class="combo-note combo-extra">You've also ordered ${fmtKg(extra)} kg extra of ${cat.items[idx].name}</span>`;
        }
      });

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
        <div class="item-sub">${item.unit}${item.price ? " &middot; ฿" + item.price : ""}</div>
        <label class="skip-toggle">
          <input type="checkbox" class="skip-checkbox"${isSkipped ? " checked" : ""} aria-label="Skip ${item.name}, not ordering it this time">
          Skip this item
        </label>
        <div class="fields-row">
          <div class="field par">
            <label>Par</label>
            <div class="par-value${parUnset ? " par-unset" : ""}"${parUnset ? ' title="Par not set yet"' : ""}>${parUnset ? "&mdash;" : par}</div>
          </div>
          <div class="field stock${parUnset ? " is-unset" : ""}">
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


    // Staff finish each category themselves: it is their confirmation that the counts and quantities are right.
    const doneBtn = document.createElement("button");
    doneBtn.type = "button";
    doneBtn.className = "btn cat-complete-btn" + (state.completed[ci] ? " is-done" : "");
    doneBtn.textContent = state.completed[ci] ? "Category complete \u2713 Tap to reopen" : "Mark category complete";
    doneBtn.addEventListener("click", () => setCategoryCompleted(ci, catEl, !state.completed[ci]));
    body.appendChild(doneBtn);

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
          ? `No categories completed yet (${total} to go).`
          : `${incomplete.length} categor${incomplete.length === 1 ? "y" : "ies"} left to complete.`
      );
    }
  }

  const shortfall = moqShortfall();
  if (shortfall > 0) {
    lines.push(`Minimum order is ${currentMoq()} ${state.data.moqLabel || "units"}. Add ${shortfall} more.`);
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

