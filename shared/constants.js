export const TICK_RATE = 20;
export const TICK_DT = 1 / TICK_RATE;

export const TEAM = {
  ATTACKERS: 0,
  DEFENDERS: 1,
};

export const PHASE = {
  LOBBY: "lobby",
  WARMUP: "warmup",
  BUY: "buy",
  LIVE: "live",
  ROUND_END: "round_end",
  MATCH_END: "match_end",
};

export const WEAPON = {
  PISTOL: "pistol",
  SMG: "smg",
  RIFLE: "rifle",
};

export const WEAPONS = {
  pistol: {
    id: "pistol",
    name: "Sidearm",
    price: 0,
    damage: 28,
    headMult: 3.2,
    rpm: 400,
    magSize: 12,
    reserve: 36,
    spread: 0.012,
    recoil: 0.018,
    moveSpread: 0.02,
    adsSpread: 0.006,
    range: 90,
    automatic: false,
  },
  smg: {
    id: "smg",
    name: "SMG",
    price: 1500,
    damage: 22,
    headMult: 2.4,
    rpm: 750,
    magSize: 30,
    reserve: 90,
    spread: 0.018,
    recoil: 0.014,
    moveSpread: 0.028,
    adsSpread: 0.01,
    range: 70,
    automatic: true,
  },
  rifle: {
    id: "rifle",
    name: "Rifle",
    price: 2700,
    damage: 33,
    headMult: 3.8,
    rpm: 600,
    magSize: 30,
    reserve: 90,
    spread: 0.01,
    recoil: 0.02,
    moveSpread: 0.035,
    adsSpread: 0.004,
    range: 120,
    automatic: true,
  },
};

export const ECONOMY = {
  startMoney: 800,
  maxMoney: 16000,
  killReward: 300,
  winReward: 3250,
  lossBase: 1400,
  lossIncrement: 500,
  maxLossBonus: 3400,
  armorPrice: 1000,
  armorValue: 100,
  kitPrice: 400,
};

export const MATCH = {
  maxPlayers: 10,
  buyTime: 15,
  roundTime: 115,
  roundEndTime: 5,
  warmupTime: 20,
  roundsToWin: 8,
  plantTime: 3.5,
  defuseTime: 5,
  defuseTimeKit: 3.2,
  bombFuse: 40,
  playerRadius: 0.45,
  eyeHeight: 1.65,
  crouchEye: 1.15,
  moveSpeed: 6.2,
  sprintMult: 1.15,
  jumpVel: 7.2,
  gravity: 22,
  respawnWarmup: 3,
};

export const MAP = {
  half: 36,
  bombsite: { x: -22, z: -22, half: 5.5 },
  attackerSpawns: [
    { x: 24, z: 24, yaw: Math.PI },
    { x: 26, z: 22, yaw: Math.PI },
    { x: 22, z: 26, yaw: Math.PI },
    { x: 28, z: 20, yaw: Math.PI },
    { x: 20, z: 28, yaw: Math.PI },
  ],
  defenderSpawns: [
    { x: -24, z: -18, yaw: 0 },
    { x: -26, z: -20, yaw: 0 },
    { x: -20, z: -16, yaw: 0 },
    { x: -28, z: -22, yaw: 0 },
    { x: -18, z: -24, yaw: 0 },
  ],
  colliders: [
    { x: 0, z: 0, halfX: 2.2, halfZ: 2.2 },
    { x: -10, z: 8, halfX: 1.4, halfZ: 4 },
    { x: 10, z: -8, halfX: 1.4, halfZ: 4 },
    { x: -14, z: -10, halfX: 3, halfZ: 1.2 },
    { x: 14, z: 10, halfX: 3, halfZ: 1.2 },
    { x: 0, z: 16, halfX: 6, halfZ: 1.1 },
    { x: 0, z: -16, halfX: 6, halfZ: 1.1 },
    { x: 16, z: 0, halfX: 1.1, halfZ: 6 },
    { x: -16, z: 0, halfX: 1.1, halfZ: 6 },
    { x: -22, z: -14, halfX: 2, halfZ: 2 },
    { x: 8, z: 20, halfX: 2.5, halfZ: 1.2 },
    { x: -8, z: -20, halfX: 2.5, halfZ: 1.2 },
  ],
};

export const EVENTS = {
  JOIN: "join",
  JOINED: "joined",
  INPUT: "input",
  SNAPSHOT: "snapshot",
  EVENT: "event",
  BUY: "buy",
  READY: "ready",
  CHAT: "chat",
  ERROR: "error",
};
