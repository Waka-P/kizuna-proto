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
const bioInput = document.getElementById("profileBio");
const errorNode = document.getElementById("profileError");
const savedNode = document.getElementById("profileSaved");
const profileIconTrigger = document.getElementById("profileIconTrigger");
const profileIconPreview = document.getElementById("profileIconPreview");
const profileIconFileInput = document.getElementById("profileIconFile");

function resolveProfileIconDataUrl(icon) {
  if (!icon) return "";
  if (typeof icon === "string") return icon;
  if (typeof icon.dataUrl === "string") return icon.dataUrl;
  return "";
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

  saveState({
    ...state,
    needs: migratedNeeds,
    supplies: migratedSupplies,
    messages: migratedMessages,
  });
}

profileForm.addEventListener("submit", (e) => {
  e.preventDefault();

  const nextDisplayName = displayNameInput.value.trim();
  const nextContact = contactInput.value.trim();
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
  user.bio = nextBio;
  user.profileIcon = nextProfileIcon;
  saveUser(user);

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
