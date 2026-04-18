const {
  ensureUser,
  loadState,
  renderHeaderHtml,
  renderBottomNavHtml,
  escapeHtml,
  formatDate,
  isKizuna,
  toggleKizuna,
  isBlockedBy,
  isBlockedEither,
  toggleBlock,
  addReport,
  saveState,
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

const needsCount = ownNeeds.length;
const suppliesCount = ownSupplies.length;

const mode = inferMode(profile, needsCount, suppliesCount);
const modeText = mode === "KITCHEN" ? "子ども食堂" : mode === "PROVIDER" ? "提供者" : "未設定";
const modeClass = mode === "KITCHEN" ? "kitchen" : mode === "PROVIDER" ? "provider" : "unknown";
const iconDataUrl = resolveProfileIconDataUrl(profile?.profileIcon);
const initial = (targetName || "?").slice(0, 1);
const isSelf = targetName === user.displayName;
const backHref = getBackHref();
const hasKizuna = !isSelf && isKizuna(state, user.displayName, targetName);
const blockedByMe = !isSelf && isBlockedBy(state, user.displayName, targetName);
const blockedByTarget = !isSelf && isBlockedBy(state, targetName, user.displayName);
const isBlocked = !isSelf && isBlockedEither(state, user.displayName, targetName);
const actionDisabledMessage = blockedByMe
  ? "ブロック中のため、このユーザーとはチャットできません。"
  : blockedByTarget
    ? "あなたはこのユーザーからブロックされています。"
    : "";

const recentPosts = [...ownSupplies.map((item) => ({ ...item, postType: "supply" })), ...ownNeeds.map((item) => ({ ...item, postType: "need" }))]
  .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  .slice(0, 5);

const gratitudeBadges = (Array.isArray(state.badges) ? state.badges : [])
  .filter((badge) => (badge.type === "gratitude_received" || badge.type === "donation_proof") && badge.provider === targetName)
  .slice()
  .sort((a, b) => new Date(b.grantedAt || 0).getTime() - new Date(a.grantedAt || 0).getTime());
const gratitudeBadgeById = new Map(gratitudeBadges.map((badge) => [badge.id, badge]));

const root = document.getElementById("appView");
root.classList.remove("hidden");
root.innerHTML = `
  ${renderHeaderHtml(user, "ユーザ詳細")}

  <section class="board-section-container user-detail-page">
    <a class="detail-page-back" href="${backHref}"><span>&lang;</span>戻る</a>

    <article class="post-feed-hero user-detail-hero" aria-label="ユーザ詳細の案内">
      <div class="post-feed-hero-icon" aria-hidden="true">
        <span class="material-symbols-outlined">account_circle</span>
      </div>
      <div class="post-feed-hero-copy">
        <p class="post-feed-hero-eyebrow">PROFILE</p>
        <h2>ユーザ詳細</h2>
      </div>
    </article>

    <article class="card user-profile-card user-profile-card-emphasis">
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
        : `
          <div class="user-action-stack">
            <div class="user-action-top-row">
              ${isBlocked
                ? `<button class="btn user-chat-btn user-chat-action ${user.mode === "KITCHEN" ? "kitchen-bg" : "provider-bg"}" type="button" disabled>チャット</button>`
                : `<a class="btn user-chat-btn user-chat-action ${user.mode === "KITCHEN" ? "kitchen-bg" : "provider-bg"}" href="./chat-room.html?partner=${encodeURIComponent(targetName)}">チャット</a>`}
              <button id="kizunaToggleBtn" class="kizuna-toggle-btn ${hasKizuna ? "active" : ""}" type="button" aria-label="キズナ" title="キズナ" ${isBlocked ? "disabled" : ""}>
                <i class="${hasKizuna ? "fa-solid" : "fa-regular"} fa-star" aria-hidden="true"></i>
              </button>
            </div>
            <div class="user-relation-row">
              <button id="blockToggleBtn" class="ghost relation-chip-btn block-btn" type="button">
                <i class="fa-solid ${blockedByMe ? "fa-lock-open" : "fa-ban"}" aria-hidden="true"></i>
                <span>${blockedByMe ? "ブロック解除" : "ブロック"}</span>
              </button>
              <button id="reportUserBtn" class="ghost relation-chip-btn report-btn" type="button">
                <i class="fa-regular fa-flag" aria-hidden="true"></i>
                <span>通報</span>
              </button>
            </div>
          </div>
          ${actionDisabledMessage ? `<p class="sub user-relation-note">${escapeHtml(actionDisabledMessage)}</p>` : ""}
        `}
    </article>

    <article class="card user-badge-card">
      <h3><span class="material-symbols-outlined" aria-hidden="true">workspace_premium</span>バッジ</h3>
      ${gratitudeBadges.length
        ? `
          <ul class="user-badge-grid" id="userBadgeGrid">
            ${gratitudeBadges.map((badge) => `
              <li>
                <button type="button" class="user-badge-icon-btn" data-badge-id="${escapeHtml(badge.id)}" aria-label="バッジ詳細を表示">
                  <span class="user-badge-icon" aria-hidden="true"><i class="fa-solid fa-award"></i></span>
                </button>
              </li>
            `).join("")}
          </ul>
        `
        : '<p class="sub">まだバッジはありません。</p>'}
    </article>

    <article class="card user-recent-post-card">
      <h3><span class="material-symbols-outlined" aria-hidden="true">history</span>最近の投稿</h3>
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
                      <div class="list-item-title-wrap">
                        <span class="material-symbols-outlined list-item-title-icon" aria-hidden="true">inventory_2</span>
                        <strong class="list-item-title">${escapeHtml(item.itemName || item.title || "未指定")}</strong>
                      </div>
                      <span class="chip list-item-category-chip">${escapeHtml(item.category || "未分類")}</span>
                    </div>
                    <div class="list-item-facts">
                      <span class="list-fact-pill"><span class="material-symbols-outlined" aria-hidden="true">deployed_code</span>${escapeHtml(label)}</span>
                      <span class="list-fact-pill"><span class="material-symbols-outlined" aria-hidden="true">distance</span>${escapeHtml(item.area || "未設定")}</span>
                    </div>
                    <div class="list-meta-line list-meta-line-own">
                      <div class="list-meta-date"><span class="material-symbols-outlined" aria-hidden="true">schedule</span>${escapeHtml(formatDate(item.createdAt))}</div>
                    </div>
                  </article>
                </a>
              `;
            }).join("")}
          </div>
        `
        : '<p class="sub">投稿はまだありません。</p>'}
    </article>

    ${isSelf
      ? ""
      : `
        <div class="modal" id="blockConfirmModal" aria-hidden="true">
          <div class="modal-content supply-request-modal" role="dialog" aria-modal="true" aria-labelledby="blockConfirmHeading">
            <h3 id="blockConfirmHeading">このユーザーをブロックしますか？</h3>
            <p class="sub">ブロック中はチャット・リクエスト・キズナが利用できません。</p>
            <div class="detail-actions-row">
              <button type="button" id="closeBlockConfirmBtn" class="cancel-btn ghost">キャンセル</button>
              <button type="button" id="confirmBlockBtn" class="btn danger-btn">ブロック</button>
            </div>
          </div>
        </div>

        <div class="modal" id="reportModal" aria-hidden="true">
          <div class="modal-content supply-request-modal" role="dialog" aria-modal="true" aria-labelledby="reportHeading">
            <h3 id="reportHeading">ユーザーを通報</h3>
            <form id="reportForm" class="supply-request-form">
              <label style="text-align: left;">
                理由
                <select id="reportReason" required>
                  <option value="">選択してください</option>
                  <option value="spam">スパム・勧誘</option>
                  <option value="abuse">迷惑行為</option>
                  <option value="fraud">虚偽・なりすまし</option>
                  <option value="other">その他</option>
                </select>
              </label>
              <label style="text-align: left;">
                詳細（任意）
                <textarea id="reportDetail" rows="3" maxlength="300" placeholder="状況を入力してください"></textarea>
              </label>
              <p id="reportError" class="error hidden"></p>
              <p id="reportSaved" class="sub hidden">通報を受け付けました。</p>
              <div class="detail-actions-row">
                <button type="button" id="closeReportBtn" class="cancel-btn ghost">キャンセル</button>
                <button type="submit" class="btn submit-btn ${user.mode === "KITCHEN" ? "kitchen-bg" : "provider-bg"}">送信</button>
              </div>
            </form>
          </div>
        </div>
      `}

    <div class="modal" id="badgeDetailModal" aria-hidden="true">
      <div class="modal-content supply-request-modal" role="dialog" aria-modal="true" aria-labelledby="badgeDetailHeading">
        <button type="button" id="closeBadgeDetailBtn" class="badge-modal-close-btn" aria-label="閉じる">&times;</button>
        <h3 id="badgeDetailHeading">バッジの詳細</h3>
        <div class="badge-detail-body">
          <div class="badge-detail-row"><span class="badge-detail-label">提供物資</span><span id="badgeDetailItem" class="badge-detail-value">-</span></div>
          <div class="badge-detail-row"><span class="badge-detail-label">付与日</span><span id="badgeDetailDate" class="badge-detail-value">-</span></div>
          <div class="badge-detail-row"><span class="badge-detail-label">提供先</span><span id="badgeDetailFrom" class="badge-detail-value">-</span></div>
        </div>
      </div>
    </div>
  </section>

  ${renderBottomNavHtml("board", user)}
`;

if (!isSelf) {
  const kizunaToggleBtn = document.getElementById("kizunaToggleBtn");
  const blockToggleBtn = document.getElementById("blockToggleBtn");
  const blockConfirmModal = document.getElementById("blockConfirmModal");
  const closeBlockConfirmBtn = document.getElementById("closeBlockConfirmBtn");
  const confirmBlockBtn = document.getElementById("confirmBlockBtn");
  const reportUserBtn = document.getElementById("reportUserBtn");
  const reportModal = document.getElementById("reportModal");
  const closeReportBtn = document.getElementById("closeReportBtn");
  const reportForm = document.getElementById("reportForm");
  const reportReason = document.getElementById("reportReason");
  const reportDetail = document.getElementById("reportDetail");
  const reportError = document.getElementById("reportError");
  const reportSaved = document.getElementById("reportSaved");

  if (kizunaToggleBtn) {
    kizunaToggleBtn.addEventListener("click", () => {
      const latestState = loadState();
      if (isBlockedEither(latestState, user.displayName, targetName)) {
        alert("ブロック中のユーザーにはキズナできません。");
        return;
      }
      toggleKizuna(latestState, user.displayName, targetName);
      saveState(latestState);
      location.reload();
    });
  }

  if (blockToggleBtn) {
    blockToggleBtn.addEventListener("click", () => {
      const latestState = loadState();
      const currentlyBlocked = isBlockedBy(latestState, user.displayName, targetName);
      if (!currentlyBlocked) {
        if (blockConfirmModal) {
          blockConfirmModal.classList.add("open");
          blockConfirmModal.setAttribute("aria-hidden", "false");
        }
        return;
      }
      toggleBlock(latestState, user.displayName, targetName);
      saveState(latestState);
      location.reload();
    });
  }

  function closeBlockModal() {
    if (!blockConfirmModal) return;
    blockConfirmModal.classList.remove("open");
    blockConfirmModal.setAttribute("aria-hidden", "true");
  }

  if (closeBlockConfirmBtn) {
    closeBlockConfirmBtn.addEventListener("click", closeBlockModal);
  }

  if (blockConfirmModal) {
    blockConfirmModal.addEventListener("click", (event) => {
      if (event.target === blockConfirmModal) {
        closeBlockModal();
      }
    });
  }

  if (confirmBlockBtn) {
    confirmBlockBtn.addEventListener("click", () => {
      const latestState = loadState();
      if (isBlockedBy(latestState, user.displayName, targetName)) {
        closeBlockModal();
        return;
      }
      toggleBlock(latestState, user.displayName, targetName);
      saveState(latestState);
      closeBlockModal();
      location.reload();
    });
  }

  function closeReportModal() {
    if (!reportModal) return;
    reportModal.classList.remove("open");
    reportModal.setAttribute("aria-hidden", "true");
  }

  if (reportUserBtn && reportModal) {
    reportUserBtn.addEventListener("click", () => {
      reportModal.classList.add("open");
      reportModal.setAttribute("aria-hidden", "false");
      if (reportError) {
        reportError.classList.add("hidden");
        reportError.textContent = "";
      }
      if (reportSaved) {
        reportSaved.classList.add("hidden");
      }
    });
  }

  if (closeReportBtn) {
    closeReportBtn.addEventListener("click", closeReportModal);
  }

  if (reportModal) {
    reportModal.addEventListener("click", (event) => {
      if (event.target === reportModal) {
        closeReportModal();
      }
    });
  }

  if (reportForm && reportReason && reportDetail && reportError && reportSaved) {
    reportForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const reason = reportReason.value.trim();
      const detail = reportDetail.value.trim();
      if (!reason) {
        reportError.textContent = "通報理由を選択してください。";
        reportError.classList.remove("hidden");
        reportSaved.classList.add("hidden");
        return;
      }

      const latestState = loadState();
      const created = addReport(latestState, {
        reporter: user.displayName,
        target: targetName,
        reason,
        detail,
      });
      if (!created) {
        reportError.textContent = "通報の送信に失敗しました。";
        reportError.classList.remove("hidden");
        reportSaved.classList.add("hidden");
        return;
      }

      saveState(latestState);
      reportError.classList.add("hidden");
      reportSaved.classList.remove("hidden");
      reportForm.reset();
      setTimeout(closeReportModal, 600);
    });
  }
}

const badgeGrid = document.getElementById("userBadgeGrid");
const badgeDetailModal = document.getElementById("badgeDetailModal");
const closeBadgeDetailBtn = document.getElementById("closeBadgeDetailBtn");
const badgeDetailItem = document.getElementById("badgeDetailItem");
const badgeDetailDate = document.getElementById("badgeDetailDate");
const badgeDetailFrom = document.getElementById("badgeDetailFrom");

function closeBadgeDetailModal() {
  if (!badgeDetailModal) return;
  badgeDetailModal.classList.remove("open");
  badgeDetailModal.setAttribute("aria-hidden", "true");
}

if (badgeGrid && badgeDetailModal && badgeDetailItem && badgeDetailDate && badgeDetailFrom) {
  badgeGrid.addEventListener("click", (event) => {
    const tile = event.target.closest(".user-badge-icon-btn");
    if (!tile) return;

    const badgeId = String(tile.dataset.badgeId || "").trim();
    const badge = badgeId ? gratitudeBadgeById.get(badgeId) : null;
    if (!badge) return;

    badgeDetailItem.textContent = badge.itemTitle || "投稿";
    badgeDetailDate.textContent = badge.grantedAt ? formatDate(badge.grantedAt) : "-";
    badgeDetailFrom.textContent = badge.grantedBy || "-";

    badgeDetailModal.classList.add("open");
    badgeDetailModal.setAttribute("aria-hidden", "false");
  });
}

if (closeBadgeDetailBtn) {
  closeBadgeDetailBtn.addEventListener("click", closeBadgeDetailModal);
}

if (badgeDetailModal) {
  badgeDetailModal.addEventListener("click", (event) => {
    if (event.target === badgeDetailModal) {
      closeBadgeDetailModal();
    }
  });
}
