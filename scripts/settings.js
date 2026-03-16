const {
  ensureUser,
  saveUser,
  clearUser,
  saveState,
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

  <section>
    <article class="card">
      <h2>モード切替</h2>
      <p class="sub">現在モード: ${user.mode === "KITCHEN" ? "子ども食堂" : "提供者"}</p>
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
