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
    <div id="boardList" class="list"></div>
  </section>

  ${renderBottomNavHtml("board", user)}
`;

const boardRoot = document.getElementById("boardList");
if (!boardItems.length) {
  boardRoot.innerHTML = `<p class="sub">投稿がまだありません</p>`;
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
          <strong class="list-item-title">${escapeHtml(getItemDisplayName(item) || "未指定")}</strong>
          <span class="chip list-item-category-chip">${escapeHtml(item.category || "未分類")}</span>
        </div>
        <div class="list-item-facts">
          <span class="list-fact-pill">${escapeHtml(quantityText)}</span>
          <span class="list-fact-pill">${escapeHtml(item.area || "未設定")}</span>
        </div>
        ${boardItemType === "supply" && item.gratitudeRequest
          ? `<p class="list-note-preview">希望するお礼: ${escapeHtml(item.gratitudeRequest)}</p>`
          : ""}
        ${item.note ? `<p class="list-note-preview">${escapeHtml(item.note)}</p>` : ""}
      `;

      const cardHtml = `
        <article class="list-item list-item-compact">
          ${isOwnPost
            ? detailBodyHtml
            : `<a class="list-item-main-link" href="${detailHref}">${detailBodyHtml}</a>`}
          <div class="list-meta-line${isOwnPost ? " list-meta-line-own" : ""}">
            ${isOwnPost
              ? ""
              : `
                <a class="meta-author meta-author-link" href="${userDetailHref}">
                  <span class="author-icon" aria-hidden="true">${escapeHtml(authorInitial)}</span>
                  <span>${escapeHtml(item.author)}</span>
                </a>
              `}
            <div class="list-meta-date">${formatDate(item.createdAt)}</div>
          </div>
        </article>
      `;

      return cardHtml;
    })
    .join("");
}
