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

  clearSentDraft("email");
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
    clearSentDraft("copy");
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
  $("#excelReviewBtn").addEventListener("click", () => sendFile("excel"));
  $("#pdfReviewBtn").addEventListener("click", () => sendFile("pdf"));
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
  $("#excelConfirmBtn").addEventListener("click", () => sendFile("excel"));
  $("#pdfConfirmBtn").addEventListener("click", () => sendFile("pdf"));
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
