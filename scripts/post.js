const {
  ensureUser,
  loadState,
  saveState,
  uid,
  CATEGORIES,
  renderHeaderHtml,
  renderBottomNavHtml,
} = window.KizunaShared;

const user = ensureUser("./index.html");
if (!user) {
  throw new Error("User not found");
}

const root = document.getElementById("appView");
root.classList.remove("hidden");

const isKitchen = user.mode === "KITCHEN";
const endpointText = isKitchen ? "ニーズ投稿" : "余剰物資投稿";

root.innerHTML = `
  ${renderHeaderHtml(user, "きずな〇〇")}

  <section>
    <form id="postForm" class="card">
      <h2>${endpointText}</h2>
      <label>タイトル<input id="postTitle" placeholder="例: 米 20kg が必要" /></label>
      <label>数量<input id="postQty" placeholder="例: 20kg / 50食分" /></label>
      <label>カテゴリ
        <select id="postCat">
          ${CATEGORIES.map((category) => `<option value="${category}">${category}</option>`).join("")}
        </select>
      </label>
      <label>エリア<input id="postArea" placeholder="例: 横浜市港北区" /></label>
      <label>補足メモ<textarea id="postNote" rows="3" placeholder="引き取り可能時間など"></textarea></label>
      <p id="postError" class="error hidden"></p>
      <button type="submit" class="btn ${isKitchen ? "kitchen-bg" : "provider-bg"}">投稿</button>
    </form>
  </section>

  ${renderBottomNavHtml("post", user)}
`;

document.getElementById("postForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const title = document.getElementById("postTitle").value.trim();
  const quantity = document.getElementById("postQty").value.trim();
  const category = document.getElementById("postCat").value;
  const area = document.getElementById("postArea").value.trim();
  const note = document.getElementById("postNote").value.trim();
  const err = document.getElementById("postError");

  if (!title) {
    err.textContent = "タイトルを入力してください";
    err.classList.remove("hidden");
    return;
  }

  err.classList.add("hidden");

  const state = loadState();
  const item = {
    id: uid(user.mode === "KITCHEN" ? "need" : "supply"),
    title,
    quantity,
    category,
    area,
    note,
    author: user.displayName,
    createdAt: new Date().toISOString(),
  };

  if (user.mode === "KITCHEN") {
    state.needs.unshift(item);
  } else {
    state.supplies.unshift(item);
  }

  saveState(state);
  location.href = "./board.html";
});
