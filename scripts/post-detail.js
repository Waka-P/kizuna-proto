const {
  ensureUser,
  loadState,
  saveState,
  CATEGORIES,
  renderBottomNavHtml,
  escapeHtml,
  formatDate,
} = window.KizunaShared;

const user = ensureUser("./index.html");
if (!user) {
  throw new Error("User not found");
}

const params = new URLSearchParams(location.search);
const type = params.get("type") === "supply" ? "supply" : "need";
const id = params.get("id");
const modeButtonClass = user.mode === "KITCHEN" ? "kitchen-bg" : "provider-bg";

function renderDetailHeaderHtml(title) {
  return `
    <header class="header-row">
      <div>
        <h1>${escapeHtml(title || "きずな〇〇")}</h1>
        <p class="sub">こんにちは、${escapeHtml(user.displayName)} さん</p>
      </div>
    </header>
  `;
}

const root = document.getElementById("appView");
root.classList.remove("hidden");

function renderPage(editMode = false) {
  const state = loadState();
  const source = type === "supply" ? state.supplies : state.needs;
  const itemIndex = source.findIndex((entry) => entry.id === id);
  const item = itemIndex >= 0 ? source[itemIndex] : null;

  if (!item) {
    root.innerHTML = `
      ${renderDetailHeaderHtml("投稿詳細")}
      <section>
        <a class="ghost detail-page-back" href="./board.html">一覧へ戻る</a>
        <article class="card">
          <p class="sub">投稿が見つかりませんでした。</p>
        </article>
      </section>
      ${renderBottomNavHtml("board", user)}
    `;
    return;
  }

  const isOwnPost = item.author === user.displayName;

  if (isOwnPost && editMode) {
    root.innerHTML = `
      ${renderDetailHeaderHtml("投稿編集")}

      <section>
        <a class="ghost detail-page-back" href="./board.html">一覧へ戻る</a>
        <form class="card" id="editPostForm">
          <h2>自分の投稿を編集</h2>
          <label>タイトル<input id="editTitle" value="${escapeHtml(item.title)}" /></label>
          <label>数量<input id="editQuantity" value="${escapeHtml(item.quantity || "")}" /></label>
          <label>カテゴリ
            <select id="editCategory">
              ${CATEGORIES.map((category) => `<option value="${category}" ${item.category === category ? "selected" : ""}>${category}</option>`).join("")}
            </select>
          </label>
          <label>エリア<input id="editArea" value="${escapeHtml(item.area || "")}" /></label>
          <label>メモ<textarea id="editNote" rows="4">${escapeHtml(item.note || "")}</textarea></label>
          <div class="detail-actions-row">
            <button type="submit" class="btn provider-bg">保存する</button>
            <button type="button" id="cancelEditBtn" class="ghost">キャンセル</button>
          </div>
        </form>
      </section>

      ${renderBottomNavHtml("board", user)}
    `;

    document.getElementById("editPostForm").addEventListener("submit", (e) => {
      e.preventDefault();

      const title = document.getElementById("editTitle").value.trim();
      const quantity = document.getElementById("editQuantity").value.trim();
      const category = document.getElementById("editCategory").value;
      const area = document.getElementById("editArea").value.trim();
      const note = document.getElementById("editNote").value.trim();

      if (!title) return;

      source[itemIndex] = {
        ...item,
        title,
        quantity,
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

    <section>
      <a class="ghost detail-page-back" href="./board.html">一覧へ戻る</a>
      <article class="card">
        <div class="row">
          <h2>${escapeHtml(item.title)}</h2>
          <span class="chip">${type === "supply" ? "余剰物資" : "ニーズ"}</span>
        </div>
        <p>カテゴリ: ${escapeHtml(item.category)}</p>
        <p>数量: ${escapeHtml(item.quantity || "未指定")}</p>
        <p>エリア: ${escapeHtml(item.area || "未設定")}</p>
        ${item.note ? `<p>メモ: ${escapeHtml(item.note)}</p>` : ""}
        <small>投稿者: ${escapeHtml(item.author)} / ${formatDate(item.createdAt)}</small>
        ${isOwnPost
          ? ""
          : `<a class="btn ${modeButtonClass} detail-chat-btn detail-card-chat" href="./chat-room.html?partner=${encodeURIComponent(item.author)}">チャット</a>`}
      </article>

      ${isOwnPost
        ? `
          <article class="card detail-actions-card">
            <div class="detail-actions-row">
              <button id="editPostBtn" class="btn provider-bg" type="button">編集する</button>
              <button id="deletePostBtn" class="btn danger-btn" type="button">削除する</button>
            </div>
          </article>
        `
        : ""}
    </section>

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
  }
}

renderPage(false);
