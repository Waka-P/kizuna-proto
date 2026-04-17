const {
  ensureUser,
  loadState,
  saveState,
  renderHeaderHtml,
  renderBottomNavHtml,
  getSupplyReservationSummary,
  getItemDisplayName,
  getItemQuantityUnit,
  extractPositiveInteger,
  escapeHtml,
  formatDate,
  isBlockedEither,
  isPostKizuna,
  getPostKizunaCount,
  togglePostKizuna,
} = window.KizunaShared;

const user = ensureUser("./index.html");
if (!user) {
  throw new Error("User not found");
}

const boardListLabel = user.mode === "KITCHEN" ? "余剰物資一覧" : "子ども食堂掲示板";
const ownModeClass = user.mode === "KITCHEN" ? "kitchen" : "provider";
const boardListModeClass = user.mode === "KITCHEN" ? "provider" : "kitchen";
const boardListIllustrationSrc = user.mode === "KITCHEN" ? "./images/company.png" : "./images/kodomo.png";
const isKitchenMode = user.mode === "KITCHEN";
const hasLowerPanel = true;

function resolveProfileIconDataUrl(icon) {
  if (!icon) return "";
  if (typeof icon === "string") return icon;
  if (typeof icon.dataUrl === "string") return icon.dataUrl;
  return "";
}

function formatRemainingText(item, summary) {
  if (!summary || summary.remainingCount === null) return "残り-";
  const unit = getItemQuantityUnit(item);
  return unit ? `残り${summary.remainingCount}${unit}` : `残り${summary.remainingCount}`;
}

function formatDeltaText(item, delta) {
  const unit = getItemQuantityUnit(item);
  if (!delta) return "在庫変動なし";
  const sign = delta > 0 ? "+" : "";
  return unit ? `${sign}${delta}${unit}` : `${sign}${delta}`;
}

function getFollowedProviderNames(state, viewerName) {
  const supplies = Array.isArray(state.supplies) ? state.supplies : [];
  const providerByPost = new Set(supplies.map((item) => item.author).filter(Boolean));
  const providerByProfile = new Set(
    (Array.isArray(state.users) ? state.users : [])
      .filter((profile) => profile?.mode === "PROVIDER" && profile?.displayName)
      .map((profile) => profile.displayName),
  );

  const entries = Array.isArray(state.kizuna) ? state.kizuna : [];
  return new Set(
    entries
      .filter((entry) => entry?.from === viewerName && entry?.to)
      .map((entry) => entry.to)
      .filter((name) => !isBlockedEither(state, viewerName, name))
      .filter((name) => providerByProfile.has(name) || providerByPost.has(name)),
  );
}

function buildStockEventsForPost(message, item) {
  const request = message?.request;
  if (!request || request.postType !== "supply" || request.postId !== item.id) return [];

  const amount = extractPositiveInteger(request.amount);
  if (!amount) return [];

  const events = [];
  const createdAt = message.createdAt || new Date().toISOString();
  events.push({
    type: "stock",
    subType: "reserved",
    createdAt,
    delta: -amount,
    actor: message.sender || "不明ユーザー",
    item,
    postId: item.id,
    author: item.author,
  });

  if (request.status === "rejected" && request.respondedAt) {
    events.push({
      type: "stock",
      subType: "released",
      createdAt: request.respondedAt,
      delta: amount,
      actor: message.receiver || item.author || "不明ユーザー",
      item,
      postId: item.id,
      author: item.author,
    });
  }

  return events;
}

function enrichStockEventsWithRemaining(state, events) {
  const grouped = new Map();
  events.forEach((event) => {
    const list = grouped.get(event.postId) || [];
    list.push(event);
    grouped.set(event.postId, list);
  });

  grouped.forEach((list) => {
    list.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    const item = list[0]?.item;
    const summary = getSupplyReservationSummary(state, item);
    let remaining = summary.maxCount;

    list.forEach((event) => {
      if (remaining === null) {
        event.remainingAfter = null;
        return;
      }
      remaining = Math.max(remaining + event.delta, 0);
      event.remainingAfter = remaining;
    });
  });

  return events;
}

function buildKitchenTimelineEntries(state, viewerName) {
  const supplies = (Array.isArray(state.supplies) ? state.supplies : [])
    .filter((item) => item?.author && !isBlockedEither(state, viewerName, item.author));
  const followedProviders = getFollowedProviderNames(state, viewerName);
  const supplyById = new Map(supplies.map((item) => [item.id, item]));

  const postEntries = supplies.map((item) => ({
    type: "post",
    createdAt: item.createdAt,
    item,
    postId: item.id,
    author: item.author,
  }));

  const stockEventsRaw = (Array.isArray(state.messages) ? state.messages : [])
    .filter((message) => message?.type === "supply_request" && message?.request?.postType === "supply")
    .flatMap((message) => {
      const item = supplyById.get(message.request.postId);
      if (!item) return [];
      return buildStockEventsForPost(message, item);
    });

  const stockEntries = enrichStockEventsWithRemaining(state, stockEventsRaw);
  const allEntries = [...postEntries, ...stockEntries]
    .map((entry) => {
      const followed = followedProviders.has(entry.author);
      const postKizunaByMe = isPostKizuna(state, viewerName, "supply", entry.postId);
      const postKizunaCount = getPostKizunaCount(state, "supply", entry.postId);
      const priority = (followed ? 100 : 0)
        + (postKizunaByMe ? 50 : 0)
        + Math.min(postKizunaCount, 30)
        + (entry.type === "stock" ? 20 : 0);
      return {
        ...entry,
        followed,
        postKizunaByMe,
        postKizunaCount,
        priority,
      };
    })
    .sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  return allEntries.slice(0, 12);
}

function renderKitchenTimeline(state) {
  const host = document.getElementById("boardTimelineSection");
  if (!host) return;

  const entries = buildKitchenTimelineEntries(state, user.displayName);
  if (!entries.length) {
    host.innerHTML = `
      <section class="board-follow-timeline">
        <h2 class="board-follow-timeline-title">タイムライン</h2>
        <p class="sub">投稿はまだありません。</p>
      </section>
    `;
    return;
  }

  host.innerHTML = `
    <section class="board-follow-timeline" aria-label="タイムライン">
      <div class="board-follow-timeline-head">
        <h2 class="board-follow-timeline-title">タイムライン</h2>
      </div>

      <div class="board-follow-timeline-list">
        ${entries.map((entry) => {
          const item = entry.item;
          const summary = getSupplyReservationSummary(state, item);
          const postHref = `./post-detail.html?type=supply&id=${encodeURIComponent(item.id)}`;
          const userHref = `./user-detail.html?name=${encodeURIComponent(item.author || "")}&from=board`;
          const authorName = item.author || "不明";
          const authorInitial = authorName.slice(0, 1) || "?";
          const authorProfile = (Array.isArray(state.users) ? state.users : []).find((profile) => profile?.displayName === authorName);
          const authorIconDataUrl = resolveProfileIconDataUrl(authorProfile?.profileIcon);
          const tagHtml = entry.followed
            ? '<span class="timeline-chip followed">フォロー中</span>'
            : "";

          const bodyHtml = entry.type === "stock"
            ? `
              <p class="timeline-entry-text">${entry.subType === "released" ? "在庫が戻りました" : "在庫が変化しました"}（${escapeHtml(formatDeltaText(item, entry.delta))}）</p>
              <p class="timeline-entry-sub">${entry.remainingAfter === null ? "残り-" : `残り${escapeHtml(String(entry.remainingAfter))}${escapeHtml(getItemQuantityUnit(item) || "")}`}</p>
            `
            : `
              <p class="timeline-entry-text">新しい投稿がありました</p>
              <p class="timeline-entry-sub">${escapeHtml(formatRemainingText(item, summary))}</p>
            `;

          return `
            <article class="timeline-entry ${entry.type === "stock" ? "stock" : "post"}">
              <div class="timeline-entry-top">
                <a class="timeline-entry-item" href="${postHref}">${escapeHtml(getItemDisplayName(item) || "未指定")}</a>
                <div class="timeline-entry-chips">
                  ${tagHtml}
                  <span class="timeline-chip timeline-chip-type ${entry.type === "stock" ? "stock" : "post"}">${entry.type === "stock" ? "在庫変化" : "投稿"}</span>
                </div>
              </div>

              ${bodyHtml}

              <div class="timeline-entry-meta">
                <a class="meta-author meta-author-link timeline-entry-author" href="${userHref}">
                  <span class="author-icon" aria-hidden="true">${authorIconDataUrl ? `<img src="${authorIconDataUrl}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:999px;"/>` : escapeHtml(authorInitial)}</span>
                  <span>${escapeHtml(authorName)}</span>
                </a>
                <span class="timeline-entry-date">${escapeHtml(formatDate(entry.createdAt))}</span>
              </div>

              <button
                type="button"
                class="timeline-post-kizuna-btn ${entry.postKizunaByMe ? "active" : ""}"
                data-post-id="${escapeHtml(entry.postId)}"
                aria-label="キズナ"
                title="キズナ"
              >
                <i class="${entry.postKizunaByMe ? "fa-solid" : "fa-regular"} fa-star" aria-hidden="true"></i>
              </button>
            </article>
          `;
        }).join("")}
      </div>
    </section>
  `;
}

const root = document.getElementById("appView");
root.classList.remove("hidden");
root.classList.add("board-app");
if (hasLowerPanel) {
  root.classList.add("board-app-with-timeline");
}
root.innerHTML = `
  ${renderHeaderHtml(user, "きずな〇〇")}

  <section class="board-menu-container ${hasLowerPanel ? "board-menu-container-split" : ""}" aria-label="一覧ページリンク">
    <div class="board-menu-stack">
      <a class="board-menu-link board-menu-link-${boardListModeClass} board-menu-link-with-illustration" href="./board-list.html">
        <span class="board-menu-link-text">
          <span class="board-menu-link-main">${boardListLabel}</span>
          <span class="board-menu-link-sub">投稿一覧を表示</span>
        </span>
        <img class="board-menu-link-illustration" src="${boardListIllustrationSrc}" alt="" aria-hidden="true">
      </a>
      <a class="board-menu-link board-menu-link-${ownModeClass} board-menu-link-own" href="./board-my-posts.html">
        <i class="fa-solid fa-user-pen board-menu-link-own-icon" aria-hidden="true"></i>
        <span class="board-menu-link-text">
          <span class="board-menu-link-main">自分の投稿</span>
          <span class="board-menu-link-sub">自分の投稿一覧を表示</span>
        </span>
      </a>
    </div>
    ${isKitchenMode
      ? ""
      : `
        <section id="boardMapPreviewSection" aria-label="マップ">
          <button type="button" id="providerMapPreview" class="board-map-preview-card" aria-label="マップを開く">
            <div class="board-map-preview-label">マップ</div>
            <div class="board-map-preview-canvas" aria-hidden="true">
              <span class="board-map-pin pin-a"></span>
              <span class="board-map-pin pin-b"></span>
              <span class="board-map-pin pin-c"></span>
            </div>
            <p class="board-map-preview-caption">近くの投稿・子ども食堂の位置イメージ</p>
          </button>
        </section>
      `}
    ${isKitchenMode ? '<section id="boardTimelineSection"></section>' : ""}
  </section>

  ${renderBottomNavHtml("board", user)}
`;

if (!isKitchenMode) {
  const mapPreview = document.getElementById("providerMapPreview");
  if (mapPreview) {
    mapPreview.addEventListener("click", () => {
      const rect = mapPreview.getBoundingClientRect();
      const overlay = document.createElement("div");
      overlay.className = "board-map-expand-overlay";
      overlay.style.left = `${rect.left}px`;
      overlay.style.top = `${rect.top}px`;
      overlay.style.width = `${rect.width}px`;
      overlay.style.height = `${rect.height}px`;
      document.body.appendChild(overlay);

      requestAnimationFrame(() => {
        overlay.classList.add("is-expanding");
      });

      window.setTimeout(() => {
        location.href = "./board-map.html";
      }, 260);
    });
  }
}

if (isKitchenMode) {
  renderKitchenTimeline(loadState());

  root.addEventListener("click", (event) => {
    const button = event.target.closest(".timeline-post-kizuna-btn");
    if (!button) return;

    const postId = String(button.dataset.postId || "").trim();
    if (!postId) return;

    const latestState = loadState();
    const targetPost = (Array.isArray(latestState.supplies) ? latestState.supplies : []).find((item) => item.id === postId);
    if (!targetPost) return;
    if (isBlockedEither(latestState, user.displayName, targetPost.author)) {
      alert("ブロック中のユーザーの投稿にはキズナできません。");
      return;
    }

    togglePostKizuna(latestState, user.displayName, "supply", postId);
    saveState(latestState);
    renderKitchenTimeline(latestState);
  });
}
