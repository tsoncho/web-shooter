import { Game } from "./game.js";

const canvas = document.getElementById("game");
const game = new Game(canvas);
game.init().catch((err) => {
  console.error(err);
  const el = document.getElementById("lobby-error");
  if (el) el.textContent = "Failed to init renderer. Check console.";
});
