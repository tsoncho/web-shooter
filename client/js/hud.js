import { PHASE, TEAM, WEAPONS } from "shared/constants.js";

export class Hud {
  constructor() {
    this.els = {
      lobby: document.getElementById("lobby"),
      hud: document.getElementById("hud"),
      scoreA: document.getElementById("score-a"),
      scoreD: document.getElementById("score-d"),
      phase: document.getElementById("phase-label"),
      timer: document.getElementById("timer"),
      bomb: document.getElementById("bomb-status"),
      hp: document.getElementById("hp"),
      armor: document.getElementById("armor"),
      money: document.getElementById("money"),
      mag: document.getElementById("mag"),
      reserve: document.getElementById("reserve"),
      weapon: document.getElementById("weapon-name"),
      hit: document.getElementById("hit-marker"),
      dmg: document.getElementById("damage-vignette"),
      interact: document.getElementById("interact"),
      killfeed: document.getElementById("killfeed"),
      banner: document.getElementById("banner"),
      buy: document.getElementById("buy-menu"),
      board: document.getElementById("scoreboard"),
      boardA: document.getElementById("board-a"),
      boardD: document.getElementById("board-d"),
      lobbyError: document.getElementById("lobby-error"),
    };
    this.feed = [];
    this.bannerT = 0;
    this.hitT = 0;
    this.dmgT = 0;
  }

  showGame() {
    this.els.lobby.classList.add("hidden");
    this.els.hud.classList.remove("hidden");
  }

  setError(msg) {
    this.els.lobbyError.textContent = msg || "";
  }

  toggleBuy(force) {
    const show = force ?? this.els.buy.classList.contains("hidden");
    this.els.buy.classList.toggle("hidden", !show);
  }

  toggleScore(show) {
    this.els.board.classList.toggle("hidden", !show);
  }

  flashHit() {
    this.els.hit.classList.remove("show");
    void this.els.hit.offsetWidth;
    this.els.hit.classList.add("show");
    this.hitT = 0.16;
  }

  flashDamage() {
    this.els.dmg.classList.add("show");
    this.dmgT = 0.25;
  }

  banner(text, seconds = 2.5) {
    this.els.banner.textContent = text;
    this.bannerT = seconds;
  }

  pushKill(killer, victim, head) {
    const row = document.createElement("div");
    row.innerHTML = `<span class="atk">${esc(killer)}</span> ${head ? "◉" : "–"} <span class="def">${esc(victim)}</span>`;
    this.els.killfeed.prepend(row);
    while (this.els.killfeed.children.length > 6) {
      this.els.killfeed.lastChild.remove();
    }
    setTimeout(() => row.remove(), 5000);
  }

  update(dt, snap, me) {
    if (!snap) return;
    if (this.hitT > 0) {
      this.hitT -= dt;
      if (this.hitT <= 0) this.els.hit.classList.remove("show");
    }
    if (this.dmgT > 0) {
      this.dmgT -= dt;
      if (this.dmgT <= 0) this.els.dmg.classList.remove("show");
    }
    if (this.bannerT > 0) {
      this.bannerT -= dt;
      if (this.bannerT <= 0) this.els.banner.textContent = "";
    }

    this.els.scoreA.textContent = String(snap.score?.[TEAM.ATTACKERS] ?? 0);
    this.els.scoreD.textContent = String(snap.score?.[TEAM.DEFENDERS] ?? 0);
    this.els.phase.textContent = phaseLabel(snap.phase);
    this.els.timer.textContent = formatTime(snap.phaseT);

    if (snap.bomb?.planted && !snap.bomb.defused) {
      this.els.bomb.textContent = `BOMB ${formatTime(snap.bomb.fuse)}`;
    } else if (snap.bomb?.loose) {
      this.els.bomb.textContent = "BOMB DROP";
    } else {
      this.els.bomb.textContent = me?.hasBomb ? "YOU HOLD BOMB" : "";
    }

    if (me) {
      this.els.hp.textContent = String(Math.max(0, Math.ceil(me.health)));
      this.els.armor.textContent = String(Math.ceil(me.armor || 0));
      this.els.money.textContent = String(me.money ?? 0);
      this.els.mag.textContent = String(me.mag ?? 0);
      this.els.reserve.textContent = String(me.reserve ?? 0);
      this.els.weapon.textContent = WEAPONS[me.weapon]?.name || me.weapon;
    }

    // interact prompt
    let prompt = "";
    if (me?.alive) {
      if (me.hasBomb && snap.phase === PHASE.LIVE) prompt = "Hold E · Plant";
      if (snap.bomb?.planted && me.team === TEAM.DEFENDERS) prompt = "Hold E · Defuse";
      if (me.plantT > 0) prompt = `Planting… ${(me.plantT / 3.5 * 100) | 0}%`;
      if (me.defuseT > 0) prompt = `Defusing…`;
    }
    this.els.interact.textContent = prompt;

    // scoreboard lists
    const atk = [];
    const def = [];
    for (const p of snap.players || []) {
      const line = `<li><span>${esc(p.name)}${p.alive ? "" : " ✝"}</span><span>${p.kills}/${p.deaths}</span></li>`;
      if (p.team === TEAM.ATTACKERS) atk.push(line);
      else def.push(line);
    }
    this.els.boardA.innerHTML = atk.join("");
    this.els.boardD.innerHTML = def.join("");
  }
}

function phaseLabel(p) {
  return (
    {
      [PHASE.LOBBY]: "LOBBY",
      [PHASE.WARMUP]: "WARMUP",
      [PHASE.BUY]: "BUY TIME",
      [PHASE.LIVE]: "LIVE",
      [PHASE.ROUND_END]: "ROUND END",
      [PHASE.MATCH_END]: "MATCH OVER",
    }[p] || String(p || "").toUpperCase()
  );
}

function formatTime(t) {
  const s = Math.max(0, Math.ceil(t || 0));
  const m = (s / 60) | 0;
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

function esc(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
