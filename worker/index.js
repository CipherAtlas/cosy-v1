import { DurableObject } from "cloudflare:workers";
import { freshGarden, readGarden, growGarden, gardenAction, gardenActionAllowed } from "../features/village/garden.ts";
import { GARDEN_TARGETS } from "../features/village/garden.ts";
import { VillageSimulation } from "./simulation.ts";
import { towerLookout, LOOKOUT_CAPACITY } from "../features/village/towerLookout.ts";
import { ACTIVITY_STAGES } from "../features/village/sharedActors.ts";

const MAX_VISITORS = 64;
const PRIVATE_CROP_KEYS = ["carrots", "radishes", "mint", "daisies", "sunflowers", "mintTea"];
const INVENTORY_KEYS = ["apples", "mushrooms", ...PRIVATE_CROP_KEYS, "gardenSoup", "crispSalad", "bakedApples", "roastRoots"];
/** @param {import("../features/village/townShared").ForageInventory} [value] @returns {Required<import("../features/village/townShared").ForageInventory>} */
function inventoryValue(value) {
  return /** @type {Required<import("../features/village/townShared").ForageInventory>} */ (Object.fromEntries(INVENTORY_KEYS.map(key => [key, Number.isFinite(value?.[key]) ? Math.max(0, Math.min(9999, Math.floor(value?.[key] ?? 0))) : 0])));
}
const KICK_DURATION_MS = 5 * 60_000;
const MAX_SWING_ANGLE = 78 * Math.PI / 180;
const PUPPY_TRICK_SECONDS = { sit: 7, dance: 5.2, spin: 3.2, bow: 3.8, wave: 4.2, roll: 4.6 };
const validObjectId = id => typeof id === "string" && /^[a-zA-Z0-9_-]{1,100}$/.test(id);
const adjectives = ["Relaxed", "Sleepy", "Cosy", "Sunny", "Gentle", "Snuggly", "Cheerful", "Drowsy", "Mellow", "Kind", "Rosy", "Dreamy", "Soft", "Warm", "Little", "Jolly", "Calm", "Cloudy", "Happy", "Fluffy"];
const animals = ["Panda", "Bunny", "Otter", "Duckling", "Fox", "Kitten", "Hedgehog", "Fawn", "Penguin", "Puffin", "Koala", "Sparrow", "Seal", "Mouse", "Lamb", "Turtle", "Robin", "Swan", "Cub", "Wren"];

/** @param {number} slot */
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

/** @returns {action is import("../features/village/garden").GardenAction} */
function validAction(action, bedCount) {
  if (!action || typeof action !== "object") return false;
  if (["plant", "water", "harvest"].includes(action.kind)) {
    if (!Number.isInteger(action.bed) || action.bed < 0 || action.bed >= bedCount) return false;
    return action.kind !== "plant" || ["carrot", "radish", "mint", "daisy", "sunflower"].includes(action.crop);
  }
  if (action.kind === "gift") return ["carrot", "radish", "mint", "daisy", "sunflower"].includes(action.crop);
  return ["flowers", "drink", "crumbs", "feed", "birdCrumbs", "feedBirds"].includes(action.kind);
}

/** @param {import("./runtime").WorkerSocket} socket @param {unknown} message */
function send(socket, message) {
  try { socket.send(JSON.stringify(message)); }
  catch { /* A closed connection is removed by webSocketClose. */ }
}

/** @param {Request} request @param {unknown} token */
async function authorized(request, token) {
  const header = request.headers.get("Authorization") || "";
  if (typeof token !== "string" || token.length < 32 || !header.startsWith("Bearer ")) return false;
  const supplied = header.slice(7);
  if (supplied.length < 32 || supplied.length > 512) return false;
  const encoder = new TextEncoder();
  const [expectedHash, suppliedHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(token)),
    crypto.subtle.digest("SHA-256", encoder.encode(supplied)),
  ]);
  const expected = new Uint8Array(expectedHash);
  const actual = new Uint8Array(suppliedHash);
  let difference = 0;
  for (let index = 0; index < expected.length; index++) difference |= expected[index] ^ actual[index];
  return difference === 0;
}

/** @param {Request} request */
async function ipFingerprint(request) {
  const ip = request.headers.get("CF-Connecting-IPv6") || request.headers.get("CF-Connecting-IP");
  if (!ip) return null;
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(ip.trim().toLowerCase()));
  return [...new Uint8Array(hash)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

export class VillageWorld extends DurableObject {
  /** @param {import("./runtime").WorkerState} ctx @param {import("./runtime").WorkerEnvironment} env */
  constructor(ctx, env) {
    super(ctx, env);
    const savedGarden = ctx.storage.kv.get("garden");
    const savedChat = ctx.storage.kv.get("chat");
    // Compare immutable, raw persisted values, before readGarden applies growth or repairs.
    this.persistedValues = new Map([["garden", JSON.stringify(savedGarden)], ["chat", JSON.stringify(savedChat)]]);
    this.garden = readGarden(JSON.stringify(savedGarden || freshGarden()));
    this.chatHour = savedChat?.hour ?? -1;
    /** @type {import("../features/village/sharedWorld").SharedChatEntry[]} */
    this.chat = (savedChat?.entries ?? []).map(entry => entry.messageId ? entry : { ...entry, messageId: crypto.randomUUID() });
    /** @type {Map<string, import("../features/village/sharedWorld").SharedPuppyTrick>} */
    this.puppyTricks = new Map((ctx.storage.kv.get("puppyTricks") || []).filter(trick =>
      Date.now() - trick.startedAt < PUPPY_TRICK_SECONDS[trick.command] * 1000).map(trick => [trick.id, trick]));
    this.simulation = new VillageSimulation(ctx.storage.kv.get("sharedActors"));
    this.lastWorldTick = 0;
    /** @type {Map<string, { inventory: import("../features/village/townShared").ForageInventory; usedAt: number }>} */
    this.inventories = new Map((ctx.storage.kv.get("visitorInventories") || []).filter(([token, record]) =>
      /^[0-9a-f-]{36}$/.test(token) && Date.now() - record.usedAt < 90 * 24 * 60 * 60_000).map(([token, record]) =>
      [token, { inventory: inventoryValue(record.inventory), usedAt: record.usedAt }]));
    /** @type {Map<string | null, number>} */
    this.ipKicks = new Map(ctx.storage.kv.get("ipKicks") || []);
    this.pruneKicks();
    if (savedChat && this.chat.some((entry, index) => entry !== savedChat.entries[index])) {
      this.putIfChanged("chat", { hour: this.chatHour, entries: this.chat });
    }
  }

  /** @template {keyof import("./runtime").StoredRecords} K @param {K} key @param {import("./runtime").StoredRecords[K]} value */
  putIfChanged(key, value) {
    const serialized = JSON.stringify(value);
    if (this.persistedValues.get(key) === serialized) return;
    this.ctx.storage.kv.put(key, value);
    // A failed write must not advance the comparison baseline. Async durability failures
    // still use the storage output gate and reset this instance (no allowUnconfirmed).
    this.persistedValues.set(key, serialized);
  }

  /** @param {import("./runtime").WorkerVisitor} visitor */
  restoreInventory(visitor) {
    const token = visitor.inventoryToken && this.inventories.has(visitor.inventoryToken) ? visitor.inventoryToken : crypto.randomUUID();
    let record = this.inventories.get(token);
    if (!record) {
      record = { inventory: inventoryValue(visitor.forageInventory), usedAt: Date.now() };
      this.inventories.set(token, record);
    }
    this.simulation.picnic.resume(token, visitor.id);
    visitor.inventoryToken = token;
    visitor.forageInventory = { ...record.inventory };
    return token;
  }

  /** @param {import("./runtime").WorkerVisitor} visitor @param {boolean} [publish] */
  saveInventory(visitor, publish = true) {
    const token = visitor.inventoryToken ?? this.restoreInventory(visitor);
    const inventory = inventoryValue(visitor.forageInventory);
    visitor.forageInventory = inventory;
    this.inventories.set(token, { inventory, usedAt: Date.now() });
    const activeTokens = new Set(this.visitors().map(value => value.inventoryToken));
    if (this.inventories.size > 2048) {
      for (const [token] of [...this.inventories].sort((a, b) => a[1].usedAt - b[1].usedAt)) {
        if (!activeTokens.has(token)) this.inventories.delete(token);
        if (this.inventories.size <= 2048) break;
      }
    }
    this.ctx.storage.kv.put("visitorInventories", [...this.inventories]);
    if (publish) this.publishInventory(visitor);
  }

  /** @param {import("./runtime").WorkerVisitor} visitor */
  publishInventory(visitor) {
    const inventory = inventoryValue(visitor.forageInventory);
    for (const socket of this.sockets()) {
      const current = socket.deserializeAttachment();
      if (current.id === visitor.id) current.inventoryToken = visitor.inventoryToken;
      if (current.inventoryToken !== visitor.inventoryToken) continue;
      current.forageInventory = { ...inventory }; socket.serializeAttachment(current);
      send(socket, { type: "forageInventory", inventory, token: visitor.inventoryToken });
    }
  }

  /** Resource consumption and its private grant commit together before sending either result.
   * @param {import("./runtime").WorkerVisitor} visitor @param {() => void} publicWrite */
  persistResources(visitor, publicWrite) {
    const inventories = new Map(this.inventories), baselines = new Map(this.persistedValues);
    const previous = inventoryValue(visitor.inventoryToken ? inventories.get(visitor.inventoryToken)?.inventory : undefined);
    try {
      this.ctx.storage.transactionSync(() => { publicWrite(); this.saveInventory(visitor, false); });
    } catch (error) {
      this.inventories = inventories; this.persistedValues = baselines; visitor.forageInventory = previous;
      for (const socket of this.sockets()) {
        const current = socket.deserializeAttachment();
        if (current.inventoryToken === visitor.inventoryToken) { current.forageInventory = { ...previous }; socket.serializeAttachment(current); }
      }
      throw error;
    }
    this.publishInventory(visitor);
  }

  sockets() { return this.ctx.getWebSockets().filter(socket => { const visitor = socket.deserializeAttachment(); return !visitor?.kickedUntil && !visitor?.left; }); }

  pruneKicks() {
    let changed = false;
    for (const [ip, until] of this.ipKicks) if (until <= Date.now()) { this.ipKicks.delete(ip); changed = true; }
    if (changed) this.ctx.storage.kv.put("ipKicks", [...this.ipKicks]);
  }

  adminPlayers() {
    return { players: this.visitors().map(({ id, name, color, ipHash }) => ({ id, name, color, canKick: !!ipHash })) };
  }

  visitors() {
    return this.sockets().map(socket => socket.deserializeAttachment()).filter(visitor => visitor && !visitor.left);
  }

  /** @param {unknown} message @param {import("./runtime").WorkerSocket} [except] */
  broadcast(message, except) {
    for (const socket of this.sockets()) if (socket !== except) send(socket, message);
  }

  /** @param {number} [now] @param {import("./runtime").WorkerVisitor} [inventoryVisitor] */
  publishWorld(now = Date.now(), inventoryVisitor) {
    for (const socket of this.sockets()) {
      const visitor = socket.deserializeAttachment();
      if (visitor && now - (visitor.lastSeen ?? now) > 15000) {
        visitor.left = true; socket.serializeAttachment(visitor);
        this.simulation.releaseVisitor(visitor.id, now);
        this.broadcast({ type: "leave", id: visitor.id }, socket);
        socket.close(1001, "Connection timed out");
      }
    }
    this.advanceWorld(now, true);
    const persist = () => this.ctx.storage.kv.put("sharedActors", this.simulation.save());
    if (inventoryVisitor) this.persistResources(inventoryVisitor, persist);
    else persist();
    this.broadcast({ type: "actors", world: this.simulation.snapshot(now) });
    this.lastWorldTick = now;
  }

  /** @param {number} now @param {boolean} [broadcastRiders] */
  advanceWorld(now, broadcastRiders = false) {
    const entries = this.sockets().map(socket => {
      const visitor = socket.deserializeAttachment();
      return { socket, visitor, previousHorse: visitor.horse };
    });
    this.simulation.step(now, entries.map(entry => entry.visitor));
    let released = false;
    for (const { socket, visitor, previousHorse } of entries) {
      const horse = this.simulation.mountedHorse(visitor.id);
      if (horse) this.simulation.syncRider(visitor, horse);
      else if (visitor.horse) { visitor.horse = null; visitor.y = undefined; }
      if (horse || previousHorse) socket.serializeAttachment(visitor);
      const dismounted = !!previousHorse && !horse;
      released ||= dismounted;
      if (dismounted || broadcastRiders && horse) {
        this.broadcast({ type: "move", id: visitor.id, x: visitor.x, y: visitor.y, z: visitor.z, heading: visitor.heading, lookout: visitor.lookout ?? null,
          horse: visitor.horse ?? null, swing: visitor.swing ?? null, bench: visitor.bench ?? null, activity: visitor.activity ?? null });
      }
    }
    return released;
  }

  /** @param {import("./runtime").WorkerVisitor} visitor @param {import("../features/village/sharedActors").SharedInteraction} request @param {number} now */
  interaction(visitor, request, now) {
    if (!request || typeof request !== "object") return { ok: false, reason: "That action is unavailable." };
    if (request.kind === "mapTravel") return this.simulation.mapTravel(visitor, request.id, now, this.visitors());
    if (visitor.lookout != null && !["leave", "activity"].includes(request.kind))
      return { ok: false, reason: "Come down from the lookout first." };
    if (request.kind === "picnic") return this.simulation.picnic.action(visitor, request, now);
    if (request.kind === "town") return this.simulation.townInteraction(visitor, request, now, this.visitors());
    if (request.kind === "horse") return this.simulation.horseInteraction(visitor, request, now, this.visitors());
    if (this.simulation.mountedHorse(visitor.id)) {
      if (request.kind !== "leave" && !(request.kind === "activity" && request.id === "focus"))
        return { ok: false, reason: "Dismount before joining another activity." };
      const dismount = this.simulation.dismount(visitor, now, this.visitors(), request.kind === "activity");
      if (!dismount.ok || request.kind === "leave") return dismount;
    }
    if ((request.kind === "puppy" || request.kind === "resident")) {
      const result = this.simulation.interact(visitor, request, now);
      if (result.ok && request.kind === "puppy") {
        if (request.action === "hold") visitor.holdingPuppy = request.id;
        else if (["release", "home"].includes(request.action) && visitor.holdingPuppy === request.id) visitor.holdingPuppy = null;
      }
      return result;
    }
    if (request.kind === "lookout") {
      const tower = towerLookout(this.simulation.authored);
      if (!tower || visitor.activity || visitor.bench || visitor.swing || visitor.lookout != null || visitor.active === false
        || Math.hypot(visitor.x - tower.entrance[0], visitor.z - tower.entrance[2]) > 3.5)
        return { ok: false, reason: "Come closer to the watchtower door on foot." };
      const index = Array.from({ length: LOOKOUT_CAPACITY }, (_, i) => i).find(i =>
        !this.visitors().some(other => other.id !== visitor.id && other.lookout === i));
      if (index === undefined) return { ok: false, reason: "The lookout is full. Wait for someone to come down." };
      this.simulation.releaseVisitor(visitor.id, now);
      visitor.lookout = index; visitor.holdingPuppy = null;
      const position = tower.position(index);
      [visitor.x, visitor.y, visitor.z] = position;
      return { ok: true, lookoutIndex: index, position };
    }
    if (request.kind === "leave") {
      if (visitor.lookout != null) {
        const position = towerLookout(this.simulation.authored)?.entrance;
        visitor.lookout = null;
        if (position) { [visitor.x, visitor.y, visitor.z] = position; }
      }
      this.simulation.town.releaseVisitor(visitor.id, now);
      visitor.bench = visitor.swing = visitor.activity = null;
      visitor.activityPosition = null;
      visitor.holdingPuppy = null;
      return { ok: true };
    }
    if (request.kind === "activity") {
      if (!Object.hasOwn(ACTIVITY_STAGES, request.id) || !this.simulation.activityEnabled(request.id)) return { ok: false, reason: "That place is unavailable." };
      // Focus is a deliberately private room. Outdoor seated activities use real shared seats.
      const seats = { music: "bench-1", mood: "bench-4", birds: "bird-clearing-bench" };
      if (seats[request.id]) {
        const seat = this.interaction(visitor, { kind: "bench", id: seats[request.id] }, now);
        if (!seat.ok) return seat;
        visitor.activity = request.id;
        if (request.id === "mood") this.simulation.visitTea(visitor, now);
        return seat;
      }
      if (["gratitude", "compliment"].includes(request.id) && this.visitors().some(other => other.id !== visitor.id && other.activity === request.id))
        return { ok: false, reason: "Someone is using that spot. Try again when they finish." };
      const position = ["garden", "breathe"].includes(request.id) ? this.simulation.activityPosition(visitor, request.id, this.visitors()) : null;
      if (["garden", "breathe"].includes(request.id) && !position) return { ok: false, reason: "That spot is occupied. Try again when there is room." };
      visitor.bench = visitor.swing = null;
      visitor.lookout = null; visitor.holdingPuppy = null; visitor.activity = request.id; visitor.activityPosition = position;
      return { ok: true, ...(position ? { position } : {}) };
    }
    if (request.kind !== "bench" && request.kind !== "swing") return { ok: false, reason: "That action is unavailable." };
    const item = request.kind === "bench" ? this.simulation.benches.find(item => item.id === request.id)
      : this.simulation.authored.swings.find(item => item.id === request.id);
    if (!item) return { ok: false, reason: "That seat is unavailable." };
    if (request.kind === "swing" && Math.hypot(item.x - visitor.x, item.z - visitor.z) > 4)
      return { ok: false, reason: "Come a little closer to the swing." };
    if (request.kind === "bench" && !visitor.requestingActivity && Math.hypot(item.x - visitor.x, item.z - visitor.z) > 3)
      return { ok: false, reason: "Come a little closer to the bench." };
    const capacity = request.kind === "bench" && "seatCount" in item ? Number(item.seatCount) : 2;
    const choices = request.index === undefined ? Array.from({ length: capacity }, (_, index) => index) : [request.index];
    const index = choices.find(index => Number.isInteger(index) && index >= 0 && index < capacity && !this.visitors().some(other => other.id !== visitor.id
      && other[request.kind]?.id === request.id && other[request.kind]?.index === index));
    if (index === undefined) return { ok: false, reason: "That seat is occupied. Try a free seat." };
    visitor.bench = visitor.swing = visitor.activity = visitor.activityPosition = null; visitor.holdingPuppy = null;
    if (request.kind === "swing") visitor.swing = { id: request.id, index: /** @type {0 | 1} */ (index), angle: 0, velocity: 0 };
    else visitor.bench = { id: request.id, index };
    return { ok: true, index };
  }

  async rollHour() {
    // Consult storage on every call: an in-memory deadline misses consumed/deleted alarms.
    const alarmAt = await this.ctx.storage.getAlarm();
    const hour = Math.floor(Date.now() / 3_600_000);
    if (hour !== this.chatHour) {
      this.chatHour = hour;
      this.chat = [];
      this.putIfChanged("chat", { hour, entries: [] });
      this.broadcast({ type: "hour", chatHour: hour });
    }
    const nextHour = (hour + 1) * 3_600_000;
    if (alarmAt !== nextHour) await this.ctx.storage.setAlarm(nextHour);
  }

  async alarm() { this.pruneKicks(); await this.rollHour(); }

  /** @param {Request} request */
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === "/admin/players" && request.method === "GET") return Response.json(this.adminPlayers());
    const kickMatch = /^\/admin\/players\/([0-9a-f-]{36})\/kick$/.exec(url.pathname);
    if (kickMatch && request.method === "POST") {
      const target = this.visitors().find(visitor => visitor.id === kickMatch[1]);
      if (!target) return new Response("Player no longer connected", { status: 404 });
      if (!target.ipHash) return new Response("Player must reconnect before an IP kick is available", { status: 409 });
      this.pruneKicks();
      const until = Date.now() + KICK_DURATION_MS;
      this.ipKicks.set(target.ipHash, until);
      this.ctx.storage.kv.put("ipKicks", [...this.ipKicks]);
      const affected = this.sockets().filter(socket => socket.deserializeAttachment()?.ipHash === target.ipHash);
      for (const socket of affected) {
        const visitor = socket.deserializeAttachment();
        socket.serializeAttachment({ ...visitor, kickedUntil: until });
        this.simulation.releaseVisitor(visitor.id, Date.now());
        this.broadcast({ type: "leave", id: visitor.id });
        send(socket, { type: "kicked", until });
        socket.close(4003, "Kicked for 5 minutes");
      }
      this.publishWorld();
      return Response.json({ ...this.adminPlayers(), until, kickedCount: affected.length });
    }
    if (url.pathname === "/admin/chat") {
      await this.rollHour();
      if (request.method === "GET") return Response.json({ chatHour: this.chatHour, entries: this.chat });
      if (request.method === "DELETE") {
        if (request.headers.get("If-Match") !== `"${this.chatHour}"`) {
          return new Response("Chat hour changed", { status: 409 });
        }
        const removedMessageIds = this.chat.map(entry => entry.messageId);
        this.chat = [];
        this.putIfChanged("chat", { hour: this.chatHour, entries: this.chat });
        // Older open clients already understand this reset event.
        this.broadcast({ type: "hour", chatHour: this.chatHour });
        this.broadcast({ type: "chat_sync", chatHour: this.chatHour, chat: this.chat, removedMessageIds });
        return Response.json({ chatHour: this.chatHour, entries: this.chat });
      }
      return new Response("Method not allowed", { status: 405 });
    }
    const removeMatch = /^\/admin\/chat\/([0-9a-f-]{36})$/.exec(url.pathname);
    if (removeMatch && request.method === "DELETE") {
      await this.rollHour();
      const index = this.chat.findIndex(entry => entry.messageId === removeMatch[1]);
      if (index < 0) return new Response("Message no longer exists", { status: 404 });
      this.chat.splice(index, 1);
      this.putIfChanged("chat", { hour: this.chatHour, entries: this.chat });
      this.broadcast({ type: "chat_sync", chatHour: this.chatHour, chat: this.chat, removedMessageIds: [removeMatch[1]] });
      return Response.json({ chatHour: this.chatHour, entries: this.chat });
    }
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") return new Response("WebSocket required", { status: 426 });
    const ipHash = await ipFingerprint(request);
    this.pruneKicks();
    const kickedUntil = this.ipKicks.get(ipHash);
    if (kickedUntil) {
      // Complete the handshake so browsers can receive the kick screen instead of an opaque HTTP error.
      const [client, server] = Object.values(new WebSocketPair());
      server.accept();
      send(server, { type: "kicked", until: kickedUntil });
      server.close(4003, "Kicked for 5 minutes");
      return new Response(null, { status: 101, webSocket: client });
    }
    await this.rollHour();
    this.publishWorld();
    if (this.sockets().length >= MAX_VISITORS) return new Response("Village full", { status: 503 });
    const used = new Set(this.visitors().map(visitor => visitor.name));
    const names = adjectives.flatMap(adjective => animals.map(animal => `${adjective} ${animal}`));
    let name = names[Math.floor(Math.random() * names.length)];
    while (used.has(name)) name = names[Math.floor(Math.random() * names.length)];
    const slot = (this.ctx.storage.kv.get("nextSlot") || 0) + 1;
    this.ctx.storage.kv.put("nextSlot", slot);
    const visitor = { id: crypto.randomUUID(), name, color: colorForSlot(slot), slot, ipHash, x: 0, z: 0, heading: 0, lastMove: 0, lastChat: 0, crumbPouch: false, forageInventory: { apples: 0, mushrooms: 0 }, lastSeen: Date.now() };
    this.restoreInventory(visitor);
    const [client, server] = Object.values(new WebSocketPair());
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment(visitor);
    this.advanceWorld(Date.now());
    send(server, {
      type: "welcome", selfId: visitor.id,
      protocol: 2, world: this.simulation.snapshot(Date.now()), hasCrumbs: visitor.crumbPouch,
      forageInventory: visitor.forageInventory, inventoryToken: visitor.inventoryToken,
      visitors: this.visitors().map(({ id, name, color, slot, x, y, z, heading, horse, swing, bench, activity, lookout }) => ({ id, name, color, slot, x, y, z, heading, horse: horse ?? null, swing: swing ?? null, bench: bench ?? null, activity: activity ?? null, lookout: lookout ?? null })),
      garden: this.garden, chatHour: this.chatHour, chat: this.chat,
      puppyTricks: [...this.puppyTricks.values()].filter(trick => Date.now() - trick.startedAt < PUPPY_TRICK_SECONDS[trick.command] * 1000),
    });
    this.broadcast({ type: "join", visitor: { id: visitor.id, name, color: visitor.color, slot, x: 0, z: 0, heading: 0 } }, server);
    return new Response(null, { status: 101, webSocket: client });
  }

  /** @param {import("./runtime").WorkerSocket} socket @param {string | ArrayBuffer} raw */
  async webSocketMessage(socket, raw) {
    if (typeof raw !== "string" || raw.length > 2048) return;
    let message;
    try { message = JSON.parse(raw); }
    catch { return; }
    if (!message || typeof message !== "object") return;
    let visitor = socket.deserializeAttachment();
    if (!visitor || visitor.kickedUntil || visitor.left) return;
    const now = Date.now();
    visitor.lastSeen = now;
    if (message.type === "inventory_resume") {
      if (typeof message.token === "string" && /^[0-9a-f-]{36}$/.test(message.token) && this.inventories.has(message.token)) {
        const unusedToken = visitor.inventoryToken;
        visitor.inventoryToken = message.token;
        if (unusedToken !== message.token && unusedToken && !this.visitors().some(value => value.id !== visitor.id && value.inventoryToken === unusedToken)) this.inventories.delete(unusedToken);
      }
      this.restoreInventory(visitor); socket.serializeAttachment(visitor); this.saveInventory(visitor);
      return;
    }
    if (message.type === "heartbeat") {
      visitor.active = message.active === true;
      if (visitor.horse && message.horse !== visitor.horse && now >= (visitor.reservationUntil ?? 0)) {
        this.simulation.dismount(visitor, now, this.visitors(), true);
        this.broadcast({ type: "move", id: visitor.id, x: visitor.x, y: visitor.y, z: visitor.z, heading: visitor.heading, lookout: visitor.lookout ?? null,
          horse: null, swing: null, bench: null, activity: null });
      }
      visitor.holdingPuppy = validObjectId(message.holdingPuppy) ? message.holdingPuppy : null;
      const seated = visitor.lookout != null ? visitor.lookout === message.lookout : visitor.horse ? visitor.horse === message.horse : visitor.activity ? visitor.activity === message.activity
        : visitor.bench ? visitor.bench.id === message.bench?.id && visitor.bench.index === message.bench.index
        : visitor.swing ? visitor.swing.id === message.swing?.id && visitor.swing.index === message.swing.index : true;
      if (seated) visitor.reservationUntil = 0;
      else if (now >= (visitor.reservationUntil ?? 0)) {
        if (visitor.lookout != null) {
          const position = towerLookout(this.simulation.authored)?.entrance;
          if (position) [visitor.x, visitor.y, visitor.z] = position;
          visitor.lookout = null;
        }
        visitor.bench = visitor.swing = visitor.activity = visitor.activityPosition = null;
        this.broadcast({ type: "move", id: visitor.id, x: visitor.x, y: visitor.y, z: visitor.z, heading: visitor.heading, lookout: visitor.lookout ?? null,
          swing: null, bench: null, activity: null });
      }
      socket.serializeAttachment(visitor);
      if (now - this.lastWorldTick >= 100) this.publishWorld(now);
      return;
    }
    if (message.type === "interaction" && typeof message.requestId === "string" && message.requestId.length <= 100) {
      if (now - (visitor.lastInteraction || 0) < 80 && message.request?.kind !== "leave" && !["release", "home", "dismount", "raceCancel"].includes(message.request?.action)) {
        send(socket, { type: "interaction_result", requestId: message.requestId, result: { ok: false, reason: "Give them a moment, then try again." } }); return;
      }
      visitor.lastInteraction = now;
      const pose = visitor.lookout == null ? message.pose : null;
      if (!this.simulation.mountedHorse(visitor.id) && pose && [pose.x, pose.z, pose.heading].every(Number.isFinite) && (pose.y === undefined || Number.isFinite(pose.y))) {
        visitor.x = Math.max(-320, Math.min(320, pose.x)); visitor.z = Math.max(-320, Math.min(320, pose.z));
        visitor.y = pose.y === undefined ? undefined : Math.max(-20, Math.min(40, pose.y));
        visitor.heading = Math.atan2(Math.sin(pose.heading), Math.cos(pose.heading)); visitor.active = pose.active !== false;
      }
      socket.serializeAttachment(visitor);
      const released = this.advanceWorld(now);
      visitor = socket.deserializeAttachment();
      this.restoreInventory(visitor);
      const privateTownAction = message.request?.kind === "town" && ["animalGift", "animalApple", "animalMushroom", "applePick", "gardenHarvest"].includes(message.request.action);
      const privatePicnicAction = message.request?.kind === "picnic";
      const beforePicnic = privatePicnicAction ? this.simulation.picnic.save() : null;
      const beforeTown = privateTownAction ? this.simulation.town.snapshot() : null;
      visitor.requestingActivity = message.request?.kind === "activity";
      const result = this.interaction(visitor, message.request, now);
      delete visitor.requestingActivity;
      if (result.ok && (["activity", "bench", "swing", "lookout"].includes(message.request.kind)
        || message.request.kind === "horse" && message.request.action === "mount"
        || message.request.kind === "town" && message.request.action === "raceInvite")) visitor.reservationUntil = now + 4500;
      socket.serializeAttachment(visitor);
      if (result.ok) {
        if (message.request.kind === "town" && ["owlFood", "owlFeed"].includes(message.request.action))
          send(socket, { type: "crumbs", hasCrumbs: visitor.crumbPouch });
        try { this.publishWorld(now, privateTownAction || privatePicnicAction ? visitor : undefined); }
        catch (error) {
          if (beforePicnic) {
            this.simulation.picnic.state = beforePicnic.state; this.simulation.picnic.tokens = beforePicnic.tokens;
            send(socket, { type: "interaction_result", requestId: message.requestId, result: { ok: false, reason: "Your basket couldn't be saved. Try again." } });
            return;
          }
          if (beforeTown) Object.assign(this.simulation.town.state, beforeTown);
          throw error;
        }
        this.broadcast({ type: "move", id: visitor.id, x: visitor.x, y: visitor.y, z: visitor.z, heading: visitor.heading, lookout: visitor.lookout ?? null,
          horse: visitor.horse ?? null, swing: visitor.swing ?? null, bench: visitor.bench ?? null, activity: visitor.activity ?? null });
      } else if (released) this.publishWorld(now);
      send(socket, { type: "interaction_result", requestId: message.requestId, result });
      return;
    }
    if (message.type === "horseInput") {
      // Advance with the previous accepted input before replacing it; new keys cannot affect past time.
      socket.serializeAttachment(visitor);
      const released = this.advanceWorld(now);
      visitor = socket.deserializeAttachment();
      if (this.simulation.horseInput(visitor, message, now)) {
        const horse = this.simulation.mountedHorse(visitor.id);
        if (horse) this.simulation.syncRider(visitor, horse);
        visitor.reservationUntil = 0;
        socket.serializeAttachment(visitor);
        if (now - this.lastWorldTick >= 100) this.publishWorld(now);
      } else if (released) this.publishWorld(now);
      return;
    }
    if (message.type === "move") {
      const now = Date.now();
      if (this.simulation.mountedHorse(visitor.id)) {
        if (message.activity !== "focus") return;
        this.simulation.dismount(visitor, now, this.visitors(), true);
      }
      if (now - visitor.lastMove < 80 || ![message.x, message.z, message.heading].every(Number.isFinite)
        || (message.y !== undefined && !Number.isFinite(message.y))) return;
      visitor.lastMove = now;
      visitor.x = Math.max(-320, Math.min(320, message.x));
      visitor.y = message.y === undefined ? undefined : Math.max(-20, Math.min(40, message.y));
      visitor.z = Math.max(-320, Math.min(320, message.z));
      visitor.heading = Math.atan2(Math.sin(message.heading), Math.cos(message.heading));
      if (visitor.lookout != null) {
        const position = towerLookout(this.simulation.authored)?.constrain(visitor.x, visitor.z);
        if (position) [visitor.x, visitor.y, visitor.z] = position;
      }
      if (message.activity === "focus") { visitor.lookout = null; visitor.activity = "focus"; visitor.bench = visitor.swing = null; }
      else if (!message.activity && visitor.activity === "focus") visitor.activity = null;
      const ride = message.swing;
      const claimedSwing = visitor.swing;
      visitor.swing = claimedSwing && !ride && now < (visitor.reservationUntil ?? 0) ? claimedSwing
        : claimedSwing && ride?.id === claimedSwing.id && ride.index === claimedSwing.index && [0, 1].includes(ride.index)
        && [ride.angle, ride.velocity].every(Number.isFinite)
        ? { id: ride.id, index: ride.index, angle: Math.max(-MAX_SWING_ANGLE, Math.min(MAX_SWING_ANGLE, ride.angle)), velocity: Math.max(-4, Math.min(4, ride.velocity)) } : null;
      const currentSwing = visitor.swing;
      if (currentSwing && this.visitors().some(other => other.id !== visitor.id
        && other.swing?.id === currentSwing.id && other.swing.index === currentSwing.index)) {
        visitor.swing = null;
        send(socket, { type: "swing_taken" });
      }
      if (!ride && claimedSwing && now >= (visitor.reservationUntil ?? 0)) visitor.swing = null;
      if (!message.bench && visitor.bench && !visitor.activity && now >= (visitor.reservationUntil ?? 0)) visitor.bench = null;
      socket.serializeAttachment(visitor);
      this.broadcast({ type: "move", id: visitor.id, x: visitor.x, y: visitor.y, z: visitor.z, heading: visitor.heading, lookout: visitor.lookout ?? null, swing: visitor.swing,
        horse: visitor.horse ?? null, bench: visitor.bench ?? null, activity: visitor.activity ?? null }, socket);
      if (visitor.lookout != null && (Math.hypot(visitor.x - message.x, visitor.z - message.z) > .0001 || visitor.y !== message.y))
        send(socket, { type: "move", id: visitor.id, x: visitor.x, y: visitor.y, z: visitor.z, heading: visitor.heading,
          lookout: visitor.lookout, swing: null, horse: null, bench: null, activity: null });
    } else if (message.type === "puppy_trick") {
      const trick = message.trick, now = Date.now();
      if (!trick || !validObjectId(trick.id) || !Object.hasOwn(PUPPY_TRICK_SECONDS, trick.command)
        || ![trick.x, trick.z, trick.heading].every(Number.isFinite) || now - (visitor.lastTrick || 0) < 150
        || Math.hypot(trick.x - visitor.x, trick.z - visitor.z) > 3) return;
      const result = this.simulation.interact(visitor, { kind: "puppy", id: trick.id, action: trick.command }, now);
      if (!result.ok) return;
      const actor = this.simulation.actor(trick.id, "puppy")?.state;
      if (!actor) return;
      const accepted = { id: trick.id, command: trick.command,
        x: actor.x, z: actor.z, heading: actor.heading, startedAt: now };
      visitor.lastTrick = now;
      socket.serializeAttachment(visitor);
      for (const [id, previous] of this.puppyTricks) if (now - previous.startedAt >= PUPPY_TRICK_SECONDS[previous.command] * 1000) this.puppyTricks.delete(id);
      if (!this.puppyTricks.has(accepted.id) && this.puppyTricks.size >= 128) return;
      this.puppyTricks.set(accepted.id, accepted);
      this.ctx.storage.kv.put("puppyTricks", [...this.puppyTricks.values()]);
      this.broadcast({ type: "puppy_trick", actor: visitor.id, trick: accepted });
      this.publishWorld(now);
    } else if (message.type === "garden" && validAction(message.action, this.garden.beds.length)) {
      const action = message.action;
      if ((action.kind === "feed" || action.kind === "feedBirds") && !visitor.crumbPouch) {
        send(socket, { type: "action_rejected", message: "Ask Maple or Wren for crumbs first." }); return;
      }
      if (action.kind === "feed" && this.simulation.pondFeedAt !== null && now - this.simulation.pondFeedAt < 11000) {
        send(socket, { type: "action_rejected", message: "The ducks are enjoying their crumbs. Give them a moment." }); return;
      }
      if (action.kind === "gift" && this.simulation.actor("luma", "resident")?.state.owner !== visitor.id) {
        send(socket, { type: "action_rejected", message: "Join Luma for tea when she is free." }); return;
      }
      let allowed = false;
      if (action.kind === "crumbs" || action.kind === "birdCrumbs") {
        const resident = this.simulation.actor(action.kind === "crumbs" ? "maple" : "wren", "resident")?.state;
        allowed = !!resident && (!resident.owner || resident.owner === visitor.id) && visitor.activity !== "focus"
          && Math.hypot(visitor.x - resident.x, visitor.z - resident.z) <= 4.5;
        if (action.kind === "birdCrumbs" && visitor.bench?.id === "bird-clearing-bench") allowed = true;
        if (this.simulation.authored.crumbPouches.some(pouch => Math.hypot(visitor.x - pouch.x, visitor.z - pouch.z) < 2.5)) allowed = true;
      } else if (action.kind === "feedBirds") allowed = this.simulation.feedBirds(visitor, now);
      else {
        const targetId = "bed" in action ? `bed-${action.bed}` : ["gift", "drink"].includes(action.kind) ? "tea" : action.kind;
        const target = GARDEN_TARGETS.find(target => target.id === targetId);
        allowed = visitor.activity !== "focus" && !!target && (visitor.activity === "garden" && "bed" in action
          || Math.hypot(Math.max(0, Math.abs(visitor.x - target.x) - ("halfWidth" in target ? target.halfWidth : 0)), visitor.z - target.z) <= target.radius + .8);
      }
      if (!allowed) { send(socket, { type: "action_rejected", message: "Come closer, or wait until this interaction is free." }); return; }
      if ((action.kind === "feed" || action.kind === "feedBirds") && !visitor.crumbPouch) return;
      this.garden = growGarden(this.garden);
      this.restoreInventory(visitor);
      const privateInventory = inventoryValue(visitor.forageInventory);
      const privateCrops = Object.fromEntries(PRIVATE_CROP_KEYS.map(key => [key, privateInventory[key]]));
      const availableGarden = { ...this.garden, ...privateCrops, crumbPouch: visitor.crumbPouch };
      if (action.kind !== "feedBirds" && !gardenActionAllowed(availableGarden, action)) {
        send(socket, { type: "action_rejected", message: "That garden task has already changed. Try its current action." }); return;
      }
      if (action.kind === "crumbs" || action.kind === "birdCrumbs") {
        const provider = this.simulation.actor(action.kind === "crumbs" ? "maple" : "wren", "resident");
        if (provider && (!provider.state.owner || provider.state.owner === visitor.id)
          && Math.hypot(visitor.x - provider.state.x, visitor.z - provider.state.z) <= 4.5)
          this.simulation.interact(visitor, { kind: "resident", id: provider.state.id, action: "talk" }, now);
        visitor.crumbPouch = true;
        socket.serializeAttachment(visitor);
        send(socket, { type: "crumbs", hasCrumbs: true });
      }
      const nextGarden = gardenAction({ ...this.garden, ...privateCrops, crumbPouch: visitor.crumbPouch }, action);
      // Beds are public; harvest and tea counters belong only to this browser's basket.
      const sharedGarden = { ...nextGarden, ...Object.fromEntries(PRIVATE_CROP_KEYS.map(key => [key, this.garden[key]])), crumbPouch: false };
      if (["harvest", "gift", "drink"].includes(action.kind)) {
        visitor.forageInventory = inventoryValue({ ...privateInventory, ...Object.fromEntries(PRIVATE_CROP_KEYS.map(key => [key, nextGarden[key]])) });
        this.persistResources(visitor, () => this.putIfChanged("garden", sharedGarden));
      } else this.putIfChanged("garden", sharedGarden);
      this.garden = sharedGarden;
      if (action.kind === "feed") this.simulation.pondFeedAt = now;
      if (action.kind === "gift") this.simulation.gift = { crop: action.crop, at: now };
      this.simulation.gardenMoment(visitor, action, now);
      this.broadcast({ type: "garden", garden: this.garden, event: { action, actor: visitor.id, x: visitor.x, z: visitor.z } });
      if (["feedBirds", "feed", "gift", "crumbs", "birdCrumbs", "water", "flowers", "drink"].includes(action.kind)) this.publishWorld(now);
    } else if (message.type === "chat" && typeof message.message === "string") {
      const now = Date.now();
      const text = message.message.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, 180);
      if (!text || now - visitor.lastChat < 3000) return;
      visitor.lastChat = now;
      socket.serializeAttachment(visitor);
      await this.rollHour();
      const entry = { id: visitor.id, messageId: crypto.randomUUID(), name: visitor.name, message: text, sentAt: now };
      this.chat = [...this.chat, entry].slice(-80);
      this.putIfChanged("chat", { hour: this.chatHour, entries: this.chat });
      this.broadcast({ type: "chat", chatHour: this.chatHour, entry });
    }
  }

  /** @param {import("./runtime").WorkerSocket} socket */
  async webSocketClose(socket) {
    const visitor = socket.deserializeAttachment();
    if (visitor?.kickedUntil) return;
    socket.close(1000, "Visitor left");
    if (visitor) {
      visitor.left = true; socket.serializeAttachment(visitor);
      this.simulation.releaseVisitor(visitor.id, Date.now());
      this.broadcast({ type: "leave", id: visitor.id }, socket);
      this.ctx.storage.kv.put("sharedActors", this.simulation.save());
      this.broadcast({ type: "actors", world: this.simulation.snapshot(Date.now()) }, socket);
    }
  }

  /** @param {import("./runtime").WorkerSocket} socket */
  async webSocketError(socket) { await this.webSocketClose(socket); }
}

export default {
  /** @param {Request} request @param {import("./runtime").WorkerEnvironment} env */
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/health") return Response.json({ ok: true });
    if (url.pathname.startsWith("/admin/")) {
      if (!await authorized(request, env.VILLAGE_ADMIN_TOKEN)) return new Response("Unauthorized", { status: 401 });
      return env.VILLAGE.getByName("one-shared-village").fetch(request);
    }
    if (url.pathname !== "/" || request.method !== "GET") return new Response("Not found", { status: 404 });
    const origin = request.headers.get("Origin");
    if (origin !== "https://cosy.sabarg.com" && origin !== "http://127.0.0.1:3051") return new Response("Forbidden", { status: 403 });
    return env.VILLAGE.getByName("one-shared-village").fetch(request);
  },
};
