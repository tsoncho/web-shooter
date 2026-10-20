import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import path from "path";
import { fileURLToPath } from "url";
import { EVENTS } from "../shared/constants.js";
import { getOrCreateRoom, rooms } from "./match.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const clientDir = path.join(root, "client");

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: "*" },
});

app.use("/shared", express.static(path.join(root, "shared")));
app.use("/node_modules", express.static(path.join(root, "node_modules")));
app.use(express.static(clientDir));
app.get("*", (_req, res) => {
  res.sendFile(path.join(clientDir, "index.html"));
});

io.on("connection", (socket) => {
  let roomCode = null;

  socket.on(EVENTS.JOIN, (data = {}) => {
    try {
      if (roomCode) {
        const prev = rooms.get(roomCode);
        prev?.removePlayer(socket.id);
      }
      const room = getOrCreateRoom(data.room);
      roomCode = room.code;
      room.addPlayer(socket, {
        name: data.name,
        team: data.team,
        room: data.room,
      });
    } catch (err) {
      socket.emit(EVENTS.ERROR, { message: String(err.message || err) });
    }
  });

  socket.on(EVENTS.INPUT, (input) => {
    if (!roomCode) return;
    rooms.get(roomCode)?.setInput(socket.id, input || {});
  });

  socket.on(EVENTS.BUY, ({ item } = {}) => {
    if (!roomCode || !item) return;
    rooms.get(roomCode)?.buy(socket.id, item);
  });

  socket.on("disconnect", () => {
    if (!roomCode) return;
    const room = rooms.get(roomCode);
    room?.removePlayer(socket.id);
    if (room && room.humanCount() === 0) {
      room.destroy();
      rooms.delete(roomCode);
    }
  });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`VECTOR Tactical listening on http://localhost:${PORT}`);
});
