import {
  ECONOMY,
  EVENTS,
  MATCH,
  PHASE,
  TEAM,
  TICK_DT,
  TICK_RATE,
  WEAPON,
} from "../shared/constants.js";
import {
  botBrain,
  buyItem,
  createPlayer,
  emptyInput,
  integratePlayer,
  serializePlayer,
  spawnPlayer,
  tryFire,
  updateBombInteract,
} from "./sim.js";

let roomSeq = 1;

export class MatchRoom {
  constructor(code) {
    this.code = code || genCode();
    this.players = new Map();
    this.sockets = new Map();
    this.phase = PHASE.LOBBY;
    this.phaseT = 0;
    this.round = 0;
    this.score = { [TEAM.ATTACKERS]: 0, [TEAM.DEFENDERS]: 0 };
    this.bomb = emptyBomb();
    this.tick = 0;
    this.events = [];
    this.started = false;
    this.bombCarrierId = null;
    this._interval = setInterval(() => this.step(), 1000 / TICK_RATE);
  }

  destroy() {
    clearInterval(this._interval);
  }

  addPlayer(socket, { name, team, room }) {
    if (this.players.size >= MATCH.maxPlayers) {
      socket.emit(EVENTS.ERROR, { message: "Room full" });
      return;
    }
    const counts = this.teamCounts();
    let t = team === TEAM.DEFENDERS || team === TEAM.ATTACKERS ? team : null;
    if (t == null) {
      t = counts[TEAM.ATTACKERS] <= counts[TEAM.DEFENDERS]
        ? TEAM.ATTACKERS
        : TEAM.DEFENDERS;
    }
    const p = createPlayer(socket.id, name || "Operative", t, false);
    this.players.set(socket.id, p);
    this.sockets.set(socket.id, socket);
    spawnPlayer(p, this);
    socket.join(this.code);
    socket.emit(EVENTS.JOINED, {
      id: socket.id,
      room: this.code,
      team: p.team,
    });
    this.broadcastEvent({ type: "join", id: p.id, name: p.name, team: p.team });

    if (this.phase === PHASE.LOBBY && this.humanCount() >= 1) {
      this.fillBots();
      this.enterWarmup();
    }
  }

  removePlayer(id) {
    const p = this.players.get(id);
    if (!p) return;
    this.players.delete(id);
    this.sockets.delete(id);
    this.broadcastEvent({ type: "leave", id });
    if (this.humanCount() === 0) {
      // keep bots running briefly; room GC handled outside
    }
  }

  humanCount() {
    let n = 0;
    for (const p of this.players.values()) if (!p.isBot) n++;
    return n;
  }

  teamCounts() {
    const c = { [TEAM.ATTACKERS]: 0, [TEAM.DEFENDERS]: 0 };
    for (const p of this.players.values()) c[p.team]++;
    return c;
  }

  fillBots() {
    const target = 4; // 2v2 feel for solo
    while (this.players.size < target) {
      const counts = this.teamCounts();
      const team =
        counts[TEAM.ATTACKERS] <= counts[TEAM.DEFENDERS]
          ? TEAM.ATTACKERS
          : TEAM.DEFENDERS;
      const id = `bot-${roomSeq++}`;
      const bot = createPlayer(id, botName(), team, true);
      this.players.set(id, bot);
      spawnPlayer(bot, this);
    }
  }

  setInput(id, input) {
    const p = this.players.get(id);
    if (!p || p.isBot) return;
    p.input = {
      ...emptyInput(),
      ...input,
      ax: clamp(input.ax ?? 0, -1, 1),
      az: clamp(input.az ?? 0, -1, 1),
      yaw: input.yaw ?? p.yaw,
      pitch: input.pitch ?? p.pitch,
    };
    p.seq = input.seq ?? p.seq;
  }

  buy(id, item) {
    const p = this.players.get(id);
    if (!p) return;
    const res = buyItem(p, item, this.phase === PHASE.BUY);
    const sock = this.sockets.get(id);
    if (sock) sock.emit(EVENTS.EVENT, { type: "buy_result", ...res, item });
  }

  enterWarmup() {
    this.phase = PHASE.WARMUP;
    this.phaseT = MATCH.warmupTime;
    this.started = true;
    this.broadcastEvent({ type: "phase", phase: this.phase, t: this.phaseT });
  }

  startRound() {
    this.round += 1;
    this.phase = PHASE.BUY;
    this.phaseT = MATCH.buyTime;
    this.bomb = emptyBomb();
    this.events = [];

    // assign bomb
    const attackers = [...this.players.values()].filter(
      (p) => p.team === TEAM.ATTACKERS
    );
    this.bombCarrierId = attackers.length
      ? attackers[Math.floor(Math.random() * attackers.length)].id
      : null;

    for (const p of this.players.values()) {
      p.hasBomb = p.id === this.bombCarrierId;
      spawnPlayer(p, this);
      // keep guns between rounds; pistol if somehow missing
      if (!p.weapon) p.weapon = WEAPON.PISTOL;
    }

    this.broadcastEvent({
      type: "phase",
      phase: this.phase,
      t: this.phaseT,
      round: this.round,
      score: this.score,
    });
  }

  enterLive() {
    this.phase = PHASE.LIVE;
    this.phaseT = MATCH.roundTime;
    this.broadcastEvent({ type: "phase", phase: this.phase, t: this.phaseT });
  }

  endRound(winner, reason) {
    if (this.phase === PHASE.ROUND_END || this.phase === PHASE.MATCH_END) return;
    this.phase = PHASE.ROUND_END;
    this.phaseT = MATCH.roundEndTime;
    this.score[winner] += 1;

    for (const p of this.players.values()) {
      const won = p.team === winner;
      if (won) {
        p.money = Math.min(ECONOMY.maxMoney, p.money + ECONOMY.winReward);
        p.lossStreak = 0;
      } else {
        p.lossStreak += 1;
        const bonus = Math.min(
          ECONOMY.maxLossBonus,
          ECONOMY.lossBase + (p.lossStreak - 1) * ECONOMY.lossIncrement
        );
        p.money = Math.min(ECONOMY.maxMoney, p.money + bonus);
      }
    }

    this.broadcastEvent({
      type: "round_end",
      winner,
      reason,
      score: this.score,
      round: this.round,
    });

    if (
      this.score[TEAM.ATTACKERS] >= MATCH.roundsToWin ||
      this.score[TEAM.DEFENDERS] >= MATCH.roundsToWin
    ) {
      this.phase = PHASE.MATCH_END;
      this.phaseT = 12;
      this.broadcastEvent({
        type: "match_end",
        winner:
          this.score[TEAM.ATTACKERS] > this.score[TEAM.DEFENDERS]
            ? TEAM.ATTACKERS
            : TEAM.DEFENDERS,
        score: this.score,
      });
    }
  }

  step() {
    const dt = TICK_DT;
    this.tick += 1;
    this.phaseT = Math.max(0, this.phaseT - dt);
    const list = [...this.players.values()];
    const shotEvents = [];

    if (
      this.phase === PHASE.WARMUP ||
      this.phase === PHASE.BUY ||
      this.phase === PHASE.LIVE
    ) {
      for (const p of list) {
        if (p.isBot) botBrain(p, list, this.bomb, this.phase);
        integratePlayer(p, dt);

        if (this.phase === PHASE.WARMUP && !p.alive) {
          p.spawnLock -= dt;
          if (p.spawnLock <= 0) spawnPlayer(p, this);
        }

        if (this.phase === PHASE.LIVE || this.phase === PHASE.WARMUP) {
          const automatic = p.input.fire;
          if (automatic) {
            const shot = tryFire(p, list);
            if (shot) {
              shotEvents.push(shot);
              if (shot.hit && shot.killed) {
                const killer = this.players.get(shot.shooterId);
                if (killer) {
                  killer.kills += 1;
                  killer.money = Math.min(
                    ECONOMY.maxMoney,
                    killer.money + ECONOMY.killReward
                  );
                }
                // drop bomb
                const victim = this.players.get(shot.targetId);
                if (victim && this.bombCarrierId === victim.id && !this.bomb.planted) {
                  this.bombCarrierId = null;
                  // nearest attacker can pick - simplified: give to random living attacker later via touch
                  this.bomb.loose = true;
                  this.bomb.x = victim.x;
                  this.bomb.z = victim.z;
                }
                if (this.phase === PHASE.WARMUP) {
                  victim.spawnLock = MATCH.respawnWarmup;
                }
                this.events.push({
                  type: "kill",
                  killer: shot.shooterId,
                  victim: shot.targetId,
                  head: shot.head,
                  weapon: shot.weapon,
                });
              }
            }
          }
        }
      }

      // bomb pickup
      if (this.bomb.loose && !this.bomb.planted) {
        for (const p of list) {
          if (
            p.alive &&
            p.team === TEAM.ATTACKERS &&
            Math.hypot(p.x - this.bomb.x, p.z - this.bomb.z) < 1.2
          ) {
            p.hasBomb = true;
            this.bombCarrierId = p.id;
            this.bomb.loose = false;
            this.events.push({ type: "bomb_pickup", by: p.id });
            break;
          }
        }
      }

      if (this.phase === PHASE.LIVE) {
        const be = updateBombInteract(list, this.bomb, dt);
        for (const e of be) {
          this.events.push(e);
          if (e.type === "explode") this.endRound(TEAM.ATTACKERS, "bomb");
          if (e.type === "defuse") this.endRound(TEAM.DEFENDERS, "defuse");
        }
        if (this.phase === PHASE.LIVE) this.checkElim();
        if (this.phase === PHASE.LIVE && this.phaseT <= 0 && !this.bomb.planted) {
          this.endRound(TEAM.DEFENDERS, "time");
        }
        if (
          this.phase === PHASE.LIVE &&
          this.bomb.planted &&
          !this.bomb.defused &&
          this.bomb.fuse <= 0
        ) {
          // explode handled in updateBombInteract
        }
      }
    }

    // phase transitions
    if (this.phase === PHASE.WARMUP && this.phaseT <= 0) this.startRound();
    else if (this.phase === PHASE.BUY && this.phaseT <= 0) this.enterLive();
    else if (this.phase === PHASE.ROUND_END && this.phaseT <= 0) this.startRound();
    else if (this.phase === PHASE.MATCH_END && this.phaseT <= 0) {
      this.score = { [TEAM.ATTACKERS]: 0, [TEAM.DEFENDERS]: 0 };
      this.round = 0;
      for (const p of this.players.values()) {
        p.money = ECONOMY.startMoney;
        p.kills = 0;
        p.deaths = 0;
        p.weapon = WEAPON.PISTOL;
        p.armor = 0;
        p.hasKit = false;
        p.lossStreak = 0;
      }
      this.enterWarmup();
    }

    for (const s of shotEvents) this.events.push({ type: "shot", ...s });

    this.broadcastSnapshots();
    this.events = [];
  }

  checkElim() {
    const aliveA = [...this.players.values()].filter(
      (p) => p.alive && p.team === TEAM.ATTACKERS
    ).length;
    const aliveD = [...this.players.values()].filter(
      (p) => p.alive && p.team === TEAM.DEFENDERS
    ).length;
    if (aliveA === 0 && aliveD === 0) {
      this.endRound(TEAM.DEFENDERS, "time");
      return;
    }
    if (aliveA === 0) {
      if (this.bomb.planted && !this.bomb.defused) return; // defuse still possible conceptually; attackers dead → defenders win unless bomb already ticking — CS: defenders still need to survive/defuse. If all T dead and bomb planted, CT win only on defuse or they can wait. Actually in CS if all T dead and bomb planted, CT must defuse. So don't end yet.
      if (!this.bomb.planted) this.endRound(TEAM.DEFENDERS, "elimination");
      return;
    }
    if (aliveD === 0) this.endRound(TEAM.ATTACKERS, "elimination");
  }

  broadcastSnapshots() {
    for (const [id, socket] of this.sockets) {
      const payload = {
        tick: this.tick,
        phase: this.phase,
        phaseT: +this.phaseT.toFixed(2),
        round: this.round,
        score: this.score,
        bomb: {
          planted: this.bomb.planted,
          defused: this.bomb.defused,
          loose: !!this.bomb.loose,
          x: this.bomb.x,
          z: this.bomb.z,
          fuse: this.bomb.planted ? +this.bomb.fuse.toFixed(2) : 0,
        },
        players: [...this.players.values()].map((p) => serializePlayer(p, id)),
        events: this.events,
      };
      socket.emit(EVENTS.SNAPSHOT, payload);
    }
  }

  broadcastEvent(ev) {
    this.events.push(ev);
  }
}

function emptyBomb() {
  return {
    planted: false,
    defused: false,
    loose: false,
    x: 0,
    z: 0,
    fuse: 0,
    planterId: null,
  };
}

function genCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 4; i++) s += chars[(Math.random() * chars.length) | 0];
  return s;
}

function botName() {
  const n = ["Nova", "Reed", "Vesper", "Quill", "Axen", "Marrow", "Pike", "Sable"];
  return n[(Math.random() * n.length) | 0];
}

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

export const rooms = new Map();

export function getOrCreateRoom(code) {
  if (code) {
    const existing = rooms.get(code.toUpperCase());
    if (existing) return existing;
  }
  const room = new MatchRoom(code ? code.toUpperCase() : undefined);
  rooms.set(room.code, room);
  return room;
}
