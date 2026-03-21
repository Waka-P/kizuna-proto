const {
  ensureUser,
  loadState,
  saveState,
  uid,
  CATEGORIES,
  renderBottomNavHtml,
  extractPositiveInteger,
  getSupplyReservationSummary,
  getItemDisplayName,
  getItemQuantityNumber,
  getItemQuantityUnit,
  formatItemQuantity,
  escapeHtml,
  formatDate,
} = window.KizunaShared;

const UNIT_OPTIONS = ["kg", "g", "個", "本", "袋", "箱", "L", "ml", "食分", "セット", "ダース"];

const user = ensureUser("./index.html");
if (!user) {
  throw new Error("User not found");
}

const params = new URLSearchParams(location.search);
const type = params.get("type") === "supply" ? "supply" : "need";
const id = params.get("id");
const from = params.get("from");
const modeButtonClass = user.mode === "KITCHEN" ? "kitchen-bg" : "provider-bg";
const backHrefFromOrigin = from === "board-my-posts" ? "./board-my-posts.html" : from === "board-list" ? "./board-list.html" : null;

function renderDetailHeaderHtml(title) {
  return `
    <header class="header-row">
      <div>
        <h1>${escapeHtml(title || "きずな〇〇")}</h1>
      </div>
    </header>
  `;
}

function renderSupplyRequestModalHtml(summary) {
  const remainingAmount = summary.remainingCount;
  return `
    <div class="modal" id="supplyRequestModal" aria-hidden="true">
      <div class="modal-content supply-request-modal" role="dialog" aria-modal="true" aria-labelledby="supplyRequestHeading">
        <h3 id="supplyRequestHeading">必要な数量を送る</h3>
        <p class="sub">残り${escapeHtml(String(remainingAmount))}</p>
        <form id="supplyRequestForm" class="supply-request-form">
          <label>
            必要数量
            <input id="supplyRequestAmount" type="number" min="1" max="${escapeHtml(String(remainingAmount))}" placeholder="1" />
          </label>
          <p id="supplyRequestError" class="error hidden"></p>
          <div class="detail-actions-row">
            <button type="submit" class="btn kitchen-bg">送信する</button>
            <button type="button" id="closeSupplyRequestBtn" class="ghost">キャンセル</button>
          </div>
        </form>
      </div>
    </div>
  `;
}

const root = document.getElementById("appView");
root.classList.remove("hidden");

function formatSupplyQuantityForViewer(item, summary, isOwnPost) {
  if (!summary) return formatItemQuantity(item);

  const unit = getItemQuantityUnit(item);
  const unitText = unit || "";
  const remainingText = summary.remainingCount === null ? "残り-" : `残り${summary.remainingCount}${unitText}`;

  if (!isOwnPost) {
    return remainingText;
  }

  const maxText = summary.maxCount === null ? "-" : String(summary.maxCount);
  const ratioText = `${summary.plannedCount}/${maxText}${unitText}`;
  return summary.remainingCount === null ? ratioText : `${ratioText}（残り${summary.remainingCount}${unitText}）`;
}

function getBackHref(isOwnPost) {
  if (backHrefFromOrigin) {
    return backHrefFromOrigin;
  }
  return isOwnPost ? "./board-my-posts.html" : "./board-list.html";
}

function renderPage(editMode = false) {
  const state = loadState();
  const source = type === "supply" ? state.supplies : state.needs;
  const itemIndex = source.findIndex((entry) => entry.id === id);
  const item = itemIndex >= 0 ? source[itemIndex] : null;

  if (!item) {
    const missingBackHref = backHrefFromOrigin || "./board-list.html";
    root.innerHTML = `
      ${renderDetailHeaderHtml("投稿詳細")}
      <section>
        <a class="ghost detail-page-back" href="${missingBackHref}">一覧へ戻る</a>
        <article class="card">
          <p class="sub">投稿が見つかりませんでした。</p>
        </article>
      </section>
      ${renderBottomNavHtml("board", user)}
    `;
    return;
  }

  const isOwnPost = item.author === user.displayName;
  const supplySummary = type === "supply" ? getSupplyReservationSummary(state, item) : null;
  const quantityText = type === "supply"
    ? formatSupplyQuantityForViewer(item, supplySummary, isOwnPost)
    : formatItemQuantity(item);
  const canSendSupplyRequest = !isOwnPost && user.mode === "KITCHEN" && type === "supply";
  const supplyAmountLimit = canSendSupplyRequest ? supplySummary.maxCount : null;
  const supplyRemainingAmount = canSendSupplyRequest ? supplySummary.remainingCount : null;
  const backHref = getBackHref(isOwnPost);
  const authorInitial = (item.author || "?").slice(0, 1);

  if (isOwnPost && editMode) {
    const quantityAmount = getItemQuantityNumber(item);
    const quantityUnit = getItemQuantityUnit(item);

    root.innerHTML = `
      ${renderDetailHeaderHtml("投稿編集")}

      <section>
        <a class="ghost detail-page-back" href="${backHref}">一覧へ戻る</a>
        <form class="card" id="editPostForm">
          <h2>自分の投稿を編集</h2>
          <label>物資名<input id="editItemName" value="${escapeHtml(getItemDisplayName(item))}" required /></label>
          <label>数量
            <div class="quantity-input-row">
              <input id="editQuantityAmount" type="number" min="1" step="1" inputmode="numeric" value="${escapeHtml(quantityAmount ? String(quantityAmount) : "")}" required />
              <input id="editQuantityUnit" list="editQtyUnitOptions" value="${escapeHtml(quantityUnit)}" placeholder="単位" required />
            </div>
            <datalist id="editQtyUnitOptions">
              ${UNIT_OPTIONS.map((unit) => `<option value="${unit}"></option>`).join("")}
            </datalist>
          </label>
          <label>カテゴリ
            <select id="editCategory" required>
              ${CATEGORIES.map((category) => `<option value="${category}" ${item.category === category ? "selected" : ""}>${category}</option>`).join("")}
            </select>
          </label>
          <label>エリア<input id="editArea" value="${escapeHtml(item.area || "")}" required /></label>
          <label>メモ<textarea id="editNote" rows="4">${escapeHtml(item.note || "")}</textarea></label>
          <p id="editError" class="error hidden"></p>
          <div class="detail-actions-row">
            <button type="submit" class="btn ${modeButtonClass}">保存</button>
            <button type="button" id="cancelEditBtn" class="ghost">キャンセル</button>
          </div>
        </form>
      </section>

      ${renderBottomNavHtml("board", user)}
    `;

    document.getElementById("editPostForm").addEventListener("submit", (e) => {
      e.preventDefault();

      const itemName = document.getElementById("editItemName").value.trim();
      const quantityAmountRaw = document.getElementById("editQuantityAmount").value.trim();
      const quantityAmount = Number.parseInt(quantityAmountRaw, 10);
      const quantityUnit = document.getElementById("editQuantityUnit").value.trim();
      const category = document.getElementById("editCategory").value;
      const area = document.getElementById("editArea").value.trim();
      const note = document.getElementById("editNote").value.trim();
      const editErr = document.getElementById("editError");

      if (!itemName) {
        editErr.textContent = "物資名を入力してください";
        editErr.classList.remove("hidden");
        return;
      }

      if (!Number.isFinite(quantityAmount) || quantityAmount <= 0) {
        editErr.textContent = "数量は1以上の数値で入力してください";
        editErr.classList.remove("hidden");
        return;
      }

      if (!quantityUnit) {
        editErr.textContent = "数量の単位を入力してください";
        editErr.classList.remove("hidden");
        return;
      }

      if (!category) {
        editErr.textContent = "カテゴリを選択してください";
        editErr.classList.remove("hidden");
        return;
      }

      if (!area) {
        editErr.textContent = "エリアを入力してください";
        editErr.classList.remove("hidden");
        return;
      }

      editErr.classList.add("hidden");
      editErr.textContent = "";

      source[itemIndex] = {
        ...item,
        itemName,
        title: itemName,
        quantityAmount,
        quantityUnit,
        quantity: quantityUnit ? `${quantityAmount} ${quantityUnit}` : String(quantityAmount),
        category,
        area,
        note,
      };

      saveState(state);
      renderPage(false);
    });

    document.getElementById("cancelEditBtn").addEventListener("click", () => {
      renderPage(false);
    });

    return;
  }

  root.innerHTML = `
    ${renderDetailHeaderHtml("投稿詳細")}

    <section class="post-detail-page">
      <a class="ghost detail-page-back" href="${backHref}">一覧へ戻る</a>
      <article class="card detail-card-emphasis">
        <div class="detail-headline">
          <div class="detail-title-stack">
            <p class="detail-kind-label">${type === "supply" ? "余剰物資" : "ニーズ"}</p>
            <h2>${escapeHtml(getItemDisplayName(item) || "未指定")}</h2>
          </div>
          <span class="chip detail-category-chip">${escapeHtml(item.category || "未分類")}</span>
        </div>

        <div class="detail-facts-grid">
          <div class="detail-fact-block">
            <strong>${escapeHtml(quantityText)}</strong>
          </div>
          <div class="area-block">
            <strong>${escapeHtml(item.area || "未設定")}</strong>
          </div>
        </div>

        ${item.note
          ? `
            <section class="detail-note-section" aria-label="投稿メモ">
              <h3>メモ</h3>
              <p>${escapeHtml(item.note)}</p>
            </section>
          `
          : ""}

        <div class="detail-meta-line${isOwnPost ? " detail-meta-line-own" : ""}">
          ${isOwnPost ? "" : `<div class="meta-author"><span class="author-icon" aria-hidden="true">${escapeHtml(authorInitial)}</span><span>${escapeHtml(item.author)}</span></div>`}
          <div class="detail-meta-date">${formatDate(item.createdAt)}</div>
        </div>
        ${isOwnPost
          ? ""
          : `
            <div class="detail-contact-row detail-card-chat">
              ${canSendSupplyRequest
                ? `<button type="button" id="openSupplyRequestBtn" class="btn kitchen-bg" ${supplyAmountLimit && supplyRemainingAmount > 0 ? "" : "disabled"}>必要数を送る</button>`
                : ""}
              <a class="btn ${modeButtonClass} detail-chat-btn" href="./chat-room.html?partner=${encodeURIComponent(item.author)}">チャット</a>
            </div>
            ${canSendSupplyRequest && !supplyAmountLimit
              ? '<p class="sub">提供数量に数字が含まれていないため、必要数の送信ができません。</p>'
              : canSendSupplyRequest && supplyRemainingAmount === 0
                ? '<p class="sub">提供予定が上限に達しているため、リクエストできません。</p>'
              : ""}
          `}
      </article>

      ${isOwnPost
        ? `
          <article class="detail-actions-card">
            <div class="detail-actions-row">
              <button id="editPostBtn" class="btn provider-bg" type="button">編集</button>
              <button id="deletePostBtn" class="btn danger-btn" type="button">削除</button>
            </div>
          </article>
        `
        : ""}
    </section>

      ${canSendSupplyRequest && supplyAmountLimit && supplyRemainingAmount > 0 ? renderSupplyRequestModalHtml(supplySummary) : ""}

    ${renderBottomNavHtml("board", user)}
  `;

  if (isOwnPost) {
    document.getElementById("editPostBtn").addEventListener("click", () => {
      renderPage(true);
    });

    document.getElementById("deletePostBtn").addEventListener("click", () => {
      if (!confirm("この投稿を削除します。よろしいですか？")) return;

      source.splice(itemIndex, 1);
      saveState(state);
      location.href = "./board.html";
    });
    return;
  }

  if (canSendSupplyRequest && supplyAmountLimit && supplyRemainingAmount > 0) {
    const modal = document.getElementById("supplyRequestModal");
    const openBtn = document.getElementById("openSupplyRequestBtn");
    const closeBtn = document.getElementById("closeSupplyRequestBtn");
    const amountInput = document.getElementById("supplyRequestAmount");
    const errorEl = document.getElementById("supplyRequestError");
    const form = document.getElementById("supplyRequestForm");

    function closeModal() {
      modal.classList.remove("open");
      modal.setAttribute("aria-hidden", "true");
      errorEl.classList.add("hidden");
      errorEl.textContent = "";
    }

    openBtn.addEventListener("click", () => {
      modal.classList.add("open");
      modal.setAttribute("aria-hidden", "false");
      amountInput.value = "";
      errorEl.classList.add("hidden");
      errorEl.textContent = "";
      amountInput.focus();
    });

    closeBtn.addEventListener("click", closeModal);

    modal.addEventListener("click", (event) => {
      if (event.target === modal) {
        closeModal();
      }
    });

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const amount = extractPositiveInteger(amountInput.value);

      if (!amount) {
        errorEl.textContent = "数量は1以上で入力してください。";
        errorEl.classList.remove("hidden");
        return;
      }

      if (amount > supplyRemainingAmount) {
        errorEl.textContent = `残りは${supplyRemainingAmount}です。`;
        errorEl.classList.remove("hidden");
        return;
      }

      const latestState = loadState();
      const latestSupply = latestState.supplies.find((entry) => entry.id === item.id);
      if (!latestSupply) {
        errorEl.textContent = "投稿が見つかりません。画面を更新してください。";
        errorEl.classList.remove("hidden");
        return;
      }

      const latestSummary = getSupplyReservationSummary(latestState, latestSupply);
      if (latestSummary.remainingCount === null || amount > latestSummary.remainingCount) {
        errorEl.textContent = `現在の残りは${latestSummary.remainingCount ?? "-"}です。再入力してください。`;
        errorEl.classList.remove("hidden");
        return;
      }

      latestState.messages.push({
        id: uid("msg"),
        type: "supply_request",
        sender: user.displayName,
        receiver: item.author,
        text: "",
        attachment: null,
        request: {
          postId: item.id,
          postType: type,
          itemTitle: getItemDisplayName(latestSupply),
          amount,
          maxAmount: latestSummary.maxCount,
          status: "pending",
        },
        createdAt: new Date().toISOString(),
      });

      saveState(latestState);
      closeModal();
      location.href = `./chat-room.html?partner=${encodeURIComponent(item.author)}`;
    });
  }
}

renderPage(false);
