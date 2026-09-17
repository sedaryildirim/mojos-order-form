const state = {
  branch: null,
  data: null,
  qty: {} // "categoryIdx-itemIdx" -> number
};

const STORAGE_KEY = "mojos_order_draft_v1";

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
    qty: state.qty
  }));
}

function loadDraft() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const draft = JSON.parse(raw);
    if (draft.qty) state.qty = draft.qty;
    if (draft.branch) {
      const b = CONFIG.branches.find(b => b.id === draft.branch);
      if (b) state.branch = b;
    }
  } catch (e) { /* ignore corrupt draft */ }
}

function itemKey(catIdx, itemIdx) { return catIdx + "-" + itemIdx; }

function totalItemsSelected() {
  return Object.values(state.qty).filter(v => v > 0).length;
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

    const header = document.createElement("button");
    header.className = "category-header";
    header.innerHTML = `<span>${cat.name} <span class="meta">(${cat.items.length})</span></span><span class="chev">&#9662;</span>`;
    header.addEventListener("click", () => {
      catEl.classList.toggle("open");
    });

    const body = document.createElement("div");
    body.className = "category-body";

    cat.items.forEach((item, ii) => {
      const key = itemKey(ci, ii);
      const row = document.createElement("div");
      row.className = "item-row";
      row.dataset.key = key;

      row.innerHTML = `
        <div class="item-info">
          <div class="item-name">${item.name}</div>
          <div class="item-sub">${item.unit} &middot; ${item.price ? "฿" + item.price : ""}</div>
        </div>
        <div class="stepper">
          <button type="button" class="dec" aria-label="decrease">&minus;</button>
          <input type="number" inputmode="numeric" min="0" value="${state.qty[key] || 0}">
          <button type="button" class="inc" aria-label="increase">&plus;</button>
        </div>
      `;

      const input = $("input", row);
      const dec = $(".dec", row);
      const inc = $(".inc", row);

      function setQty(v) {
        v = Math.max(0, Math.floor(Number(v) || 0));
        input.value = v;
        if (v > 0) { state.qty[key] = v; row.classList.add("has-qty"); }
        else { delete state.qty[key]; row.classList.remove("has-qty"); }
        saveDraft();
        updateBottomBar();
      }

      dec.addEventListener("click", () => setQty((Number(input.value) || 0) - 1));
      inc.addEventListener("click", () => setQty((Number(input.value) || 0) + 1));
      input.addEventListener("change", () => setQty(input.value));

      if (state.qty[key] > 0) row.classList.add("has-qty");
      body.appendChild(row);
    });

    catEl.appendChild(header);
    catEl.appendChild(body);
    content.appendChild(catEl);
  });

  updateBottomBar();
}

function updateBottomBar() {
  const n = totalItemsSelected();
  $("#selectedCount").textContent = n;
  $("#reviewBtn").disabled = n === 0;
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
      .filter(({ key }) => state.qty[key] > 0);
    if (rows.length === 0) return;

    const catBlock = document.createElement("div");
    catBlock.className = "review-cat";
    catBlock.innerHTML = `<h3>${cat.name}</h3>`;
    rows.forEach(({ item, key }) => {
      const row = document.createElement("div");
      row.className = "review-item";
      row.innerHTML = `<span>${item.name}</span><span class="qty">x${state.qty[key]} ${item.unit}</span>`;
      catBlock.appendChild(row);
    });
    list.appendChild(catBlock);
  });
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
      .filter(({ key }) => state.qty[key] > 0);
    if (rows.length === 0) return;
    lines.push(`${cat.name.toUpperCase()}`);
    rows.forEach(({ item, key }) => {
      lines.push(`  - ${item.name} : ${state.qty[key]} ${item.unit}`);
    });
    lines.push("");
  });

  lines.push(`Total line items: ${totalItemsSelected()}`);
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
  state.qty = {};
  state.branch = null;
  localStorage.removeItem(STORAGE_KEY);
  showScreen("branchScreen");
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
  $("#searchInput").addEventListener("input", e => filterItems(e.target.value));

  if (state.branch) {
    renderOrderScreen();
    showScreen("orderScreen");
  } else {
    showScreen("branchScreen");
  }
}

init();
