const {
  ensureUser,
  loadState,
  saveState,
  uid,
  CATEGORIES,
  renderHeaderHtml,
  renderBottomNavHtml,
} = window.KizunaShared;

const UNIT_OPTIONS = ["kg", "g", "個", "本", "袋", "箱", "L", "ml", "食分", "セット", "ダース"];

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

  <section class="board-section-container post-compose-page">
    <form id="postForm" class="card post-compose-form">
      <div class="post-compose-hero">
        <div class="post-compose-hero-icon" aria-hidden="true">
          <span class="material-symbols-outlined">edit_square</span>
        </div>
        <div>
          <p class="post-compose-eyebrow">NEW POST</p>
          <h2>${endpointText}</h2>
        </div>
      </div>
      <label><span class="post-label-title"><span class="material-symbols-outlined" aria-hidden="true">inventory_2</span>物資名</span><input id="postItemName" placeholder="例: 米" required /></label>
      <label>数量
        <div class="quantity-input-row">
          <input id="postQtyAmount" type="number" min="1" step="1" inputmode="numeric" placeholder="例: 20" required />
          <input id="postQtyUnit" list="postQtyUnitOptions" placeholder="単位" required />
        </div>
        <datalist id="postQtyUnitOptions">
          ${UNIT_OPTIONS.map((unit) => `<option value="${unit}"></option>`).join("")}
        </datalist>
      </label>
      <label>カテゴリ
        <select id="postCat" required>
          ${CATEGORIES.map((category) => `<option value="${category}">${category}</option>`).join("")}
        </select>
      </label>
      <label><span class="post-label-title"><span class="material-symbols-outlined" aria-hidden="true">distance</span>エリア</span><input id="postArea" placeholder="例: 横浜市港北区" required /></label>
      ${!isKitchen ? '<label><span class="post-label-title"><span class="material-symbols-outlined" aria-hidden="true">redeem</span>支援後に受け取りたいお礼</span><textarea id="postGratitudeRequest" rows="2" placeholder="例: 活動写真、子どもたちからのメッセージ"></textarea></label>' : ""}
      <label><span class="post-label-title"><span class="material-symbols-outlined" aria-hidden="true">notes</span>補足メモ</span><textarea id="postNote" rows="3" placeholder="引き取り可能時間など"></textarea></label>
      <p id="postError" class="error hidden"></p>
      <button type="submit" class="btn post-submit-btn ${isKitchen ? "kitchen-bg" : "provider-bg"}"><span class="material-symbols-outlined" aria-hidden="true">send</span>投稿</button>
    </form>
  </section>

  ${renderBottomNavHtml("post", user)}
`;

document.getElementById("postForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const itemName = document.getElementById("postItemName").value.trim();
  const quantityAmountRaw = document.getElementById("postQtyAmount").value.trim();
  const quantityAmount = Number.parseInt(quantityAmountRaw, 10);
  const quantityUnit = document.getElementById("postQtyUnit").value.trim();
  const category = document.getElementById("postCat").value;
  const area = document.getElementById("postArea").value.trim();
  const gratitudeRequest = isKitchen ? "" : document.getElementById("postGratitudeRequest")?.value.trim() || "";
  const note = document.getElementById("postNote").value.trim();
  const err = document.getElementById("postError");

  if (!itemName) {
    err.textContent = "物資名を入力してください";
    err.classList.remove("hidden");
    return;
  }

  if (!Number.isFinite(quantityAmount) || quantityAmount <= 0) {
    err.textContent = "数量は1以上の数値で入力してください";
    err.classList.remove("hidden");
    return;
  }

  if (!quantityUnit) {
    err.textContent = "数量の単位を入力してください";
    err.classList.remove("hidden");
    return;
  }

  if (!category) {
    err.textContent = "カテゴリを選択してください";
    err.classList.remove("hidden");
    return;
  }

  if (!area) {
    err.textContent = "エリアを入力してください";
    err.classList.remove("hidden");
    return;
  }

  err.classList.add("hidden");

  const state = loadState();
  const item = {
    id: uid(user.mode === "KITCHEN" ? "need" : "supply"),
    itemName,
    title: itemName,
    quantityAmount,
    quantityUnit,
    quantity: quantityUnit ? `${quantityAmount} ${quantityUnit}` : String(quantityAmount),
    category,
    area,
    gratitudeRequest,
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
  location.href = "./board-my-posts.html";
});
