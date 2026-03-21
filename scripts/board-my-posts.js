const {
  ensureUser,
  loadState,
  renderHeaderHtml,
  renderBottomNavHtml,
  getSupplyReservationSummary,
  getItemDisplayName,
  getItemQuantityUnit,
  formatItemQuantity,
  escapeHtml,
  formatDate,
} = window.KizunaShared;

const user = ensureUser("./index.html");
if (!user) {
  throw new Error("User not found");
}

const state = loadState();
const ownPosts = (user.mode === "KITCHEN" ? state.needs : state.supplies)
  .filter((item) => item.author === user.displayName);
const ownType = user.mode === "KITCHEN" ? "need" : "supply";

function formatSupplyQuantityForOwner(item, summary) {
  if (!summary) return formatItemQuantity(item);

  const unit = getItemQuantityUnit(item);
  const unitText = unit || "";
  const maxText = summary.maxCount === null ? "-" : String(summary.maxCount);
  const ratioText = `${summary.plannedCount}/${maxText}${unitText}`;

  if (summary.remainingCount === null) {
    return ratioText;
  }

  return `${ratioText}（残り${summary.remainingCount}${unitText}）`;
}

const root = document.getElementById("appView");
root.classList.remove("hidden");
root.innerHTML = `
  ${renderHeaderHtml(user, "自分の投稿")}

  <section class="board-section-container board-list-page">
    <a class="detail-page-back" href="./board.html">戻る</a>
    <div id="myPostList" class="list"></div>
  </section>

  ${renderBottomNavHtml("board", user)}
`;

const myPostRoot = document.getElementById("myPostList");
if (!ownPosts.length) {
  myPostRoot.innerHTML = `<p class="sub">まだ自分の投稿はありません</p>`;
} else {
  myPostRoot.innerHTML = ownPosts
    .map((item) => {
      const supplySummary = ownType === "supply" ? getSupplyReservationSummary(state, item) : null;
      const quantityText = ownType === "supply"
        ? formatSupplyQuantityForOwner(item, supplySummary)
        : formatItemQuantity(item);
      const detailHref = `./post-detail.html?type=${ownType}&id=${encodeURIComponent(item.id)}&from=board-my-posts`;
      return `
        <a class="list-item-link" href="${detailHref}">
          <article class="list-item list-item-compact">
            <div class="row list-item-top-row">
              <strong class="list-item-title">${escapeHtml(getItemDisplayName(item) || "未指定")}</strong>
              <span class="chip list-item-category-chip">${escapeHtml(item.category || "未分類")}</span>
            </div>
            <div class="list-item-facts">
              <span class="list-fact-pill">${escapeHtml(quantityText)}</span>
              <span class="list-fact-pill">${escapeHtml(item.area || "未設定")}</span>
            </div>
            ${item.note ? `<p class="list-note-preview">${escapeHtml(item.note)}</p>` : ""}
            <div class="list-meta-line list-meta-line-own">
              <div class="list-meta-date">${formatDate(item.createdAt)}</div>
            </div>
          </article>
        </a>
      `;
    })
    .join("");
}
