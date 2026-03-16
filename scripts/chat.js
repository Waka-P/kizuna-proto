const {
  ensureUser,
  loadState,
  renderHeaderHtml,
  renderBottomNavHtml,
  getChatSummaries,
  escapeHtml,
  formatDate,
} = window.KizunaShared;

const user = ensureUser("./index.html");
if (!user) {
  throw new Error("User not found");
}

const state = loadState();
const summaries = getChatSummaries(state, user.displayName);

const root = document.getElementById("appView");
root.classList.remove("hidden");
root.innerHTML = `
  ${renderHeaderHtml(user, "チャット")}

  <section class="chat-room-list" id="chatRoomList"></section>

  ${renderBottomNavHtml("chat", user)}
`;

const listEl = document.getElementById("chatRoomList");
if (!summaries.length) {
  listEl.innerHTML = `<article class="card"><p class="sub">チャット相手がまだいません。投稿すると候補が表示されます。</p></article>`;
} else {
  listEl.innerHTML = summaries
    .map(({ partnerName, lastMessage }) => {
      const preview = lastMessage
        ? lastMessage.text || (lastMessage.attachment ? "添付ファイル" : "")
        : "まだメッセージはありません";

      return `
        <a class="chat-room-item" href="./chat-room.html?partner=${encodeURIComponent(partnerName)}">
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
