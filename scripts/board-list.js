const {
  ensureUser,
  loadState,
  CATEGORIES,
  renderHeaderHtml,
  renderBottomNavHtml,
  getSupplyReservationSummary,
  getItemDisplayName,
  getItemQuantityNumber,
  getItemQuantityUnit,
  formatItemQuantity,
  isBlockedEither,
  escapeHtml,
  formatDate,
} = window.KizunaShared;

const user = ensureUser("./index.html");
if (!user) {
  throw new Error("User not found");
}

const state = loadState();
const boardItems = (user.mode === "KITCHEN" ? state.supplies : state.needs)
  .filter((item) => item.author === user.displayName || !isBlockedEither(state, user.displayName, item.author));
const boardItemType = user.mode === "KITCHEN" ? "supply" : "need";
const boardTitle = user.mode === "KITCHEN" ? "余剰物資一覧" : "子ども食堂掲示板";
const pageTitle = `${boardTitle}`;
const modeButtonClass = user.mode === "KITCHEN" ? "kitchen-bg" : "provider-bg";

const filterState = {
  category: "all",
  trade: "all",
  keyword: "",
};

const sortState = {
  order: "newest",
};

const SORT_LABELS = {
  newest: "新しい順",
  oldest: "古い順",
  quantity_desc: "数量が多い順",
};

const supplySummaryById = new Map();

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

function getSupplySummary(item) {
  if (boardItemType !== "supply") return null;
  if (!item?.id) return null;
  if (supplySummaryById.has(item.id)) {
    return supplySummaryById.get(item.id);
  }
  const summary = getSupplyReservationSummary(state, item);
  supplySummaryById.set(item.id, summary);
  return summary;
}

function isSupplyInTransaction(item) {
  const summary = getSupplySummary(item);
  if (!summary) return false;
  return summary.plannedCount > 0;
}

function getFilteredBoardItems() {
  const keyword = filterState.keyword.trim().toLowerCase();

  return boardItems.filter((item) => {
    if (filterState.category !== "all" && (item.category || "") !== filterState.category) {
      return false;
    }

    if (boardItemType === "supply") {
      const inTransaction = isSupplyInTransaction(item);
      if (filterState.trade === "in_progress" && !inTransaction) {
        return false;
      }
      if (filterState.trade === "open" && inTransaction) {
        return false;
      }
    }

    if (!keyword) {
      return true;
    }

    const text = [
      getItemDisplayName(item),
      item.category,
      item.area,
      item.note,
      item.author,
      item.gratitudeRequest,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return text.includes(keyword);
  });
}

function getSortedBoardItems(items) {
  const list = [...items];

  if (sortState.order === "oldest") {
    return list.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }

  if (sortState.order === "quantity_desc") {
    return list.sort((a, b) => {
      const aQuantity = getItemQuantityNumber(a) || 0;
      const bQuantity = getItemQuantityNumber(b) || 0;
      if (bQuantity !== aQuantity) {
        return bQuantity - aQuantity;
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }

  return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

function getActiveFilterCount() {
  let count = 0;
  if (filterState.category !== "all") count += 1;
  if (boardItemType === "supply" && filterState.trade !== "all") count += 1;
  if (filterState.keyword.trim()) count += 1;
  return count;
}

function getFilterSummaryText() {
  const parts = [`${SORT_LABELS[sortState.order] || SORT_LABELS.newest}`];

  if (filterState.category !== "all") {
    parts.push(`カテゴリ: ${filterState.category}`);
  }

  if (boardItemType === "supply") {
    if (filterState.trade === "in_progress") {
      parts.push("取引状況: 取引中のみ");
    } else if (filterState.trade === "open") {
      parts.push("取引状況: 募集中のみ");
    }
  }

  if (filterState.keyword.trim()) {
    parts.push(`キーワード: ${filterState.keyword.trim()}`);
  }

  return parts.join(" / ");
}

function syncFilterUI() {
  const filterBtn = document.getElementById("openBoardFilterBtn");
  const sortBtn = document.getElementById("openBoardSortBtn");
  const summaryEl = document.getElementById("boardFilterSummary");
  const activeCount = getActiveFilterCount();

  if (filterBtn) {
    filterBtn.classList.toggle("has-active-filters", activeCount > 0);
    filterBtn.setAttribute("data-active-count", activeCount > 0 ? String(activeCount) : "");
    filterBtn.setAttribute("aria-label", activeCount > 0 ? `フィルター（${activeCount}件適用中）` : "フィルター");
    filterBtn.setAttribute("title", activeCount > 0 ? `フィルター（${activeCount}件適用中）` : "フィルター");
  }

  if (sortBtn) {
    const sortLabel = SORT_LABELS[sortState.order] || SORT_LABELS.newest;
    sortBtn.setAttribute("aria-label", `並べ替え: ${sortLabel}`);
    sortBtn.setAttribute("title", `並べ替え: ${sortLabel}`);
  }

  if (!summaryEl) return;
  const summaryText = getFilterSummaryText();
  if (!summaryText) {
    summaryEl.classList.add("hidden");
    summaryEl.textContent = "";
    return;
  }

  summaryEl.classList.remove("hidden");
  summaryEl.textContent = summaryText;
}

const root = document.getElementById("appView");
root.classList.remove("hidden");
root.innerHTML = `
  ${renderHeaderHtml(user, pageTitle)}

  <section class="board-section-container board-list-page">
    <a class="detail-page-back" href="./board.html"><span>&lang;</span>戻る</a>
    <article class="post-feed-hero board-list-hero" aria-label="投稿一覧の案内">
      <div class="post-feed-hero-icon" aria-hidden="true">
        <span class="material-symbols-outlined">overview</span>
      </div>
      <div class="post-feed-hero-copy">
        <p class="post-feed-hero-eyebrow">POST FEED</p>
        <h2>${boardTitle}</h2>
      </div>
      <div class="post-feed-hero-actions">
        <div class="board-sort-wrap">
          <button
            id="openBoardSortBtn"
            type="button"
            class="post-feed-icon-btn"
            aria-label="並べ替え"
            title="並べ替え"
            aria-haspopup="menu"
            aria-controls="boardSortDropdown"
            aria-expanded="false"
          >
            <span class="material-symbols-outlined" aria-hidden="true">swap_vert</span>
          </button>
          <div id="boardSortDropdown" class="board-sort-dropdown hidden" role="menu" aria-label="並べ替え">
            <button type="button" class="board-sort-option" data-sort="newest" role="menuitemradio" aria-checked="true">新しい順</button>
            <button type="button" class="board-sort-option" data-sort="oldest" role="menuitemradio" aria-checked="false">古い順</button>
            <button type="button" class="board-sort-option" data-sort="quantity_desc" role="menuitemradio" aria-checked="false">数量が多い順</button>
          </div>
        </div>
        <button
          id="openBoardFilterBtn"
          type="button"
          class="post-feed-icon-btn"
          aria-haspopup="dialog"
          aria-controls="boardFilterModal"
          aria-label="フィルター"
          title="フィルター"
          data-active-count=""
        >
          <span class="material-symbols-outlined" aria-hidden="true">tune</span>
        </button>
      </div>
    </article>
    <p id="boardFilterSummary" class="board-filter-summary hidden"></p>
    <div id="boardList" class="list"></div>
  </section>

  <div class="modal" id="boardFilterModal" aria-hidden="true">
    <div class="modal-content board-filter-modal" role="dialog" aria-modal="true" aria-labelledby="boardFilterHeading">
      <button id="closeBoardFilterBtn" type="button" class="board-filter-close" aria-label="閉じる">
        <span class="material-symbols-outlined" aria-hidden="true">close</span>
      </button>
      <h3 id="boardFilterHeading">投稿を絞り込む</h3>
      <form id="boardFilterForm" class="board-filter-form">
        <label>
          カテゴリ
          <select id="boardFilterCategory">
            <option value="all">すべて</option>
            ${CATEGORIES.map((category) => `<option value="${category}">${category}</option>`).join("")}
          </select>
        </label>
        ${boardItemType === "supply"
          ? `<label>
              取引状況
              <select id="boardFilterTrade">
                <option value="all">すべて</option>
                <option value="in_progress">取引中のみ</option>
                <option value="open">募集中のみ</option>
              </select>
            </label>`
          : ""}
        <label>
          キーワード
          <input id="boardFilterKeyword" placeholder="物資名・エリア・投稿者など" />
        </label>
        <div class="detail-actions-row board-filter-actions">
          <button id="resetBoardFilterBtn" type="button" class="cancel-btn ghost">リセット</button>
          <button type="submit" class="btn apply ${modeButtonClass}">適用</button>
        </div>
      </form>
    </div>
  </div>

  ${renderBottomNavHtml("board", user)}
`;

const boardRoot = document.getElementById("boardList");

function renderBoardList() {
  const filteredBoardItems = getSortedBoardItems(getFilteredBoardItems());

  if (!boardItems.length) {
    boardRoot.innerHTML = `
      <article class="card post-feed-empty">
        <span class="material-symbols-outlined" aria-hidden="true">forum</span>
        <p class="sub">投稿がまだありません</p>
      </article>
    `;
    return;
  }

  if (!filteredBoardItems.length) {
    boardRoot.innerHTML = `
      <article class="card post-feed-empty post-feed-empty-filtered">
        <span class="material-symbols-outlined" aria-hidden="true">filter_alt_off</span>
        <p class="sub">条件に一致する投稿がありません</p>
      </article>
    `;
    return;
  }

  boardRoot.innerHTML = filteredBoardItems
    .map((item) => {
      const supplySummary = getSupplySummary(item);
      const isOwnPost = item.author === user.displayName;
      const quantityText = boardItemType === "supply"
        ? formatSupplyQuantityForViewer(item, supplySummary, isOwnPost)
        : formatItemQuantity(item);
      const authorInitial = (item.author || "?").slice(0, 1);
      const detailHref = `./post-detail.html?type=${boardItemType}&id=${encodeURIComponent(item.id)}&from=board-list`;
      const userDetailHref = `./user-detail.html?name=${encodeURIComponent(item.author || "")}&from=board-list`;

      const detailBodyHtml = `
        <div class="row list-item-top-row">
          <div class="list-item-title-wrap">
            <span class="material-symbols-outlined list-item-title-icon" aria-hidden="true">inventory_2</span>
            <strong class="list-item-title">${escapeHtml(getItemDisplayName(item) || "未指定")}</strong>
          </div>
          <span class="chip list-item-category-chip">${escapeHtml(item.category || "未分類")}</span>
        </div>
        <div class="list-item-facts">
          <span class="list-fact-pill"><span class="material-symbols-outlined" aria-hidden="true">deployed_code</span>${escapeHtml(quantityText)}</span>
          <span class="list-fact-pill"><span class="material-symbols-outlined" aria-hidden="true">distance</span>${escapeHtml(item.area || "未設定")}</span>
          ${boardItemType === "supply" && isSupplyInTransaction(item)
            ? '<span class="list-fact-pill list-fact-pill-trading"><span class="material-symbols-outlined" aria-hidden="true">sync_alt</span>取引中</span>'
            : ""}
        </div>
        ${boardItemType === "supply" && item.gratitudeRequest
          ? `<p class="list-note-preview">希望するお礼: ${escapeHtml(item.gratitudeRequest)}</p>`
          : ""}
        ${item.note ? `<p class="list-note-preview">${escapeHtml(item.note)}</p>` : ""}
      `;

      const cardHtml = `
        <article class="list-item list-item-compact list-item-clickable" role="link" tabindex="0" data-detail-href="${detailHref}">
          ${detailBodyHtml}
          <div class="list-meta-line">
            <a class="meta-author meta-author-link" href="${userDetailHref}">
              <span class="author-icon" aria-hidden="true">${escapeHtml(authorInitial)}</span>
              <span>${escapeHtml(item.author)}</span>
            </a>
            <div class="list-meta-date"><span class="material-symbols-outlined" aria-hidden="true">schedule</span>${formatDate(item.createdAt)}</div>
          </div>
        </article>
      `;

      return cardHtml;
    })
    .join("");

  boardRoot.querySelectorAll(".list-item-clickable").forEach((itemEl) => {
    const moveToDetail = () => {
      const href = itemEl.getAttribute("data-detail-href");
      if (href) {
        window.location.href = href;
      }
    };

    itemEl.addEventListener("click", (event) => {
      if (event.target.closest("a")) {
        return;
      }
      moveToDetail();
    });

    itemEl.addEventListener("keydown", (event) => {
      if (event.target.closest("a")) {
        return;
      }
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        moveToDetail();
      }
    });
  });
}

const filterModal = document.getElementById("boardFilterModal");
const sortDropdown = document.getElementById("boardSortDropdown");
const openFilterBtn = document.getElementById("openBoardFilterBtn");
const openSortBtn = document.getElementById("openBoardSortBtn");
const closeFilterBtn = document.getElementById("closeBoardFilterBtn");
const filterForm = document.getElementById("boardFilterForm");
const filterCategorySelect = document.getElementById("boardFilterCategory");
const filterTradeSelect = document.getElementById("boardFilterTrade");
const filterKeywordInput = document.getElementById("boardFilterKeyword");
const resetFilterBtn = document.getElementById("resetBoardFilterBtn");

function closeSortDropdown() {
  if (!sortDropdown || !openSortBtn) return;
  sortDropdown.classList.add("hidden");
  openSortBtn.setAttribute("aria-expanded", "false");
}

function openSortDropdown() {
  if (!sortDropdown || !openSortBtn) return;
  sortDropdown.classList.remove("hidden");
  openSortBtn.setAttribute("aria-expanded", "true");
}

function syncSortDropdownUI() {
  if (!sortDropdown) return;
  sortDropdown.querySelectorAll(".board-sort-option").forEach((optionEl) => {
    const isActive = optionEl.getAttribute("data-sort") === sortState.order;
    optionEl.classList.toggle("active", isActive);
    optionEl.setAttribute("aria-checked", isActive ? "true" : "false");
  });
}

function openFilterModal() {
  if (!filterModal) return;
  if (filterCategorySelect) {
    filterCategorySelect.value = filterState.category;
  }
  if (filterTradeSelect) {
    filterTradeSelect.value = filterState.trade;
  }
  if (filterKeywordInput) {
    filterKeywordInput.value = filterState.keyword;
  }
  filterModal.classList.add("open");
  filterModal.setAttribute("aria-hidden", "false");
  filterCategorySelect?.focus();
}

function closeFilterModal() {
  if (!filterModal) return;
  filterModal.classList.remove("open");
  filterModal.setAttribute("aria-hidden", "true");
}

if (openFilterBtn) {
  openFilterBtn.addEventListener("click", () => {
    closeSortDropdown();
    openFilterModal();
  });
}

if (openSortBtn) {
  openSortBtn.addEventListener("click", () => {
    if (!sortDropdown || sortDropdown.classList.contains("hidden")) {
      openSortDropdown();
      return;
    }
    closeSortDropdown();
  });
}

if (sortDropdown) {
  sortDropdown.addEventListener("click", (event) => {
    const option = event.target.closest(".board-sort-option");
    if (!option) return;

    const nextOrder = option.getAttribute("data-sort") || "newest";
    sortState.order = SORT_LABELS[nextOrder] ? nextOrder : "newest";
    syncSortDropdownUI();
    syncFilterUI();
    renderBoardList();
    closeSortDropdown();
  });
}

if (closeFilterBtn) {
  closeFilterBtn.addEventListener("click", closeFilterModal);
}

if (filterModal) {
  filterModal.addEventListener("click", (event) => {
    if (event.target === filterModal) {
      closeFilterModal();
    }
  });
}

document.addEventListener("click", (event) => {
  if (!sortDropdown || !openSortBtn) return;
  const clickedSortArea = event.target.closest(".board-sort-wrap");
  if (!clickedSortArea) {
    closeSortDropdown();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeSortDropdown();
    closeFilterModal();
  }
});

if (filterForm) {
  filterForm.addEventListener("submit", (event) => {
    event.preventDefault();
    filterState.category = filterCategorySelect?.value || "all";
    filterState.trade = filterTradeSelect?.value || "all";
    filterState.keyword = filterKeywordInput?.value.trim() || "";

    closeFilterModal();
    syncFilterUI();
    renderBoardList();
  });
}

if (resetFilterBtn) {
  resetFilterBtn.addEventListener("click", () => {
    filterState.category = "all";
    filterState.trade = "all";
    filterState.keyword = "";

    if (filterCategorySelect) filterCategorySelect.value = "all";
    if (filterTradeSelect) filterTradeSelect.value = "all";
    if (filterKeywordInput) filterKeywordInput.value = "";

    syncFilterUI();
    renderBoardList();
  });
}

syncFilterUI();
syncSortDropdownUI();
renderBoardList();
