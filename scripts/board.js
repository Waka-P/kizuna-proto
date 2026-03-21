const {
  ensureUser,
  renderHeaderHtml,
  renderBottomNavHtml,
} = window.KizunaShared;

const user = ensureUser("./index.html");
if (!user) {
  throw new Error("User not found");
}

const boardListLabel = user.mode === "KITCHEN" ? "余剰物資一覧" : "子ども食堂掲示板";
const ownModeClass = user.mode === "KITCHEN" ? "kitchen" : "provider";
const boardListModeClass = user.mode === "KITCHEN" ? "provider" : "kitchen";

const root = document.getElementById("appView");
root.classList.remove("hidden");
root.innerHTML = `
  ${renderHeaderHtml(user, "きずな〇〇")}

  <section class="board-menu-container" aria-label="一覧ページリンク">
    <div class="board-menu-stack">
      <a class="board-menu-link board-menu-link-${boardListModeClass}" href="./board-list.html">
        <span class="board-menu-link-main">${boardListLabel}</span>
        <span class="board-menu-link-sub">投稿一覧を表示</span>
      </a>
      <a class="board-menu-link board-menu-link-${ownModeClass}" href="./board-my-posts.html">
        <span class="board-menu-link-main">自分の投稿</span>
        <span class="board-menu-link-sub">自分の投稿一覧を表示</span>
      </a>
    </div>
  </section>

  ${renderBottomNavHtml("board", user)}
`;
