import { DurableObject } from "cloudflare:workers";
import { freshGarden, readGarden, gardenAction, gardenActionAllowed } from "../features/village/garden.ts";

const MAX_VISITORS = 64;
const adjectives = ["Relaxed", "Sleepy", "Cosy", "Sunny", "Gentle", "Snuggly", "Cheerful", "Drowsy", "Mellow", "Kind", "Rosy", "Dreamy", "Soft", "Warm", "Little", "Jolly", "Calm", "Cloudy", "Happy", "Fluffy"];
const animals = ["Panda", "Bunny", "Otter", "Duckling", "Fox", "Kitten", "Hedgehog", "Fawn", "Penguin", "Puffin", "Koala", "Sparrow", "Seal", "Mouse", "Lamb", "Turtle", "Robin", "Swan", "Cub", "Wren"];

function colorForSlot(slot) {
  const hue = (slot * 137.508 + 10) % 360;
  const saturation = 0.62, lightness = 0.68;
  const c = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const x = c * (1 - Math.abs((hue / 60) % 2 - 1));
  const m = lightness - c / 2;
  const [r, g, b] = hue < 60 ? [c, x, 0] : hue < 120 ? [x, c, 0] : hue < 180 ? [0, c, x]
    : hue < 240 ? [0, x, c] : hue < 300 ? [x, 0, c] : [c, 0, x];
  return `#${[r, g, b].map(value => Math.round((value + m) * 255).toString(16).padStart(2, "0")).join("")}`;
}

function validAction(action, bedCount) {
  if (!action || typeof action !== "object") return false;
  if (["plant", "water", "harvest"].includes(action.kind)) {
    if (!Number.isInteger(action.bed) || action.bed < 0 || action.bed >= bedCount) return false;
    return action.kind !== "plant" || ["carrot", "radish", "mint", "daisy", "sunflower"].includes(action.crop);
  }
  if (action.kind === "gift") return ["carrot", "radish", "mint", "daisy", "sunflower"].includes(action.crop);
  return ["flowers", "drink", "crumbs", "feed", "birdCrumbs", "feedBirds"].includes(action.kind);
}

function send(socket, message) {
  try { socket.send(JSON.stringify(message)); }
  catch { /* A closed connection is removed by webSocketClose. */ }
}

export class VillageWorld extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.garden = readGarden(JSON.stringify(ctx.storage.kv.get("garden") || freshGarden()));
    const savedChat = ctx.storage.kv.get("chat");
    this.chatHour = Math.floor(Date.now() / 3_600_000);
    this.chat = savedChat?.hour === this.chatHour ? savedChat.entries : [];
  }

  sockets() { return this.ctx.getWebSockets(); }

  visitors() {
    return this.sockets().map(socket => socket.deserializeAttachment()).filter(Boolean);
  }

  broadcast(message, except) {
    for (const socket of this.sockets()) if (socket !== except) send(socket, message);
  }

  rollHour() {
    const hour = Math.floor(Date.now() / 3_600_000);
    if (hour !== this.chatHour) {
      this.chatHour = hour;
      this.chat = [];
      this.ctx.storage.kv.put("chat", { hour, entries: [] });
      this.broadcast({ type: "hour", chatHour: hour });
    }
    void this.ctx.storage.setAlarm((hour + 1) * 3_600_000);
  }

  async alarm() { this.rollHour(); }

  async fetch(request) {
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") return new Response("WebSocket required", { status: 426 });
    this.rollHour();
    if (this.sockets().length >= MAX_VISITORS) return new Response("Village full", { status: 503 });
    const used = new Set(this.visitors().map(visitor => visitor.name));
    const names = adjectives.flatMap(adjective => animals.map(animal => `${adjective} ${animal}`));
    let name = names[Math.floor(Math.random() * names.length)];
    while (used.has(name)) name = names[Math.floor(Math.random() * names.length)];
    const slot = (this.ctx.storage.kv.get("nextSlot") || 0) + 1;
    this.ctx.storage.kv.put("nextSlot", slot);
    const visitor = { id: crypto.randomUUID(), name, color: colorForSlot(slot), slot, x: 0, z: 0, heading: 0, lastMove: 0, lastChat: 0 };
    const [client, server] = Object.values(new WebSocketPair());
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment(visitor);
    send(server, {
      type: "welcome", selfId: visitor.id,
      visitors: this.visitors().map(({ id, name, color, slot, x, z, heading }) => ({ id, name, color, slot, x, z, heading })),
      garden: this.garden, chatHour: this.chatHour, chat: this.chat,
    });
    this.broadcast({ type: "join", visitor: { id: visitor.id, name, color: visitor.color, slot, x: 0, z: 0, heading: 0 } }, server);
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(socket, raw) {
    if (typeof raw !== "string" || raw.length > 2048) return;
    let message;
    try { message = JSON.parse(raw); }
    catch { return; }
    if (!message || typeof message !== "object") return;
    const visitor = socket.deserializeAttachment();
    if (!visitor) return;
    if (message.type === "move") {
      const now = Date.now();
      if (now - visitor.lastMove < 80 || ![message.x, message.z, message.heading].every(Number.isFinite)) return;
      visitor.lastMove = now;
      visitor.x = Math.max(-160, Math.min(160, message.x));
      visitor.z = Math.max(-160, Math.min(160, message.z));
      visitor.heading = Math.max(-Math.PI, Math.min(Math.PI, message.heading));
      socket.serializeAttachment(visitor);
      this.broadcast({ type: "move", id: visitor.id, x: visitor.x, z: visitor.z, heading: visitor.heading }, socket);
    } else if (message.type === "garden" && validAction(message.action, this.garden.beds.length)) {
      const action = message.action;
      if (action.kind !== "feedBirds" && !gardenActionAllowed(this.garden, action)) return;
      this.garden = gardenAction(this.garden, action);
      this.ctx.storage.kv.put("garden", this.garden);
      this.broadcast({ type: "garden", garden: this.garden, event: { action, actor: visitor.id, x: visitor.x, z: visitor.z } });
    } else if (message.type === "chat" && typeof message.message === "string") {
      const now = Date.now();
      const text = message.message.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, 180);
      if (!text || now - visitor.lastChat < 3000) return;
      visitor.lastChat = now;
      socket.serializeAttachment(visitor);
      this.rollHour();
      const entry = { name: visitor.name, message: text };
      this.chat = [...this.chat, entry].slice(-80);
      this.ctx.storage.kv.put("chat", { hour: this.chatHour, entries: this.chat });
      this.broadcast({ type: "chat", chatHour: this.chatHour, entry });
    }
  }

  async webSocketClose(socket) {
    const visitor = socket.deserializeAttachment();
    if (visitor) this.broadcast({ type: "leave", id: visitor.id }, socket);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/health") return Response.json({ ok: true });
    if (url.pathname !== "/" || request.method !== "GET") return new Response("Not found", { status: 404 });
    const origin = request.headers.get("Origin");
    if (origin !== "https://cosy.sabarg.com" && origin !== "http://127.0.0.1:3051") return new Response("Forbidden", { status: 403 });
    return env.VILLAGE.getByName("one-shared-village").fetch(request);
  },
};
