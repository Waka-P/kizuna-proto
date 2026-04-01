const {
  ensureUser,
  saveUser,
  clearUser,
  loadState,
  saveState,
  escapeHtml,
  readFileAsDataUrl,
  renderHeaderHtml,
  renderBottomNavHtml,
  openModeSwitchModal,
} = window.KizunaShared;

const user = ensureUser("./index.html");
if (!user) {
  throw new Error("User not found");
}

function getBlockedEntriesForCurrentUser(state, currentUserName) {
  const blocks = Array.isArray(state.blocks) ? state.blocks : [];
  return blocks
    .filter((entry) => entry.by === currentUserName)
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
}

function renderBlockedListSectionHtml() {
  const state = loadState();
  const users = Array.isArray(state.users) ? state.users : [];
  const blockedEntries = getBlockedEntriesForCurrentUser(state, user.displayName);

  if (!blockedEntries.length) {
    return `
      <article class="card">
        <h2>ブロックリスト</h2>
        <p class="sub">現在ブロックしているユーザーはいません。</p>
      </article>
    `;
  }

  return `
    <article class="card">
      <h2>ブロックリスト</h2>
      <p class="sub">ブロック解除すると、再びチャットやキズナが可能になります。</p>
      <div id="blockedList" class="list">
        ${blockedEntries.map((entry) => {
          const targetProfile = users.find((record) => record.displayName === entry.target);
          const initial = (entry.target || "?").slice(0, 1);
          const iconDataUrl = resolveProfileIconDataUrl(targetProfile?.profileIcon);
          return `
            <article class="list-item list-item-compact">
              <div class="list-meta-line">
                <div class="meta-author">
                  <span class="author-icon" aria-hidden="true">${iconDataUrl ? `<img src="${iconDataUrl}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:999px;"/>` : escapeHtml(initial)}</span>
                  <span>${escapeHtml(entry.target)}</span>
                </div>
                <button class="ghost" type="button" data-unblock-target="${escapeHtml(entry.target)}">ブロック解除</button>
              </div>
            </article>
          `;
        }).join("")}
      </div>
    </article>
  `;
}

const root = document.getElementById("appView");
root.classList.remove("hidden");
root.innerHTML = `
  ${renderHeaderHtml(user, "設定")}

  <section class="settings-container">
    <article class="card">
      <h2>プロフィール設定</h2>
      <form id="profileForm" class="settings-profile-form">
        <div class="label-container">
          <span class="settings-label-with-icon">
            <button id="profileIconTrigger" class="profile-icon-button" type="button" aria-label="プロフィールアイコンを変更">
              <span id="profileIconPreview" class="profile-icon-preview">?</span>
            </button>
          </span>
          <label>
            表示名
            <input id="profileDisplayName" maxlength="40" value="${escapeHtml(user.displayName || "")}" placeholder="例: ひまわり食堂" />
          </label>
          <input id="profileIconFile" type="file" accept="image/*" class="hidden" />
        </div>
        <label>
          連絡先（任意）
          <input id="profileContact" maxlength="120" value="${escapeHtml(user.contact || "")}" placeholder="例: info@example.com" />
        </label>
        <label>
          住所（任意）
          <input id="profileAddress" maxlength="120" value="${escapeHtml(user.address || "")}" placeholder="例: 東京都渋谷区〇〇1-2-3" />
        </label>
        <label>
          自己紹介（任意）
          <textarea id="profileBio" rows="3" maxlength="300" placeholder="活動内容や対応できる物資などを入力">${escapeHtml(user.bio || "")}</textarea>
        </label>
        <p id="profileError" class="error hidden"></p>
        <p id="profileSaved" class="sub hidden">プロフィールを保存しました。</p>
        <button id="saveProfile" class="btn ${user.mode === "KITCHEN" ? "kitchen-bg" : "provider-bg"}" type="submit">プロフィールを保存</button>
      </form>
    </article>

    <article class="card">
      <h2>モード切替</h2>
      <p class="sub">現在のモード：${user.mode === "KITCHEN" ? "子ども食堂" : "提供者"}</p>
      <button id="openSwitch" class="ghost" type="button">モードを切り替える</button>
    </article>

    ${renderBlockedListSectionHtml()}

    <article class="card detail-actions-card">
      <h2>データ管理</h2>
      <p class="sub">ローカルデータの初期化とログアウトができます。</p>
      <button id="resetData" class="ghost" type="button">データを初期化</button>
      <button id="logout" class="ghost" type="button">ログアウト</button>
    </article>
  </section>

  ${renderBottomNavHtml("settings", user)}
`;

const profileForm = document.getElementById("profileForm");
const displayNameInput = document.getElementById("profileDisplayName");
const contactInput = document.getElementById("profileContact");
const addressInput = document.getElementById("profileAddress");
const bioInput = document.getElementById("profileBio");
const errorNode = document.getElementById("profileError");
const savedNode = document.getElementById("profileSaved");
const profileIconTrigger = document.getElementById("profileIconTrigger");
const profileIconPreview = document.getElementById("profileIconPreview");
const profileIconFileInput = document.getElementById("profileIconFile");
const blockedList = document.getElementById("blockedList");

function resolveProfileIconDataUrl(icon) {
  if (!icon) return "";
  if (typeof icon === "string") return icon;
  if (typeof icon.dataUrl === "string") return icon.dataUrl;
  return "";
}

if (blockedList) {
  blockedList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-unblock-target]");
    if (!button) return;

    const target = String(button.dataset.unblockTarget || "").trim();
    if (!target) return;

    const latestState = loadState();
    const blocks = Array.isArray(latestState.blocks) ? latestState.blocks : [];
    latestState.blocks = blocks.filter((entry) => !(entry.by === user.displayName && entry.target === target));
    saveState(latestState);
    location.reload();
  });
}

let nextProfileIcon = user.profileIcon || null;

function updateProfileIconPreview() {
  if (!profileIconPreview) return;

  const iconDataUrl = resolveProfileIconDataUrl(nextProfileIcon);
  if (iconDataUrl) {
    profileIconPreview.classList.add("has-image");
    profileIconPreview.textContent = "";
    const img = document.createElement("img");
    img.src = iconDataUrl;
    img.alt = "プロフィールアイコン";
    profileIconPreview.appendChild(img);
    return;
  }

  profileIconPreview.classList.remove("has-image");
  const labelChar = (displayNameInput.value.trim() || user.displayName || "?").slice(0, 1);
  profileIconPreview.textContent = labelChar;
}

profileIconTrigger.addEventListener("click", () => {
  profileIconFileInput.click();
});

profileIconFileInput.addEventListener("change", async () => {
  const file = profileIconFileInput.files?.[0];
  if (!file) return;

  if (!file.type.startsWith("image/")) {
    errorNode.textContent = "画像ファイルを選択してください";
    errorNode.classList.remove("hidden");
    return;
  }

  if (file.size > 700 * 1024) {
    errorNode.textContent = "アイコン画像は700KB以下にしてください";
    errorNode.classList.remove("hidden");
    return;
  }

  try {
    nextProfileIcon = await readFileAsDataUrl(file);
    errorNode.classList.add("hidden");
    savedNode.classList.add("hidden");
    updateProfileIconPreview();
  } catch (_e) {
    errorNode.textContent = "画像の読み込みに失敗しました";
    errorNode.classList.remove("hidden");
  } finally {
    profileIconFileInput.value = "";
  }
});

displayNameInput.addEventListener("input", () => {
  if (!resolveProfileIconDataUrl(nextProfileIcon)) {
    updateProfileIconPreview();
  }
});

updateProfileIconPreview();

function migrateDisplayNameInState(prevName, nextName) {
  const state = loadState();
  const migratedNeeds = state.needs.map((item) => {
    if (item.author !== prevName) return item;
    return { ...item, author: nextName };
  });
  const migratedSupplies = state.supplies.map((item) => {
    if (item.author !== prevName) return item;
    return { ...item, author: nextName };
  });
  const migratedMessages = state.messages.map((message) => ({
    ...message,
    sender: message.sender === prevName ? nextName : message.sender,
    receiver: message.receiver === prevName ? nextName : message.receiver,
  }));
  const migratedKizuna = (Array.isArray(state.kizuna) ? state.kizuna : []).map((entry) => ({
    ...entry,
    from: entry.from === prevName ? nextName : entry.from,
    to: entry.to === prevName ? nextName : entry.to,
  }));
  const migratedBlocks = (Array.isArray(state.blocks) ? state.blocks : []).map((entry) => ({
    ...entry,
    by: entry.by === prevName ? nextName : entry.by,
    target: entry.target === prevName ? nextName : entry.target,
  }));
  const migratedReports = (Array.isArray(state.reports) ? state.reports : []).map((entry) => ({
    ...entry,
    reporter: entry.reporter === prevName ? nextName : entry.reporter,
    target: entry.target === prevName ? nextName : entry.target,
  }));
  const users = Array.isArray(state.users) ? [...state.users] : [];
  const prevUserIndex = users.findIndex((entry) => entry.displayName === prevName);
  const nextUserIndex = users.findIndex((entry) => entry.displayName === nextName);
  if (prevUserIndex >= 0) {
    users[prevUserIndex] = {
      ...users[prevUserIndex],
      displayName: nextName,
      updatedAt: new Date().toISOString(),
    };
  }

  if (prevUserIndex >= 0 && nextUserIndex >= 0 && prevUserIndex !== nextUserIndex) {
    users[nextUserIndex] = {
      ...users[nextUserIndex],
      ...users[prevUserIndex],
      displayName: nextName,
      updatedAt: new Date().toISOString(),
    };
    users.splice(prevUserIndex, 1);
  }

  saveState({
    ...state,
    needs: migratedNeeds,
    supplies: migratedSupplies,
    messages: migratedMessages,
    kizuna: migratedKizuna,
    blocks: migratedBlocks,
    reports: migratedReports,
    users,
  });
}

profileForm.addEventListener("submit", (e) => {
  e.preventDefault();

  const nextDisplayName = displayNameInput.value.trim();
  const nextContact = contactInput.value.trim();
  const nextAddress = addressInput.value.trim();
  const nextBio = bioInput.value.trim();

  if (!nextDisplayName) {
    errorNode.textContent = "表示名を入力してください";
    errorNode.classList.remove("hidden");
    savedNode.classList.add("hidden");
    return;
  }

  errorNode.classList.add("hidden");

  if (nextDisplayName !== user.displayName) {
    migrateDisplayNameInState(user.displayName, nextDisplayName);
  }

  user.displayName = nextDisplayName;
  user.contact = nextContact;
  user.address = nextAddress;
  user.bio = nextBio;
  user.profileIcon = nextProfileIcon;
  saveUser(user);

  const latestState = loadState();
  const users = Array.isArray(latestState.users) ? latestState.users : [];
  const existingIndex = users.findIndex((entry) => entry.displayName === nextDisplayName);
  const updatedRecord = {
    id: user.id,
    displayName: nextDisplayName,
    mode: user.mode,
    contact: nextContact,
    address: nextAddress,
    bio: nextBio,
    profileIcon: nextProfileIcon,
    updatedAt: new Date().toISOString(),
  };

  if (existingIndex >= 0) {
    users[existingIndex] = {
      ...users[existingIndex],
      ...updatedRecord,
    };
  } else {
    users.push(updatedRecord);
  }

  saveState({
    ...latestState,
    users,
  });

  savedNode.classList.remove("hidden");
});

document.getElementById("openSwitch").addEventListener("click", () => {
  openModeSwitchModal({
    user,
    onApply: (nextMode) => {
      user.mode = nextMode;
      saveUser(user);
      location.reload();
    },
  });
});

document.getElementById("resetData").addEventListener("click", () => {
  if (!confirm("全データを初期化します。よろしいですか？")) return;
  saveState({ needs: [], supplies: [], messages: [], rooms: [] });
  location.href = "./board.html";
});

document.getElementById("logout").addEventListener("click", () => {
  clearUser();
  location.href = "./index.html";
});
