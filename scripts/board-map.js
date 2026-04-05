const {
  ensureUser,
} = window.KizunaShared;

const user = ensureUser("./index.html");
if (!user) {
  throw new Error("User not found");
}

const root = document.getElementById("appView");
root.classList.remove("hidden");
root.classList.add("board-map-app");
root.innerHTML = `
  <section class="board-map-page" aria-label="マップ画面">
    <a class="board-map-back-fab" href="./board.html" aria-label="一覧へ戻る"><span>&lang;</span>戻る</a>

    <div class="board-map-stage board-map-stage-full" role="img" aria-label="地図のダミー表示">
      <span class="board-map-pin map-main"></span>
      <span class="board-map-pin map-sub-a"></span>
      <span class="board-map-pin map-sub-b"></span>
      <div class="board-map-center-label">現在地付近</div>
      <p class="board-map-full-note">プロトタイプ表示: この全画面領域に実際の地図を配置します。</p>
    </div>
  </section>
`;
