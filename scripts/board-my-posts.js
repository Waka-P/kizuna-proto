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

  <section class="board-section-container board-list-page my-posts-page">
    <a class="detail-page-back" href="./board.html"><span>&lang;</span>戻る</a>
    <article class="post-feed-hero" aria-label="自分の投稿の案内">
      <div class="post-feed-hero-icon" aria-hidden="true">
        <span class="material-symbols-outlined">edit_square</span>
      </div>
      <div class="post-feed-hero-copy">
        <p class="post-feed-hero-eyebrow">MY POSTS</p>
        <h2>自分の投稿</h2>
      </div>
    </article>
    <div id="myPostList" class="list"></div>
  </section>

  ${renderBottomNavHtml("board", user)}
`;

const myPostRoot = document.getElementById("myPostList");
if (!ownPosts.length) {
  myPostRoot.innerHTML = `
    <article class="card post-feed-empty">
      <span class="material-symbols-outlined" aria-hidden="true">draft</span>
      <p class="sub">まだ自分の投稿はありません</p>
    </article>
  `;
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
            ${item.note ? `<p class="list-note-preview">${escapeHtml(item.note)}</p>` : ""}
            <div class="list-meta-line list-meta-line-own">
              <div class="list-meta-date"><span class="material-symbols-outlined" aria-hidden="true">schedule</span>${formatDate(item.createdAt)}</div>
            </div>
          </article>
        </a>
      `;
    })
    .join("");
}
