const {
  ensureUser,
  loadState,
  renderHeaderHtml,
  renderBottomNavHtml,
  getChatSummaries,
  getMessagePreviewText,
  isBlockedEither,
  escapeHtml,
  formatDate,
} = window.KizunaShared;

const user = ensureUser("./index.html");
if (!user) {
  throw new Error("User not found");
}

const state = loadState();
const summaries = getChatSummaries(state, user.displayName)
  .filter(({ partnerName }) => !isBlockedEither(state, user.displayName, partnerName));

const root = document.getElementById("appView");
root.classList.remove("hidden");
root.innerHTML = `
  ${renderHeaderHtml(user, "チャット")}

  <section class="board-section-container chat-list-page">
    <article class="post-feed-hero chat-list-hero" aria-label="チャット一覧の案内">
      <div class="post-feed-hero-icon" aria-hidden="true">
        <span class="material-symbols-outlined">chat_bubble</span>
      </div>
      <div class="post-feed-hero-copy">
        <p class="post-feed-hero-eyebrow">CHAT</p>
        <h2>チャット一覧</h2>
      </div>
    </article>

    <section class="chat-room-list" id="chatRoomList"></section>
  </section>

  ${renderBottomNavHtml("chat", user)}
`;

const listEl = document.getElementById("chatRoomList");
if (!summaries.length) {
  listEl.innerHTML = `
    <article class="card post-feed-empty chat-empty-card">
      <span class="material-symbols-outlined" aria-hidden="true">forum</span>
      <p class="sub">チャット相手がまだいません。</p>
    </article>
  `;
} else {
  const modeClass = user.mode === "KITCHEN" ? "kitchen" : "provider";
  listEl.innerHTML = summaries
    .map(({ partnerName, lastMessage }) => {
      const preview = lastMessage
        ? getMessagePreviewText(lastMessage)
        : "まだメッセージはありません";

      return `
        <a class="chat-room-item ${modeClass}" href="./chat-room.html?partner=${encodeURIComponent(partnerName)}">
          <div class="chat-avatar">${escapeHtml(partnerName.slice(0, 1))}</div>
          <div class="chat-room-main">
            <div class="chat-room-top">
              <strong>${escapeHtml(partnerName)}</strong>
              <small>${lastMessage ? formatDate(lastMessage.createdAt) : ""}</small>
            </div>
            <p class="chat-preview">${escapeHtml(preview)}</p>
          </div>
        </a>
      `;
    })
    .join("");
}
