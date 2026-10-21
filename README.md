# VECTOR Tactical

**VECTOR Tactical** is a browser-based, multiplayer, CS-style tactical FPS.  
Attackers plant. Defenders hold. Matches run on an authoritative Node server with a Three.js client.

> This is an **original** game. It is **not** affiliated with Counter-Strike, Valve, or any other shooter. Teams are **Attackers** / **Defenders**. Maps, models, and audio are original or CC0.

---

## Features

| Area | What you get |
| --- | --- |
| **Multiplayer** | Socket.io rooms, room codes, 20 Hz authoritative simulation |
| **Modes** | Warmup → buy phase → live round → round end → match point |
| **Objective** | Single bombsite — plant / defuse with hold timers |
| **Economy** | Money, armor, defuse kit, pistol / SMG / rifle |
| **Combat** | Hitscan, headshots, recoil, ADS, reload, tracers |
| **Presentation** | PBR arena, HDRI lighting, SSAO / bloom / SMAA, FPS viewmodel |
| **Solo-friendly** | Bots fill empty slots so you can practice alone |

---

## Quick start

```bash
git clone https://github.com/tsoncho/web-shooter.git
cd web-shooter
npm install
npm run dev
```

Open **http://localhost:3000**

1. Enter a callsign  
2. Leave **Room code** blank to create a match, or enter a friend’s 4-letter code  
3. Pick **Attackers** or **Defenders**  
4. Click **Enter Match** and allow pointer lock  

### Play over LAN

1. Host runs `npm run dev`  
2. Find the host LAN IP (e.g. `192.168.1.20`)  
3. Friends open `http://HOST_IP:3000` and join the same room code  

---

## Controls

| Input | Action |
| --- | --- |
| `W` `A` `S` `D` | Move |
| `Shift` | Sprint |
| `Space` | Jump |
| Mouse | Look |
| Left click | Fire |
| Right click | Aim down sights (ADS) |
| `R` | Reload |
| `E` | Plant (Attackers) / Defuse (Defenders) |
| `B` | Buy menu (buy phase only) |
| `Tab` | Scoreboard |
| `Esc` | Release mouse |

---

## Match rules (summary)

- **Warmup** — free fire, respawns on  
- **Buy (15s)** — spend money on guns / armor / kit; movement allowed, no live scoring fire  
- **Live** — eliminate the other team, or complete the bomb objective  
- **Attackers** win by plant + explode, or wiping Defenders  
- **Defenders** win by defuse, wipe (if bomb not planted), or round timer  
- First team to **8 rounds** wins the match  

### Economy

| Item | Price |
| --- | --- |
| Sidearm | $0 (always available) |
| SMG | $1,500 |
| Rifle | $2,700 |
| Armor | $1,000 |
| Defuse kit | $400 (Defenders) |

Kill reward, win reward, and escalating loss bonus apply between rounds.

---

## Architecture

```
web-shooter/
├── client/                 # Browser frontend (Three.js ES modules)
│   ├── index.html
│   ├── css/
│   ├── js/                 # game, net, map, entities, viewmodel, hud, audio, post
│   └── assets/             # hdr, textures, sfx, models
├── server/                 # Authoritative match + HTTP static host
│   ├── index.js            # Express + Socket.io
│   ├── match.js            # Room state machine
│   └── sim.js              # Movement, hitscan, bomb, bots
├── shared/                 # Constants + aim/move math used by both sides
├── scripts/                # Asset generators
├── package.json
└── README.md
```

### Networking

- Client sends **input packets** every frame (move axes, look, fire, plant/defuse, buy)  
- Server simulates at **20 tick** and broadcasts **snapshots** (players, bomb, phase, events)  
- Client does lightweight prediction + reconciliation so motion stays responsive  
- Hitscan, damage, economy, and bomb state are **server-authoritative**

### Coordinate system

Aim and movement share one convention (Three.js camera looking down **−Z**):

- `yaw = 0` → look / walk forward along world **−Z**  
- Shared helpers live in [`shared/math.js`](shared/math.js) so client prediction and server sim stay aligned  

---

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start game server (HTTP + WebSocket) on port 3000 |
| `npm start` | Same as `dev` |
| `npm run assets` | Regenerate SFX WAVs and optional GLB helpers |

Default port: `3000` (override with `PORT=...`).

---

## Assets & licensing

| Asset | Source | License |
| --- | --- | --- |
| Floor / wall textures | [Poly Haven](https://polyhaven.com) | CC0 |
| HDRI environment | Poly Haven | CC0 |
| Operators / viewmodels | Procedural meshes in-engine | Original |
| Sound effects | Generated WAVs (`scripts/gen-sfx.mjs`) | Original |

No Counter-Strike / Valve IP is used (no maps, models, sounds, or branding).

---

## Tech stack

- **Runtime:** Node.js (ES modules)  
- **Server:** Express, Socket.io  
- **Client:** Three.js r170, postprocessing (SSAO, bloom, SMAA)  
- **Transport:** WebSocket (Socket.io)  

---

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| Blank page / module errors | Use `npm run dev` — don’t open `index.html` as a file URL |
| Can’t look / shoot | Click the game view to re-enable pointer lock |
| Friend can’t join | Same Wi‑Fi/LAN, host firewall allows port 3000, matching room code |
| No audio | Browser blocked audio until a click — join again after interacting |
| Port in use | `PORT=3001 npm run dev` |

---

## Roadmap (ideas)

- Voice chat / text chat  
- More weapons and utility  
- Additional bombsite layouts  
- Ranked / matchmaking  
- Demo recording  

Contributions that keep the project free of third-party game IP are welcome.

---

## License

Code in this repository is provided for learning and tinkering.  
Third-party CC0 assets remain under their original CC0 terms.  
**VECTOR** name here is for this project only and does not claim any unrelated trademarks.
