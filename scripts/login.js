const {
  loadUser,
  saveUser,
  uid,
  loadState,
  saveState,
} = window.KizunaShared;

const existingUser = loadUser();
if (existingUser) {
  location.href = "./board.html";
}

const root = document.getElementById("loginView");
root.classList.remove("hidden");
root.innerHTML = `
  <h1>きずな〇〇</h1>
  <p class="sub">プロトタイプです。データはブラウザ内に保存されます。</p>
  <form id="loginForm" class="card">
    <label>
      表示名
      <input id="displayName" placeholder="例: ひまわり食堂" />
    </label>
    <label>
      モード
      <select id="loginType">
        <option value="KITCHEN">子ども食堂運営者</option>
        <option value="PROVIDER">提供者（企業・農家・個人）</option>
      </select>
    </label>
    <p id="loginError" class="error hidden"></p>
    <button id="startButton" class="btn" type="submit">はじめる</button>
  </form>
`;

const loginType = document.getElementById("loginType");
const startButton = document.getElementById("startButton");

function updateStartButtonColor() {
  const isKitchen = loginType.value === "KITCHEN";
  startButton.classList.toggle("kitchen-bg", isKitchen);
  startButton.classList.toggle("provider-bg", !isKitchen);
}

loginType.addEventListener("change", updateStartButtonColor);
updateStartButtonColor();

document.getElementById("loginForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const name = document.getElementById("displayName").value.trim();
  const mode = loginType.value;
  const err = document.getElementById("loginError");

  if (!name) {
    err.textContent = "表示名を入力してください";
    err.classList.remove("hidden");
    return;
  }

  const loggedInUser = { id: uid("user"), displayName: name, mode };
  saveUser(loggedInUser);

  const state = loadState();
  const existingIndex = (Array.isArray(state.users) ? state.users : []).findIndex((entry) => entry.displayName === name);
  const userRecord = {
    id: loggedInUser.id,
    displayName: name,
    mode,
    contact: "",
    bio: "",
    profileIcon: null,
    updatedAt: new Date().toISOString(),
  };

  if (existingIndex >= 0) {
    state.users[existingIndex] = {
      ...state.users[existingIndex],
      ...userRecord,
    };
  } else {
    state.users.push(userRecord);
  }

  saveState(state);
  location.href = "./board.html";
});
