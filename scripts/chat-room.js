const {
  ensureUser,
  loadState,
  saveState,
  uid,
  getDirectMessagesWith,
  escapeHtml,
  formatDate,
  readFileAsDataUrl,
} = window.KizunaShared;

const user = ensureUser("./index.html");
if (!user) {
  throw new Error("User not found");
}

const params = new URLSearchParams(location.search);
const partner = params.get("partner");
if (!partner) {
  location.href = "./chat.html";
}

function renderRoom() {
  const state = loadState();
  const messages = getDirectMessagesWith(state, user.displayName, partner);

  const root = document.getElementById("appView");
  root.classList.remove("hidden");
  root.classList.add("chat-room-page");

  const mode = user.mode === "KITCHEN" ? "kitchen" : "provider";

  root.innerHTML = `
    <section class="chat-room-shell" data-mode="${mode}">
      <header class="chat-room-header">
        <a href="./chat.html" class="chat-room-back" aria-label="戻る">‹</a>
        <div class="chat-room-partner-wrap">
          <h3 class="chat-room-partner">${escapeHtml(partner)}</h3>
          <span class="chat-room-honorific">さん</span>
        </div>
      </header>

      <div class="chat-thread" id="chatList"></div>

      <form id="chatForm" class="chat-composer">
        <input type="file" id="chatFile" class="hidden" />
        <div class="chat-input-wrap">
          <button type="button" id="attachBtn" class="attach-btn" aria-label="ファイル添付">📎</button>
          <textarea id="chatText" rows="1" placeholder="メッセージを入力"></textarea>
          <button type="submit" class="send-btn" aria-label="送信">➤</button>
        </div>
        <p id="attachName" class="attach-name hidden"></p>
      </form>
    </section>
  `;

  const chatList = document.getElementById("chatList");
  if (!messages.length) {
    chatList.innerHTML = `<p class="sub">まだメッセージはありません</p>`;
  } else {
    let previousDayKey = null;

    chatList.innerHTML = messages
      .map((message) => {
        const self = message.sender === user.displayName;
        const date = new Date(message.createdAt);
        const dayKey = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
        const showDaySeparator = dayKey !== previousDayKey;
        previousDayKey = dayKey;

        const request = message.type === "supply_request" ? message.request : null;
        const requestStatusText = request
          ? request.status === "approved"
            ? "承認済み"
            : request.status === "rejected"
              ? "拒否"
              : "確認待ち"
          : "";
        const canRespondRequest = Boolean(request)
          && user.mode === "PROVIDER"
          && user.displayName === message.receiver
          && request.status === "pending";

        const requestCardHtml = request
          ? `
            <div class="request-card status-${escapeHtml(request.status)}">
              <p class="request-card-title">提供希望リクエスト</p>
              <p class="request-card-line">物資: ${escapeHtml(request.itemTitle || "-")}</p>
              <p class="request-card-line">希望数量: ${escapeHtml(String(request.amount || "-"))}</p>
              <p class="request-card-line">上限数量: ${escapeHtml(String(request.maxAmount || "-"))}</p>
              <p class="request-card-status">ステータス: ${escapeHtml(requestStatusText)}</p>
              ${canRespondRequest
                ? `
                  <div class="request-card-actions">
                    <button type="button" class="request-action-btn approve" data-message-id="${escapeHtml(message.id)}" data-action="approve">承認</button>
                    <button type="button" class="request-action-btn reject" data-message-id="${escapeHtml(message.id)}" data-action="reject">拒否</button>
                  </div>
                `
                : ""}
            </div>
          `
          : "";

        const defaultContentHtml = !request
          ? `
            ${message.text ? `<p>${escapeHtml(message.text)}</p>` : ""}
            ${message.attachment ? `<a class="file-link" href="${message.attachment.dataUrl}" download="${escapeHtml(message.attachment.name)}">添付: ${escapeHtml(message.attachment.name)}</a>` : ""}
          `
          : "";

        return `
          ${showDaySeparator ? `<div class="chat-day-separator"><span>${date.getMonth() + 1}月${date.getDate()}日</span></div>` : ""}
          <article class="chat-bubble-wrap ${self ? "self" : "other"}">
            <div class="chat-bubble ${self ? "self" : "other"}">
              ${requestCardHtml}
              ${defaultContentHtml}
              <small>${formatDate(message.createdAt)}</small>
            </div>
          </article>
        `;
      })
      .join("");

    chatList.scrollTop = chatList.scrollHeight;
  }

  const chatText = document.getElementById("chatText");
  const chatFile = document.getElementById("chatFile");
  const attachBtn = document.getElementById("attachBtn");
  const attachName = document.getElementById("attachName");

  chatList.addEventListener("click", (event) => {
    const button = event.target.closest(".request-action-btn");
    if (!button) return;

    const messageId = button.dataset.messageId;
    const action = button.dataset.action;
    if (!messageId || !action) return;

    const latestState = loadState();
    const target = latestState.messages.find((message) => message.id === messageId);
    if (!target || target.type !== "supply_request" || !target.request) return;
    if (target.request.status !== "pending") {
      renderRoom();
      return;
    }

    target.request.status = action === "approve" ? "approved" : "rejected";
    target.request.respondedAt = new Date().toISOString();

    saveState(latestState);
    renderRoom();
  });

  attachBtn.addEventListener("click", () => {
    chatFile.click();
  });

  chatFile.addEventListener("change", () => {
    const file = chatFile.files[0];
    if (!file) {
      attachName.textContent = "";
      attachName.classList.add("hidden");
      return;
    }

    attachName.textContent = `添付: ${file.name}`;
    attachName.classList.remove("hidden");
  });

  document.getElementById("chatForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = chatText.value.trim();
    const file = chatFile.files[0];
    if (!text && !file) return;

    let attachment = null;
    if (file) {
      attachment = await readFileAsDataUrl(file);
    }

    state.messages.push({
      id: uid("msg"),
      sender: user.displayName,
      receiver: partner,
      text,
      attachment,
      createdAt: new Date().toISOString(),
    });

    saveState(state);
    renderRoom();
  });
}

renderRoom();
