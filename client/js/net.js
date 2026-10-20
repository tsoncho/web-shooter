import { io } from "socket.io-client";
import { EVENTS } from "shared/constants.js";

export class NetClient {
  constructor() {
    this.socket = null;
    this.id = null;
    this.room = null;
    this.latest = null;
    this.onSnapshot = null;
    this.onJoined = null;
    this.onError = null;
  }

  connect() {
    if (this.socket) return;
    this.socket = io({ transports: ["websocket", "polling"] });
    this.socket.on(EVENTS.JOINED, (data) => {
      this.id = data.id;
      this.room = data.room;
      this.onJoined?.(data);
    });
    this.socket.on(EVENTS.SNAPSHOT, (snap) => {
      this.latest = snap;
      this.onSnapshot?.(snap);
    });
    this.socket.on(EVENTS.EVENT, (ev) => this.onSnapshot?.({ events: [ev], partial: true }));
    this.socket.on(EVENTS.ERROR, (err) => this.onError?.(err));
  }

  join({ name, room, team }) {
    this.connect();
    this.socket.emit(EVENTS.JOIN, { name, room, team });
  }

  sendInput(input) {
    this.socket?.emit(EVENTS.INPUT, input);
  }

  buy(item) {
    this.socket?.emit(EVENTS.BUY, { item });
  }
}
