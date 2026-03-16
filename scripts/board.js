const {
  ensureUser,
  loadState,
  renderHeaderHtml,
  renderBottomNavHtml,
  escapeHtml,
  formatDate,
} = window.KizunaShared;

const user = ensureUser("./index.html");
if (!user) {
  throw new Error("User not found");
}

const state = loadState();
const boardItems = user.mode === "KITCHEN" ? state.supplies : state.needs;
const ownPosts = (user.mode === "KITCHEN" ? state.needs : state.supplies)
  .filter((item) => item.author === user.displayName);
const boardTitle = user.mode === "KITCHEN" ? "余剰物資一覧" : "子ども食堂掲示板";
const sectionBoardLabel = user.mode === "KITCHEN" ? "余剰物資一覧" : "子ども食堂掲示板";
const boardTabColorClass = user.mode === "KITCHEN" ? "tab-blue" : "tab-red";
const myPostsTabColorClass = user.mode === "KITCHEN" ? "tab-red" : "tab-blue";

const root = document.getElementById("appView");
root.classList.remove("hidden");
root.innerHTML = `
  ${renderHeaderHtml(user, "きずな〇〇")}

  <section class="board-section-container">
    <div class="section-tabs" role="tablist" aria-label="一覧切替">
      <button id="tabBoard" class="section-tab ${boardTabColorClass} active" type="button" role="tab" aria-selected="true">${sectionBoardLabel}</button>
      <button id="tabMyPosts" class="section-tab ${myPostsTabColorClass}" type="button" role="tab" aria-selected="false">自分の投稿</button>
    </div>

    <div id="sectionBoard" class="board-section">
      <div id="boardList" class="list"></div>
    </div>
    <div id="sectionMyPosts" class="board-section hidden">
      <div id="myPostList" class="list"></div>
    </div>
  </section>

  ${renderBottomNavHtml("board", user)}
`;

const boardRoot = document.getElementById("boardList");
if (!boardItems.length) {
  boardRoot.innerHTML = `<p class="sub">投稿がまだありません</p>`;
} else {
  const boardItemType = user.mode === "KITCHEN" ? "supply" : "need";
  boardRoot.innerHTML = boardItems
    .map((item) => {
      const cardHtml = `
        <article class="list-item">
          <div class="row">
            <strong>${escapeHtml(item.title)}</strong>
            <span class="chip">${user.mode === "KITCHEN" ? "余剰物資" : "ニーズ"}</span>
          </div>
          <p>カテゴリ: ${escapeHtml(item.category)}</p>
          <p>数量: ${escapeHtml(item.quantity || "未指定")}</p>
          <p>エリア: ${escapeHtml(item.area || "未設定")}</p>
          ${item.note ? `<p>メモ: ${escapeHtml(item.note)}</p>` : ""}
          <small>投稿者: ${escapeHtml(item.author)} / ${formatDate(item.createdAt)}</small>
        </article>
      `;

      if (item.author === user.displayName) {
        return cardHtml;
      }

      const detailHref = `./post-detail.html?type=${boardItemType}&id=${encodeURIComponent(item.id)}`;
      return `<a class="list-item-link" href="${detailHref}">${cardHtml}</a>`;
    })
    .join("");
}

const myPostRoot = document.getElementById("myPostList");
if (!ownPosts.length) {
  myPostRoot.innerHTML = `<p class="sub">まだ自分の投稿はありません</p>`;
} else {
  const ownType = user.mode === "KITCHEN" ? "need" : "supply";
  myPostRoot.innerHTML = ownPosts
    .map((item) => {
      const detailHref = `./post-detail.html?type=${ownType}&id=${encodeURIComponent(item.id)}`;
      return `
        <a class="list-item-link" href="${detailHref}">
          <article class="list-item">
            <div class="row">
              <strong>${escapeHtml(item.title)}</strong>
              <span class="chip">${user.mode === "KITCHEN" ? "ニーズ" : "余剰物資"}</span>
            </div>
            <p>カテゴリ: ${escapeHtml(item.category)}</p>
            <p>数量: ${escapeHtml(item.quantity || "未指定")}</p>
            <p>エリア: ${escapeHtml(item.area || "未設定")}</p>
            ${item.note ? `<p>メモ: ${escapeHtml(item.note)}</p>` : ""}
            <small>${formatDate(item.createdAt)}</small>
          </article>
        </a>
      `;
    })
    .join("");
}

const tabBoard = document.getElementById("tabBoard");
const tabMyPosts = document.getElementById("tabMyPosts");
const sectionBoard = document.getElementById("sectionBoard");
const sectionMyPosts = document.getElementById("sectionMyPosts");

function activateSection(section) {
  const showBoard = section === "board";

  sectionBoard.classList.toggle("hidden", !showBoard);
  sectionMyPosts.classList.toggle("hidden", showBoard);

  tabBoard.classList.toggle("active", showBoard);
  tabMyPosts.classList.toggle("active", !showBoard);

  tabBoard.setAttribute("aria-selected", showBoard ? "true" : "false");
  tabMyPosts.setAttribute("aria-selected", showBoard ? "false" : "true");
}

tabBoard.addEventListener("click", () => activateSection("board"));
tabMyPosts.addEventListener("click", () => activateSection("myPosts"));
