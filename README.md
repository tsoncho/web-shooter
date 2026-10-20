# VECTOR Tactical

Multiplayer CS-style tactical FPS in the browser. **Original game** — not affiliated with Counter-Strike or Valve. Teams are Attackers / Defenders. Art and audio are CC0 / generated.

## Features

- Authoritative Node + Socket.io server (20 tick)
- Lobby with room codes, team pick, bot fill for empty slots
- Warmup → buy phase → live rounds → match point
- Bomb plant / defuse on a single site
- Economy, armor, pistol / SMG / rifle
- PBR map (Poly Haven textures + HDRI), GLB operators & viewmodels, post-processing (SSAO / bloom / SMAA)
- Layered sample SFX with spatial shots

## Play (LAN / local)

```bash
npm install
npm run dev
```

Open **http://localhost:3000** on two machines or browsers.

1. Enter a callsign  
2. Leave room blank to create, or enter the same 4-letter code to join  
3. Pick Attackers or Defenders → **Enter Match**  
4. Allow pointer lock  

Share your LAN IP (`http://YOUR_IP:3000`) for friends on the same network.

## Controls

| Input | Action |
| --- | --- |
| WASD | Move |
| Shift | Sprint |
| Mouse | Look |
| Click | Fire |
| RMB | ADS |
| R | Reload |
| E | Plant / defuse |
| B | Buy menu (buy phase) |
| Tab | Scoreboard |
| Esc | Release mouse |

## Project layout

```
client/   Three.js frontend
server/   Authoritative match sim
shared/   Constants & protocol
scripts/  Asset generators (SFX / GLB)
```

## Assets

- Textures / HDRI: [Poly Haven](https://polyhaven.com) (CC0)
- Models: generated GLBs via Three.js exporter (CC0 pipeline)
- SFX: generated WAVs in `client/assets/sfx`

Regenerate:

```bash
node scripts/gen-sfx.mjs
node scripts/gen-models.mjs
```
