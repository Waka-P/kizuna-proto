(() => {
const STORAGE_KEY = "kizuna_proto_state_v1";
const USER_KEY = "kizuna_proto_user_v1";
const CATEGORIES = ["米", "野菜", "肉魚", "お菓子", "備品", "その他"];

const defaultState = {
  needs: [],
  supplies: [],
  messages: [],
  rooms: [],
  updatedAt: new Date().toISOString(),
};

function uid(prefix) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(defaultState);
    const parsed = JSON.parse(raw);
    return {
      ...structuredClone(defaultState),
      ...parsed,
      needs: Array.isArray(parsed.needs) ? parsed.needs : [],
      supplies: Array.isArray(parsed.supplies) ? parsed.supplies : [],
      messages: Array.isArray(parsed.messages) ? parsed.messages : [],
    };
  } catch (_e) {
    return structuredClone(defaultState);
  }
}

function saveState(state) {
  const nextState = {
    ...state,
    updatedAt: new Date().toISOString(),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
}

function loadUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (_e) {
    return null;
  }
}

function saveUser(user) {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

function clearUser() {
  localStorage.removeItem(USER_KEY);
}

function ensureUser(redirectTo = "index.html") {
  const user = loadUser();
  if (!user) {
    location.href = redirectTo;
    return null;
  }
  return user;
}

function formatDate(value) {
  return new Date(value).toLocaleString("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ dataUrl: reader.result, type: file.type || "application/octet-stream", name: file.name });
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function renderHeaderHtml(user, title) {
  const isKitchen = user.mode === "KITCHEN";
  const modeText = isKitchen ? "子ども食堂" : "提供者";
  return `
    <header class="header-row">
      <div>
        <h1>${title || "きずな〇〇"}</h1>
        <p class="sub">こんにちは、${escapeHtml(user.displayName)} さん</p>
      </div>
      <span class="status-badge ${isKitchen ? "kitchen" : "provider"}">${modeText}</span>
    </header>
  `;
}

function renderBottomNavHtml(current, user) {
  const modeClass = user.mode === "KITCHEN" ? "kitchen" : "provider";
  return `
    <nav class="bottom-nav ${modeClass}">
      <a href="./board.html" class="${current === "board" ? "active" : ""}">一覧</a>
      <a href="./post.html" class="${current === "post" ? "active" : ""}">投稿</a>
      <a href="./chat.html" class="${current === "chat" ? "active" : ""}">チャット</a>
      <a href="./settings.html" class="${current === "settings" ? "active" : ""}">設定</a>
    </nav>
  `;
}

function getChatCandidates(state, userName) {
  const names = new Set();
  [...state.needs, ...state.supplies].forEach((item) => {
    if (item.author && item.author !== userName) names.add(item.author);
  });
  state.messages.forEach((message) => {
    if (message.sender && message.sender !== userName) names.add(message.sender);
    if (message.receiver && message.receiver !== userName) names.add(message.receiver);
  });
  return [...names].sort((a, b) => a.localeCompare(b, "ja"));
}

function getDirectMessagesWith(state, userName, partnerName) {
  if (!partnerName) return [];
  return state.messages
    .filter((message) => {
      const myToPartner = message.sender === userName && message.receiver === partnerName;
      const partnerToMe = message.sender === partnerName && message.receiver === userName;
      return myToPartner || partnerToMe;
    })
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

function getChatSummaries(state, userName) {
  return getChatCandidates(state, userName)
    .map((partnerName) => {
      const messages = getDirectMessagesWith(state, userName, partnerName);
      const lastMessage = messages[messages.length - 1] || null;
      return { partnerName, lastMessage };
    })
    .sort((a, b) => {
      const aTime = a.lastMessage ? new Date(a.lastMessage.createdAt).getTime() : 0;
      const bTime = b.lastMessage ? new Date(b.lastMessage.createdAt).getTime() : 0;
      return bTime - aTime;
    });
}

function openModeSwitchModal({ user, onApply }) {
  const modal = document.getElementById("switchModal");
  const root = document.getElementById("switchModalContent");
  if (!modal || !root) return;

  let selected = user.mode;

  function closeModal() {
    modal.classList.remove("open");
  }

  function draw() {
    const showAction = selected && selected !== user.mode;
    const showCancel = selected && selected === user.mode;

    root.innerHTML = `
      <p class="switch-modal-note">モードを切り替えると<br />入力中の内容はリセットされます</p>
      <div class="role-grid">
        <label class="role-card kitchen ${selected === "KITCHEN" ? "selected" : ""}">
          <input type="radio" name="mode" value="KITCHEN" ${selected === "KITCHEN" ? "checked" : ""} />
          <h3>子ども食堂</h3>
          <p class="sub">ニーズ投稿・余剰物資の確認</p>
        </label>
        <label class="role-card provider ${selected === "PROVIDER" ? "selected" : ""}">
          <input type="radio" name="mode" value="PROVIDER" ${selected === "PROVIDER" ? "checked" : ""} />
          <h3>提供者</h3>
          <p class="sub">余剰物資投稿・食堂ニーズの確認</p>
        </label>
      </div>
      ${showCancel ? '<button id="switchCancel" class="ghost" type="button">キャンセル</button>' : ""}
      ${showAction ? `<button id="switchApply" class="btn ${selected === "KITCHEN" ? "kitchen-bg" : "provider-bg"}" type="button">切り替える</button>` : ""}
    `;

    root.querySelectorAll('input[name="mode"]').forEach((radio) => {
      radio.addEventListener("change", () => {
        selected = radio.value;
        draw();
      });
    });

    const cancel = document.getElementById("switchCancel");
    if (cancel) cancel.addEventListener("click", closeModal);

    const apply = document.getElementById("switchApply");
    if (apply) {
      apply.addEventListener("click", () => {
        onApply(selected);
        closeModal();
      });
    }
  }

  modal.classList.add("open");
  draw();
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  }, { once: true });
}

window.KizunaShared = {
  CATEGORIES,
  uid,
  loadState,
  saveState,
  loadUser,
  saveUser,
  clearUser,
  ensureUser,
  formatDate,
  escapeHtml,
  readFileAsDataUrl,
  renderHeaderHtml,
  renderBottomNavHtml,
  getChatCandidates,
  getDirectMessagesWith,
  getChatSummaries,
  openModeSwitchModal,
};
})();
