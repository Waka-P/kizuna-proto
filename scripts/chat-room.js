const {
  ensureUser,
  loadState,
  saveState,
  uid,
  getDirectMessagesWith,
  extractPositiveInteger,
  getSupplyReservationSummary,
  getItemDisplayName,
  getItemQuantityUnit,
  isBlockedBy,
  isBlockedEither,
  escapeHtml,
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

function formatTime(value) {
  return new Date(value).toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function getRequestStatusText(status) {
  if (status === "approved") return "承認済み";
  if (status === "rejected") return "拒否";
  return "確認待ち";
}

function getRequestableSupplies(state, partnerName) {
  return (Array.isArray(state.supplies) ? state.supplies : [])
    .filter((item) => item.author === partnerName)
    .map((item) => {
      const summary = getSupplyReservationSummary(state, item);
      return { item, summary };
    })
    .filter(({ summary }) => summary.maxCount && summary.remainingCount > 0)
    .sort((a, b) => new Date(b.item.createdAt).getTime() - new Date(a.item.createdAt).getTime());
}

function getGratitudeTargetSupplies(state, partnerName) {
  return (Array.isArray(state.supplies) ? state.supplies : [])
    .filter((item) => item.author === partnerName)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

function formatRemainingText(item, summary) {
  const unit = getItemQuantityUnit(item);
  return unit ? `残り${summary.remainingCount}${unit}` : `残り${summary.remainingCount}`;
}

function markConversationAsRead(state, userName, partnerName) {
  let changed = false;
  const now = new Date().toISOString();

  (Array.isArray(state.messages) ? state.messages : []).forEach((message) => {
    const isIncoming = message.sender === partnerName && message.receiver === userName;
    if (!isIncoming) return;
    if (message.readAt) return;
    message.readAt = now;
    changed = true;
  });

  return changed;
}

function renderRoom() {
  const state = loadState();

  if (markConversationAsRead(state, user.displayName, partner)) {
    saveState(state);
  }

  const messages = getDirectMessagesWith(state, user.displayName, partner);
  const blockedByMe = isBlockedBy(state, user.displayName, partner);
  const blockedByPartner = isBlockedBy(state, partner, user.displayName);
  const conversationBlocked = isBlockedEither(state, user.displayName, partner);
  const canOpenKitchenActions = user.mode === "KITCHEN" && !conversationBlocked;
  const canOpenRequestMenu = canOpenKitchenActions;
  const canOpenGratitudeMenu = canOpenKitchenActions;
  const requestableSupplies = canOpenRequestMenu ? getRequestableSupplies(state, partner) : [];
  const hasRequestableSupply = requestableSupplies.length > 0;
  const firstRequestableSupply = requestableSupplies[0] || null;
  const gratitudeTargetSupplies = canOpenGratitudeMenu ? getGratitudeTargetSupplies(state, partner) : [];
  const hasGratitudeTargetSupply = gratitudeTargetSupplies.length > 0;
  const firstGratitudeTargetSupply = gratitudeTargetSupplies[0] || null;

  const root = document.getElementById("appView");
  root.classList.remove("hidden");
  root.classList.add("chat-room-page");

  const mode = user.mode === "KITCHEN" ? "kitchen" : "provider";
  const partnerDetailHref = `./user-detail.html?name=${encodeURIComponent(partner)}&from=chat-room&partner=${encodeURIComponent(partner)}`;

  root.innerHTML = `
    <section class="chat-room-shell" data-mode="${mode}">
      <header class="chat-room-header">
        <a href="./chat.html" class="chat-room-back" aria-label="戻る">&lang;</a>
        <div class="chat-room-partner-wrap">
          <a class="chat-room-partner-link" href="${partnerDetailHref}">
            <h3 class="chat-room-partner">${escapeHtml(partner)}</h3>
          </a>
          <span class="chat-room-honorific">さん</span>
        </div>
      </header>

      <div class="chat-thread" id="chatList"></div>
      ${conversationBlocked
        ? `
          <div class="chat-room-blocked-note">
            <p class="sub">${blockedByMe ? "このユーザーをブロック中のため、メッセージ送信はできません。" : "あなたはこのユーザーからブロックされています。"}</p>
          </div>
        `
        : `
          <form id="chatForm" class="chat-composer">
            <input type="file" id="chatFile" class="hidden" />
            <div class="chat-input-wrap">
              <div class="composer-tools">
                <button type="button" id="composeMenuBtn" class="attach-btn" aria-label="メニュー" aria-expanded="false">
                  <i class="fa-solid fa-plus" aria-hidden="true"></i>
                </button>
                <div id="composeMenu" class="compose-menu hidden" role="menu" aria-label="送信メニュー">
                  <button type="button" class="compose-menu-item" data-action="attach" role="menuitem">ファイル添付</button>
                  ${canOpenRequestMenu
                    ? `<button type="button" class="compose-menu-item" data-action="request" role="menuitem" ${hasRequestableSupply ? "" : "disabled"}>リクエスト</button>`
                    : ""}
                  ${canOpenGratitudeMenu
                    ? `<button type="button" class="compose-menu-item" data-action="gratitude" role="menuitem" ${hasGratitudeTargetSupply ? "" : "disabled"}>お礼</button>`
                    : ""}
                </div>
              </div>
              <textarea id="chatText" rows="1" placeholder="メッセージを入力"></textarea>
              <button type="submit" class="send-btn" aria-label="送信">➤</button>
            </div>
            <p id="attachName" class="attach-name hidden"></p>
            ${canOpenRequestMenu
              ? `
                <div class="modal" id="chatRequestModal" aria-hidden="true">
                  <div class="modal-content supply-request-modal" role="dialog" aria-modal="true" aria-labelledby="chatRequestHeading">
                    <h3 id="chatRequestHeading">リクエスト</h3>
                    <p class="sub" id="chatRequestRemaining">${firstRequestableSupply ? escapeHtml(formatRemainingText(firstRequestableSupply.item, firstRequestableSupply.summary)) : "リクエスト可能な投稿がありません"}</p>
                    <form id="chatRequestForm" class="supply-request-form">
                      <label style="text-align: left;">
                        提供投稿
                        <select id="chatRequestSupplyId" ${hasRequestableSupply ? "" : "disabled"}>
                          ${requestableSupplies.map(({ item, summary }) => `<option value="${escapeHtml(item.id)}">${escapeHtml(getItemDisplayName(item) || "未指定")}（${escapeHtml(formatRemainingText(item, summary))}）</option>`).join("")}
                        </select>
                      </label>
                      <label style="text-align: left;">
                        必要数量
                        <input id="chatRequestAmount" type="number" min="1" ${firstRequestableSupply ? `max="${escapeHtml(String(firstRequestableSupply.summary.remainingCount))}"` : ""} placeholder="1" ${hasRequestableSupply ? "" : "disabled"} />
                      </label>
                      <p id="chatRequestError" class="error hidden"></p>
                      <div class="detail-actions-row">
                        <button type="button" id="closeChatRequestBtn" class="cancel-btn ghost">キャンセル</button>
                        <button type="submit" class="btn kitchen-bg submit-btn" ${hasRequestableSupply ? "" : "disabled"}>送信</button>
                      </div>
                    </form>
                  </div>
                </div>
              `
              : ""}
            ${canOpenGratitudeMenu
              ? `
                <div class="modal" id="chatGratitudeModal" aria-hidden="true">
                  <div class="modal-content supply-request-modal" role="dialog" aria-modal="true" aria-labelledby="chatGratitudeHeading">
                    <h3 id="chatGratitudeHeading">お礼</h3>
                    <form id="chatGratitudeForm" class="supply-request-form">
                      <label style="text-align: left;">
                        対象の提供投稿
                        <select id="chatGratitudeSupplyId" ${hasGratitudeTargetSupply ? "" : "disabled"}>
                          ${gratitudeTargetSupplies.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(getItemDisplayName(item) || "未指定")}</option>`).join("")}
                        </select>
                      </label>
                      <label style="text-align: left;">
                        メッセージ
                        <textarea id="chatGratitudeText" rows="4" placeholder="例: 温かいご支援ありがとうございました。活動の様子をお送りします。"></textarea>
                      </label>
                      <input type="file" id="chatGratitudeFile" class="hidden" />
                      <button type="button" id="openGratitudeFileBtn" class="cancel-btn ghost" ${hasGratitudeTargetSupply ? "" : "disabled"}>ファイル添付</button>
                      <p id="chatGratitudeAttachName" class="attach-name hidden"></p>
                      <p class="sub">${hasGratitudeTargetSupply ? `対象投稿ごとに、提供者へバッジは1回のみ付与されます。` : "対象にできる提供投稿がありません。"}</p>
                      <p id="chatGratitudeError" class="error hidden"></p>
                      <div class="detail-actions-row">
                        <button type="button" id="closeChatGratitudeBtn" class="cancel-btn ghost">キャンセル</button>
                        <button type="submit" class="btn kitchen-bg submit-btn" ${hasGratitudeTargetSupply ? "" : "disabled"}>送信</button>
                      </div>
                    </form>
                  </div>
                </div>
              `
              : ""}
          </form>
        `}
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
        const isReadByPartner = Boolean(message.readAt);
        const date = new Date(message.createdAt);
        const dayKey = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
        const showDaySeparator = dayKey !== previousDayKey;
        previousDayKey = dayKey;

        const request = message.type === "supply_request" ? message.request : null;
        const gratitude = message.type === "gratitude" ? message.gratitude : null;
        const requestStatusText = request ? getRequestStatusText(request.status) : "";
        const canRespondRequest = Boolean(request)
          && user.mode === "PROVIDER"
          && user.displayName === message.receiver
          && request.status === "pending";

        const requestCardHtml = request
          ? `
            <div class="request-card">
              <div class="request-card-head">
                <p class="request-card-title">リクエスト</p>
                <span class="request-status status-${escapeHtml(request.status)}">${escapeHtml(requestStatusText)}</span>
              </div>
              <p class="request-card-line">物資： ${escapeHtml(request.itemTitle || "-")}</p>
              <p class="request-card-line">希望数量： ${escapeHtml(String(request.amount || "-"))}${escapeHtml(request.unit || "")}</p>

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

        const gratitudeCardHtml = gratitude
          ? `
            <div class="request-card gratitude-card">
              <div class="request-card-head">
                <p class="request-card-title">お礼</p>
              </div>
              <p class="request-card-line">対象投稿： ${escapeHtml(gratitude.itemTitle || "-")}</p>
              ${gratitude.message ? `<p class="request-card-line">${escapeHtml(gratitude.message)}</p>` : ""}
              ${gratitude.attachment
                ? `<a class="file-link" href="${gratitude.attachment.dataUrl}" download="${escapeHtml(gratitude.attachment.name)}">添付: ${escapeHtml(gratitude.attachment.name)}</a>`
                : ""}
            </div>
          `
          : "";

        const defaultContentHtml = !request
          ? `
            ${message.text ? `<p class="chat-message-text">${escapeHtml(message.text)}</p>` : ""}
            ${message.attachment ? `<a class="file-link" href="${message.attachment.dataUrl}" download="${escapeHtml(message.attachment.name)}">添付: ${escapeHtml(message.attachment.name)}</a>` : ""}
          `
          : "";

        const metaHtml = `
          <div class="chat-meta ${self ? "self" : "other"}">
            ${self && isReadByPartner ? '<span class="chat-read">既読</span>' : ""}
            <small class="chat-time">${formatTime(message.createdAt)}</small>
          </div>
        `;

        if (request || gratitude) {
          return `
            ${showDaySeparator ? `<div class="chat-day-separator"><span>${date.getMonth() + 1}月${date.getDate()}日</span></div>` : ""}
            <article class="chat-request-wrap ${self ? "self" : "other"}">
              ${self ? metaHtml : ""}
              ${request ? requestCardHtml : gratitudeCardHtml}
              ${self ? "" : metaHtml}
            </article>
          `;
        }

        return `
          ${showDaySeparator ? `<div class="chat-day-separator"><span>${date.getMonth() + 1}月${date.getDate()}日</span></div>` : ""}
          <article class="chat-bubble-wrap ${self ? "self" : "other"}">
            ${self ? metaHtml : ""}
            <div class="chat-bubble ${self ? "self" : "other"}">
              ${defaultContentHtml}
            </div>
            ${self ? "" : metaHtml}
          </article>
        `;
      })
      .join("");

    chatList.scrollTop = chatList.scrollHeight;
  }

  const chatText = document.getElementById("chatText");
  const chatFile = document.getElementById("chatFile");
  const composeMenuBtn = document.getElementById("composeMenuBtn");
  const composeMenu = document.getElementById("composeMenu");
  const attachName = document.getElementById("attachName");
  const chatForm = document.getElementById("chatForm");

  if (!chatForm || !chatText || !chatFile || !composeMenuBtn || !composeMenu || !attachName) {
    return;
  }

  function setComposeMenuOpen(open) {
    if (!composeMenu || !composeMenuBtn) return;
    composeMenu.classList.toggle("hidden", !open);
    composeMenuBtn.classList.toggle("open", open);
    composeMenuBtn.setAttribute("aria-expanded", open ? "true" : "false");
  }

  setComposeMenuOpen(false);

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

  composeMenuBtn.addEventListener("click", () => {
    const isOpen = composeMenuBtn.classList.contains("open");
    setComposeMenuOpen(!isOpen);
  });

  document.addEventListener("click", (event) => {
    if (!chatForm.contains(event.target)) {
      setComposeMenuOpen(false);
    }
  });

  composeMenu.addEventListener("click", (event) => {
    const button = event.target.closest(".compose-menu-item");
    if (!button || button.disabled) return;

    const action = button.dataset.action;
    setComposeMenuOpen(false);

    if (action === "attach") {
      chatFile.click();
      return;
    }

    if (action === "request") {
      const modal = document.getElementById("chatRequestModal");
      if (!modal) return;
      modal.classList.add("open");
      modal.setAttribute("aria-hidden", "false");
      return;
    }

    if (action === "gratitude") {
      const modal = document.getElementById("chatGratitudeModal");
      if (!modal) return;
      modal.classList.add("open");
      modal.setAttribute("aria-hidden", "false");
    }
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
      readAt: null,
    });

    saveState(state);
    renderRoom();
  });

  if (canOpenRequestMenu) {
    const requestModal = document.getElementById("chatRequestModal");
    const closeRequestBtn = document.getElementById("closeChatRequestBtn");
    const requestForm = document.getElementById("chatRequestForm");
    const requestSupplyId = document.getElementById("chatRequestSupplyId");
    const requestAmount = document.getElementById("chatRequestAmount");
    const requestError = document.getElementById("chatRequestError");
    const requestRemaining = document.getElementById("chatRequestRemaining");

    function clearRequestError() {
      requestError.classList.add("hidden");
      requestError.textContent = "";
    }

    function closeRequestModal() {
      requestModal.classList.remove("open");
      requestModal.setAttribute("aria-hidden", "true");
      clearRequestError();
    }

    function getSelectedSupplyInfo(currentState) {
      const selectedId = requestSupplyId?.value;
      if (!selectedId) return null;

      const selected = (Array.isArray(currentState.supplies) ? currentState.supplies : []).find(
        (item) => item.id === selectedId && item.author === partner,
      );
      if (!selected) return null;

      const summary = getSupplyReservationSummary(currentState, selected);
      if (!summary.maxCount || !summary.remainingCount || summary.remainingCount <= 0) return null;

      return { item: selected, summary };
    }

    function refreshRequestMeta() {
      const info = getSelectedSupplyInfo(state);
      if (!info) {
        requestRemaining.textContent = "リクエスト可能な投稿がありません";
        requestAmount.removeAttribute("max");
        return;
      }

      requestRemaining.textContent = formatRemainingText(info.item, info.summary);
      requestAmount.setAttribute("max", String(info.summary.remainingCount));
    }

    if (requestSupplyId) {
      requestSupplyId.addEventListener("change", () => {
        clearRequestError();
        refreshRequestMeta();
      });
    }

    if (closeRequestBtn) {
      closeRequestBtn.addEventListener("click", closeRequestModal);
    }

    if (requestModal) {
      requestModal.addEventListener("click", (event) => {
        if (event.target === requestModal) {
          closeRequestModal();
        }
      });
    }

    if (requestForm) {
      requestForm.addEventListener("submit", (event) => {
        event.preventDefault();

        const amount = extractPositiveInteger(requestAmount.value);
        if (!amount) {
          requestError.textContent = "数量は1以上で入力してください。";
          requestError.classList.remove("hidden");
          return;
        }

        const latestState = loadState();
        const selectedInfo = getSelectedSupplyInfo(latestState);
        if (!selectedInfo) {
          requestError.textContent = "リクエスト可能な投稿がありません。";
          requestError.classList.remove("hidden");
          return;
        }

        if (amount > selectedInfo.summary.remainingCount) {
          requestError.textContent = `現在の残りは${selectedInfo.summary.remainingCount}です。再入力してください。`;
          requestError.classList.remove("hidden");
          return;
        }

        latestState.messages.push({
          id: uid("msg"),
          type: "supply_request",
          sender: user.displayName,
          receiver: partner,
          text: "",
          attachment: null,
          request: {
            postId: selectedInfo.item.id,
            postType: "supply",
            itemTitle: getItemDisplayName(selectedInfo.item),
            amount,
            maxAmount: selectedInfo.summary.maxCount,
            status: "pending",
          },
          createdAt: new Date().toISOString(),
        });

        saveState(latestState);
        closeRequestModal();
        renderRoom();
      });
    }

    refreshRequestMeta();
  }

  if (canOpenGratitudeMenu) {
    const gratitudeModal = document.getElementById("chatGratitudeModal");
    const closeGratitudeBtn = document.getElementById("closeChatGratitudeBtn");
    const gratitudeForm = document.getElementById("chatGratitudeForm");
    const gratitudeSupplyId = document.getElementById("chatGratitudeSupplyId");
    const gratitudeText = document.getElementById("chatGratitudeText");
    const gratitudeFile = document.getElementById("chatGratitudeFile");
    const openGratitudeFileBtn = document.getElementById("openGratitudeFileBtn");
    const gratitudeAttachName = document.getElementById("chatGratitudeAttachName");
    const gratitudeError = document.getElementById("chatGratitudeError");

    function clearGratitudeError() {
      gratitudeError.classList.add("hidden");
      gratitudeError.textContent = "";
    }

    function closeGratitudeModal() {
      gratitudeModal.classList.remove("open");
      gratitudeModal.setAttribute("aria-hidden", "true");
      clearGratitudeError();
      gratitudeText.value = "";
      gratitudeFile.value = "";
      gratitudeAttachName.textContent = "";
      gratitudeAttachName.classList.add("hidden");
    }

    openGratitudeFileBtn?.addEventListener("click", () => {
      gratitudeFile?.click();
    });

    gratitudeFile?.addEventListener("change", () => {
      const file = gratitudeFile.files[0];
      if (!file) {
        gratitudeAttachName.textContent = "";
        gratitudeAttachName.classList.add("hidden");
        return;
      }
      gratitudeAttachName.textContent = `添付: ${file.name}`;
      gratitudeAttachName.classList.remove("hidden");
      clearGratitudeError();
    });

    closeGratitudeBtn?.addEventListener("click", closeGratitudeModal);

    gratitudeModal?.addEventListener("click", (event) => {
      if (event.target === gratitudeModal) {
        closeGratitudeModal();
      }
    });

    gratitudeForm?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const selectedSupplyId = String(gratitudeSupplyId?.value || "").trim();
      const gratitudeMessage = String(gratitudeText?.value || "").trim();
      const file = gratitudeFile?.files?.[0] || null;

      if (!selectedSupplyId) {
        gratitudeError.textContent = "対象の提供投稿を選択してください。";
        gratitudeError.classList.remove("hidden");
        return;
      }

      if (!gratitudeMessage && !file) {
        gratitudeError.textContent = "メッセージまたは添付ファイルを設定してください。";
        gratitudeError.classList.remove("hidden");
        return;
      }

      let attachment = null;
      if (file) {
        attachment = await readFileAsDataUrl(file);
      }

      const latestState = loadState();
      const selectedSupply = (Array.isArray(latestState.supplies) ? latestState.supplies : []).find(
        (item) => item.id === selectedSupplyId && item.author === partner,
      );
      if (!selectedSupply) {
        gratitudeError.textContent = "対象の提供投稿が見つかりません。";
        gratitudeError.classList.remove("hidden");
        return;
      }

      latestState.messages.push({
        id: uid("msg"),
        type: "gratitude",
        sender: user.displayName,
        receiver: partner,
        text: "",
        attachment: null,
        gratitude: {
          postId: selectedSupply.id,
          itemTitle: getItemDisplayName(selectedSupply),
          message: gratitudeMessage,
          attachment,
        },
        createdAt: new Date().toISOString(),
        readAt: null,
      });

      const badges = Array.isArray(latestState.badges) ? latestState.badges : [];
      const alreadyGranted = badges.some((badge) => (
        (badge.type === "gratitude_received" || badge.type === "donation_proof")
        && badge.provider === partner
        && badge.postId === selectedSupply.id
      ));

      if (!alreadyGranted) {
        badges.push({
          id: uid("badge"),
          type: "donation_proof",
          provider: partner,
          postId: selectedSupply.id,
          itemTitle: getItemDisplayName(selectedSupply),
          grantedBy: user.displayName,
          grantedAt: new Date().toISOString(),
        });
      }

      latestState.badges = badges;

      saveState(latestState);
      closeGratitudeModal();
      renderRoom();
    });
  }
}

renderRoom();
