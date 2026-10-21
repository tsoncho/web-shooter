import * as THREE from "three";
import { PHASE, TEAM, WEAPON_ORDER, WEAPONS, recoilKick } from "shared/constants.js";
import { wishXZ } from "/shared/math.js";
import { NetClient } from "./net.js";
import { createDepotMap } from "./map.js";
import { EntityManager } from "./entities.js";
import { ViewModel } from "./viewmodel.js";
import { GameAudio } from "./audio.js";
import { Hud } from "./hud.js";
import { createPost } from "./post.js";

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.net = new NetClient();
    this.hud = new Hud();
    this.clock = new THREE.Clock();
    this.seq = 0;
    this.keys = new Set();
    this.look = { yaw: 0, pitch: 0 };
    this.locked = false;
    this.fireHeld = false;
    this.fireClick = false;
    this.ads = false;
    this.snap = null;
    this.me = null;
    this.prevHp = 100;
    this.footT = 0;
    this.spray = 0;
    this.sprayReset = 0;
    this.viewPunch = { pitch: 0, yaw: 0 };
    this.localVel = { x: 0, z: 0 };
    this.wantWeapon = null;
    this.lastWeapon = "pistol";
    this.baseFov = 75;
    this.team = TEAM.ATTACKERS;
    this.spawnSynced = false;
    this.wasAlive = true;
    this.reloadPulse = false;
    this.deathCamT = 0;
    this.deathCamActive = false;

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.35;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(this.baseFov, innerWidth / innerHeight, 0.05, 160);
    this.yawObject = new THREE.Object3D();
    this.pitchObject = new THREE.Object3D();
    this.pitchObject.add(this.camera);
    this.yawObject.add(this.pitchObject);
    this.scene.add(this.yawObject);

    this.view = new ViewModel(this.camera);
    this.audio = new GameAudio(this.camera);
    this.entities = new EntityManager(this.scene);
    this.post = null;

    this.#bindUi();
    this.#bindInput();
    window.addEventListener("resize", () => this.#resize());
  }

  #lock() {
    this.canvas.requestPointerLock();
  }

  async init() {
    await createDepotMap(this.scene, this.renderer);
    this.post = createPost(this.renderer, this.scene, this.camera);
    await Promise.all([this.view.load(), this.entities.load()]);
    this.#tick();
  }

  #bindUi() {
    let selectedTeam = TEAM.ATTACKERS;
    document.querySelectorAll(".team-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".team-btn").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        selectedTeam = Number(btn.dataset.team);
      });
    });
    document.getElementById("join-btn").addEventListener("click", async () => {
      const name = document.getElementById("name-input").value.trim() || "Operative";
      const room = document.getElementById("room-input").value.trim().toUpperCase();
      this.team = selectedTeam;
      this.hud.setError("");
      try {
        await this.audio.init();
      } catch {
        /* ignore */
      }
      this.net.onJoined = () => {
        this.hud.showGame();
        this.hud.banner(`ROOM ${this.net.room}`, 3);
        this.#lock();
      };
      this.net.onError = (e) => this.hud.setError(e.message || "Join failed");
      this.net.onSnapshot = (snap) => this.#onSnap(snap);
      this.net.join({ name, room, team: selectedTeam });
    });

    document.querySelectorAll("#buy-menu [data-buy]").forEach((btn) => {
      btn.addEventListener("click", () => this.net.buy(btn.dataset.buy));
    });
  }

  #bindInput() {
    window.addEventListener("keydown", (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      if (e.code === "KeyR") this.reloadPulse = true;
      if (e.code === "Digit1" || e.code === "Numpad1") this.#requestWeapon("pistol");
      if (e.code === "Digit2" || e.code === "Numpad2") this.#requestWeapon("smg");
      if (e.code === "Digit3" || e.code === "Numpad3") this.#requestWeapon("rifle");
      if (e.code === "KeyQ") this.#requestWeapon(this.lastWeapon);
      if (e.code === "KeyB") {
        if (this.snap?.phase === PHASE.BUY) this.hud.toggleBuy();
      }
      if (e.code === "Tab") {
        e.preventDefault();
        this.hud.toggleScore(true);
      }
    });
    window.addEventListener("keyup", (e) => {
      this.keys.delete(e.code);
      if (e.code === "Tab") this.hud.toggleScore(false);
    });
    this.canvas.addEventListener("mousedown", (e) => {
      if (!this.locked) {
        this.#lock();
        return;
      }
      if (e.button === 0) {
        this.fireHeld = true;
        this.fireClick = true;
      }
      if (e.button === 2) this.ads = true;
    });
    window.addEventListener("mouseup", (e) => {
      if (e.button === 0) this.fireHeld = false;
      if (e.button === 2) this.ads = false;
    });
    window.addEventListener(
      "wheel",
      (e) => {
        if (!this.locked || !this.me) return;
        e.preventDefault();
        this.#cycleWeapon(e.deltaY > 0 ? 1 : -1);
      },
      { passive: false }
    );
    this.canvas.addEventListener("contextmenu", (e) => e.preventDefault());
    document.addEventListener("pointerlockchange", () => {
      this.locked = document.pointerLockElement === this.canvas;
    });
    document.addEventListener("mousemove", (e) => {
      if (!this.locked) return;
      const sens = 0.0022;
      this.look.yaw -= e.movementX * sens;
      this.look.pitch -= e.movementY * sens;
      this.look.pitch = Math.max(-1.4, Math.min(1.4, this.look.pitch));
    });
  }

  #requestWeapon(id) {
    if (!this.me?.owned?.[id]) {
      if (id === "smg" || id === "rifle") this.hud.banner("Buy that gun first (B)", 1.4);
      return;
    }
    if (this.me.weapon && this.me.weapon !== id) this.lastWeapon = this.me.weapon;
    this.wantWeapon = id;
  }

  #cycleWeapon(dir) {
    if (!this.me?.owned) return;
    const owned = WEAPON_ORDER.filter((id) => this.me.owned[id]);
    if (owned.length < 2) return;
    const cur = Math.max(0, owned.indexOf(this.me.weapon));
    const next = owned[(cur + dir + owned.length) % owned.length];
    this.#requestWeapon(next);
  }

  #onSnap(snap) {
    if (snap.partial) {
      for (const ev of snap.events || []) this.#handleEvent(ev, this.snap);
      return;
    }
    const prev = this.snap;
    this.snap = snap;
    this.me = snap.players.find((p) => p.id === this.net.id) || null;

    if (this.me) {
      if (this.me.health < this.prevHp) this.hud.flashDamage();
      this.prevHp = this.me.health;
      if (this.me.weapon !== this.view.weapon) {
        this.view.setWeapon(this.me.weapon, true);
      }
      const obj = this.yawObject;

      // Hard-sync on spawn / respawn / unlock so prediction doesn't fight the server
      const justRevived = this.me.alive && !this.wasAlive;
      if (!this.spawnSynced || !this.me.alive || justRevived || !this.locked) {
        obj.position.set(this.me.x, this.me.y, this.me.z);
        if (!this.me.alive || justRevived || !this.spawnSynced) {
          this.look.yaw = this.me.yaw;
          this.look.pitch = this.me.pitch;
        }
        this.spawnSynced = this.me.alive;
      } else {
        const dx = this.me.x - obj.position.x;
        const dz = this.me.z - obj.position.z;
        const err = Math.hypot(dx, dz);
        if (err > 2.5) {
          obj.position.set(this.me.x, this.me.y, this.me.z);
        } else {
          const k = err > 0.6 ? 0.35 : 0.18;
          obj.position.x += dx * k;
          obj.position.z += dz * k;
          obj.position.y = this.me.y;
        }
      }
      this.wasAlive = this.me.alive;
    }

    this.entities.sync(snap.players, this.net.id, snap.bomb);
    for (const ev of snap.events || []) this.#handleEvent(ev, prev);
  }

  #handleEvent(ev, prev) {
    if (!ev) return;
    if (ev.type === "shot") {
      this.entities.addTracer(ev);
      const pos = new THREE.Vector3(ev.ox, ev.oy, ev.oz);
      this.audio.shoot(ev.weapon, pos);
      if (ev.shooterId === this.net.id) {
        const kick = recoilKick(ev.weapon, this.spray);
        this.spray += 1;
        this.sprayReset = 0.22;
        // Real aim climb (player counters with mouse) + short view punch
        this.look.pitch = Math.min(1.4, this.look.pitch + kick.pitch * 0.85);
        this.look.yaw += kick.yaw * 0.85;
        this.viewPunch.pitch += kick.pitch * 0.55;
        this.viewPunch.yaw += kick.yaw * 0.55;
        this.view.punch(1 + kick.pitch * 8, kick.yaw * 10);
        this.hud.punchCrosshair();
        if (ev.hit) {
          this.hud.flashHit();
          this.audio.play(ev.head ? "headshot" : "hit", { volume: 0.35 });
        }
      }
    }
    if (ev.type === "kill") {
      const names = Object.fromEntries((this.snap?.players || prev?.players || []).map((p) => [p.id, p.name]));
      const killerName = names[ev.killer] || "?";
      const victimName = names[ev.victim] || "?";
      this.hud.pushKill(killerName, victimName, ev.head);
      if (ev.victim !== this.net.id) this.entities.playDeath(ev.victim);

      if (ev.killer === this.net.id && ev.victim !== this.net.id) {
        this.hud.showKillConfirm(victimName, !!ev.head);
        this.audio.play(ev.head ? "headshot" : "hit", { volume: 0.45, rate: ev.head ? 1.15 : 1 });
      }
      if (ev.victim === this.net.id) {
        this.hud.showDeath(killerName);
        this.#startDeathCam();
        this.audio.play("explode", { volume: 0.22, rate: 1.6 });
      }
    }
    if (ev.type === "phase") {
      this.audio.play("round", { volume: 0.3 });
      if (ev.phase === PHASE.BUY) this.hud.banner("BUY TIME", 2);
      if (ev.phase === PHASE.LIVE) {
        this.hud.banner("ROUND LIVE", 1.5);
        this.hud.toggleBuy(false);
      }
    }
    if (ev.type === "round_end") {
      const w = ev.winner === TEAM.ATTACKERS ? "ATTACKERS WIN" : "DEFENDERS WIN";
      this.hud.banner(`${w} · ${ev.reason}`, 4);
    }
    if (ev.type === "plant") this.audio.play("plant", { volume: 0.45 });
    if (ev.type === "defuse") this.audio.play("defuse", { volume: 0.45 });
    if (ev.type === "explode") this.audio.play("explode", { volume: 0.55 });
    if (ev.type === "match_end") {
      const w = ev.winner === TEAM.ATTACKERS ? "ATTACKERS" : "DEFENDERS";
      this.hud.banner(`MATCH OVER · ${w}`, 6);
    }
  }

  #sendInput() {
    if (!this.net.socket) return;
    const ax =
      (this.keys.has("KeyD") || this.keys.has("ArrowRight") ? 1 : 0) -
      (this.keys.has("KeyA") || this.keys.has("ArrowLeft") ? 1 : 0);
    const az =
      (this.keys.has("KeyW") || this.keys.has("ArrowUp") ? 1 : 0) -
      (this.keys.has("KeyS") || this.keys.has("ArrowDown") ? 1 : 0);
    const wpn = WEAPONS[this.me?.weapon] || WEAPONS.pistol;
    const fire =
      this.locked &&
      this.me?.alive &&
      (wpn.automatic ? this.fireHeld : this.fireClick);
    this.seq += 1;
    this.net.sendInput({
      seq: this.seq,
      ax,
      az,
      yaw: this.look.yaw,
      pitch: this.look.pitch,
      jump: this.keys.has("Space"),
      fire,
      reload: this.reloadPulse,
      ads: this.ads,
      sprint: this.keys.has("ShiftLeft") || this.keys.has("ShiftRight"),
      plant: this.keys.has("KeyE"),
      defuse: this.keys.has("KeyE"),
      wantWeapon: this.wantWeapon,
    });
    this.reloadPulse = false;
    this.fireClick = false;
    this.wantWeapon = null;
  }

  #startDeathCam() {
    this.deathCamActive = true;
    this.deathCamT = 0;
    this.view.root.visible = false;
  }

  #updateDeathCam(dt) {
    if (!this.deathCamActive) return;
    this.deathCamT += dt;
    const t = Math.min(1, this.deathCamT / 0.55);
    const ease = 1 - Math.pow(1 - t, 3);
    // Tip camera toward the ground and sink slightly
    this.pitchObject.rotation.x = THREE.MathUtils.lerp(
      this.look.pitch,
      1.15,
      ease
    );
    this.yawObject.rotation.z = THREE.MathUtils.lerp(0, 0.35, ease);
    this.yawObject.position.y = THREE.MathUtils.lerp(
      this.me?.y ?? 1.65,
      0.45,
      ease
    );
    if (this.me?.alive) {
      this.deathCamActive = false;
      this.yawObject.rotation.z = 0;
      this.view.root.visible = true;
    }
  }

  #predictLocal(dt) {
    if (this.deathCamActive || (this.me && !this.me.alive)) {
      this.#updateDeathCam(dt);
      return;
    }

    // View punch decays (extra kick on top of real aim climb)
    const recover = 1 - Math.pow(0.0002, dt);
    this.viewPunch.pitch *= 1 - recover * 0.85;
    this.viewPunch.yaw *= 1 - recover * 0.85;
    if (this.sprayReset > 0) {
      this.sprayReset -= dt;
      if (this.sprayReset <= 0) this.spray = 0;
    }

    this.yawObject.rotation.y = this.look.yaw + this.viewPunch.yaw;
    this.pitchObject.rotation.x = this.look.pitch + this.viewPunch.pitch;
    this.yawObject.rotation.z = 0;
    this.view.root.visible = true;

    const targetFov = this.ads ? 55 : this.baseFov;
    this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFov, 1 - Math.pow(0.001, dt));
    this.camera.updateProjectionMatrix();

    if (!this.locked || !this.me?.alive) return;

    const sprint = this.keys.has("ShiftLeft") || this.keys.has("ShiftRight");
    const speed = 6.8 * (sprint && !this.ads ? 1.22 : 1) * (this.ads ? 0.72 : 1);
    const ax =
      (this.keys.has("KeyD") ? 1 : 0) - (this.keys.has("KeyA") ? 1 : 0);
    const az =
      (this.keys.has("KeyW") ? 1 : 0) - (this.keys.has("KeyS") ? 1 : 0);
    let wishX = 0;
    let wishZ = 0;
    if (ax || az) {
      let { x: mx, z: mz } = wishXZ(this.look.yaw, ax, az);
      const len = Math.hypot(mx, mz) || 1;
      wishX = (mx / len) * speed;
      wishZ = (mz / len) * speed;
    }
    const accel = 28 * dt;
    this.localVel.x = approach(this.localVel.x, wishX, accel);
    this.localVel.z = approach(this.localVel.z, wishZ, accel);
    this.yawObject.position.x += this.localVel.x * dt;
    this.yawObject.position.z += this.localVel.z * dt;

    const moving = Math.hypot(this.localVel.x, this.localVel.z) > 1.2;
    if (moving) {
      this.footT -= dt;
      if (this.footT <= 0) {
        this.audio.play("footstep", { volume: 0.15, rate: 0.9 + Math.random() * 0.2 });
        this.footT = sprint ? 0.28 : 0.38;
      }
    }
  }

  #resize() {
    const w = innerWidth;
    const h = innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.post?.setSize(w, h);
  }

  #tick = () => {
    requestAnimationFrame(this.#tick);
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.#sendInput();
    this.#predictLocal(dt);
    this.view.update(dt, this.ads);
    this.entities.update(dt);
    this.hud.update(dt, this.snap, this.me);
    if (this.post) this.post.render();
    else this.renderer.render(this.scene, this.camera);
  };
}

function approach(current, target, maxDelta) {
  const d = target - current;
  if (Math.abs(d) <= maxDelta) return target;
  return current + Math.sign(d) * maxDelta;
}
