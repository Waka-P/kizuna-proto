const {
  ensureUser,
  loadState,
  renderHeaderHtml,
  renderBottomNavHtml,
  getSupplyReservationSummary,
  getItemDisplayName,
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

const root = document.getElementById("appView");
root.classList.remove("hidden");
root.innerHTML = `
  ${renderHeaderHtml(user, pageTitle)}

  <section class="board-section-container board-list-page">
    <a class="detail-page-back" href="./board.html"><span>&lang;</span>戻る</a>
    <article class="post-feed-hero" aria-label="投稿一覧の案内">
      <div class="post-feed-hero-icon" aria-hidden="true">
        <span class="material-symbols-outlined">overview</span>
      </div>
      <div class="post-feed-hero-copy">
        <p class="post-feed-hero-eyebrow">POST FEED</p>
        <h2>${boardTitle}</h2>
      </div>
    </article>
    <div id="boardList" class="list"></div>
  </section>

  ${renderBottomNavHtml("board", user)}
`;

const boardRoot = document.getElementById("boardList");
if (!boardItems.length) {
  boardRoot.innerHTML = `
    <article class="card post-feed-empty">
      <span class="material-symbols-outlined" aria-hidden="true">forum</span>
      <p class="sub">投稿がまだありません</p>
    </article>
  `;
} else {
  boardRoot.innerHTML = boardItems
    .map((item) => {
      const supplySummary = boardItemType === "supply" ? getSupplyReservationSummary(state, item) : null;
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
