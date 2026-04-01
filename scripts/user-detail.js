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

const params = new URLSearchParams(location.search);
const targetName = (params.get("name") || "").trim();
const from = (params.get("from") || "").trim();

if (!targetName) {
  location.href = "./board.html";
  throw new Error("User name is required");
}

function resolveProfileIconDataUrl(icon) {
  if (!icon) return "";
  if (typeof icon === "string") return icon;
  if (typeof icon.dataUrl === "string") return icon.dataUrl;
  return "";
}

function getBackHref() {
  if (from === "board-list") {
    return "./board-list.html";
  }

  if (from === "chat-room") {
    const partner = (params.get("partner") || "").trim();
    return partner ? `./chat-room.html?partner=${encodeURIComponent(partner)}` : "./chat.html";
  }

  if (from === "post-detail") {
    const type = params.get("type") === "supply" ? "supply" : "need";
    const id = (params.get("id") || "").trim();
    if (id) {
      return `./post-detail.html?type=${encodeURIComponent(type)}&id=${encodeURIComponent(id)}`;
    }
    return "./board-list.html";
  }

  return "./board.html";
}

function inferMode(profile, needsCount, suppliesCount) {
  if (profile?.mode === "KITCHEN" || profile?.mode === "PROVIDER") {
    return profile.mode;
  }

  if (needsCount > 0 && suppliesCount === 0) return "KITCHEN";
  if (suppliesCount > 0 && needsCount === 0) return "PROVIDER";
  return null;
}

const state = loadState();
const users = Array.isArray(state.users) ? state.users : [];
const profile = users
  .filter((entry) => entry.displayName === targetName)
  .sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime())[0] || null;

const ownNeeds = (Array.isArray(state.needs) ? state.needs : []).filter((item) => item.author === targetName);
const ownSupplies = (Array.isArray(state.supplies) ? state.supplies : []).filter((item) => item.author === targetName);
const relatedMessages = (Array.isArray(state.messages) ? state.messages : []).filter(
  (message) => message.sender === targetName || message.receiver === targetName,
);

const needsCount = ownNeeds.length;
const suppliesCount = ownSupplies.length;
const sentCount = relatedMessages.filter((message) => message.sender === targetName).length;
const receivedCount = relatedMessages.filter((message) => message.receiver === targetName).length;
const latestMessage = relatedMessages
  .slice()
  .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] || null;

const mode = inferMode(profile, needsCount, suppliesCount);
const modeText = mode === "KITCHEN" ? "子ども食堂" : mode === "PROVIDER" ? "提供者" : "未設定";
const modeClass = mode === "KITCHEN" ? "kitchen" : mode === "PROVIDER" ? "provider" : "unknown";
const iconDataUrl = resolveProfileIconDataUrl(profile?.profileIcon);
const initial = (targetName || "?").slice(0, 1);
const isSelf = targetName === user.displayName;
const backHref = getBackHref();

const recentPosts = [...ownSupplies.map((item) => ({ ...item, postType: "supply" })), ...ownNeeds.map((item) => ({ ...item, postType: "need" }))]
  .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  .slice(0, 5);

const root = document.getElementById("appView");
root.classList.remove("hidden");
root.innerHTML = `
  ${renderHeaderHtml(user, "ユーザ詳細")}

  <section class="user-detail-page">
    <a class="detail-page-back" href="${backHref}"><span>&lang;</span>戻る</a>

    <article class="card user-profile-card">
      <div class="user-profile-head">
        <div class="user-profile-avatar ${iconDataUrl ? "has-image" : ""}">
          ${iconDataUrl ? `<img src="${iconDataUrl}" alt="${escapeHtml(targetName)}のプロフィール画像" />` : `<span>${escapeHtml(initial)}</span>`}
        </div>
        <div class="user-profile-main">
          <h2>${escapeHtml(targetName)}</h2>
          <p class="sub user-address ${modeClass}"><i class="fa-solid fa-location-dot" aria-hidden="true"></i><span>${escapeHtml(profile?.address || "住所未設定")}</span></p>
        </div>
        <div class="user-status-badge ${modeClass}">${escapeHtml(modeText)}</div>
      </div>

      <div class="user-profile-meta">
        <p><strong>連絡先：</strong> ${escapeHtml(profile?.contact || "未設定")}</p>
        <p><strong>自己紹介：</strong> ${escapeHtml(profile?.bio || "未設定")}</p>
      </div>

      ${isSelf
        ? `<a class="btn ${user.mode === "KITCHEN" ? "kitchen-bg" : "provider-bg"}" href="./settings.html">プロフィールを編集</a>`
        : `<a class="btn user-chat-btn ${user.mode === "KITCHEN" ? "kitchen-bg" : "provider-bg"}" href="./chat-room.html?partner=${encodeURIComponent(targetName)}">チャット</a>`}
    </article>

    <article class="card user-activity-card">
      <h3>活動サマリ</h3>
      <div class="user-activity-grid">
        <div class="user-activity-item">
          <span class="sub">ニーズ投稿</span>
          <strong>${escapeHtml(String(needsCount))}</strong>
        </div>
        <div class="user-activity-item">
          <span class="sub">余剰物資投稿</span>
          <strong>${escapeHtml(String(suppliesCount))}</strong>
        </div>
        <div class="user-activity-item">
          <span class="sub">送信メッセージ</span>
          <strong>${escapeHtml(String(sentCount))}</strong>
        </div>
        <div class="user-activity-item">
          <span class="sub">受信メッセージ</span>
          <strong>${escapeHtml(String(receivedCount))}</strong>
        </div>
      </div>
      <p class="sub">最終メッセージ: ${latestMessage ? escapeHtml(formatDate(latestMessage.createdAt)) : "なし"}</p>
    </article>

    <article class="card user-recent-post-card">
      <h3>最近の投稿</h3>
      ${recentPosts.length
        ? `
          <div class="list">
            ${recentPosts.map((item) => {
              const href = `./post-detail.html?type=${encodeURIComponent(item.postType)}&id=${encodeURIComponent(item.id)}`;
              const label = item.postType === "supply" ? "余剰物資" : "ニーズ";
              return `
                <a class="list-item-link" href="${href}">
                  <article class="list-item list-item-compact">
                    <div class="row list-item-top-row">
                      <strong class="list-item-title">${escapeHtml(item.itemName || item.title || "未指定")}</strong>
                      <span class="chip list-item-category-chip">${escapeHtml(item.category || "未分類")}</span>
                    </div>
                    <div class="list-item-facts">
                      <span class="list-fact-pill">${escapeHtml(label)}</span>
                      <span class="list-fact-pill">${escapeHtml(item.area || "未設定")}</span>
                    </div>
                    <div class="list-meta-line list-meta-line-own">
                      <div class="list-meta-date">${escapeHtml(formatDate(item.createdAt))}</div>
                    </div>
                  </article>
                </a>
              `;
            }).join("")}
          </div>
        `
        : '<p class="sub">投稿はまだありません。</p>'}
    </article>
  </section>

  ${renderBottomNavHtml("board", user)}
`;
