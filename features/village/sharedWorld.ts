import { readGarden, type GardenAction, type GardenState } from "./garden";
import type { PuppyCommand } from "./puppies";
import type { SwingSeat } from "./swings";
import type { PlaceId } from "./places";
import type { SharedActors, SharedInteraction, InteractionResult, SharedHorseInput } from "./sharedActors";
import type { ForageInventory } from "./townShared";

export type SharedSwingRide = SwingSeat & { angle: number; velocity: number };
export type SharedPuppyTrick = { id: string; command: PuppyCommand; x: number; z: number; heading: number; startedAt: number };
export type SharedVisitor = { id: string; name: string; color: string; slot: number; x: number; y?: number; z: number; heading: number; lookout?: number | null; horse?: string | null; swing?: SharedSwingRide | null; bench?: SwingSeat | null; activity?: PlaceId | null };
export type SharedChatEntry = { id?: string; messageId?: string; name: string; message: string; sentAt?: number };
export type SharedWorldConnection = {
  sendGarden: (action: GardenAction) => void;
  sendChat: (message: string) => boolean;
  sendPuppyTrick: (trick: SharedPuppyTrick) => void;
  interact: (request: SharedInteraction) => Promise<InteractionResult>;
  sendHorseInput: (input: SharedHorseInput) => void;
  close: () => void;
};

type WorldMessage =
  | { type: "welcome"; protocol?: number; world?: SharedActors; hasCrumbs?: boolean; forageInventory?: ForageInventory; inventoryToken?: string; selfId: string; visitors: SharedVisitor[]; garden: GardenState; chatHour: number; chat: SharedChatEntry[]; puppyTricks?: SharedPuppyTrick[] }
  | { type: "join"; visitor: SharedVisitor }
  | { type: "move"; id: string; x: number; y?: number; z: number; heading: number; lookout?: number | null; horse?: string | null; swing?: SharedSwingRide | null; bench?: SwingSeat | null; activity?: PlaceId | null }
  | { type: "actors"; world: SharedActors }
  | { type: "crumbs"; hasCrumbs: boolean }
  | { type: "forageInventory"; inventory: ForageInventory; token?: string }
  | { type: "interaction_result"; requestId: string; result: InteractionResult }
  | { type: "action_rejected"; message: string }
  | { type: "swing_taken" }
  | { type: "puppy_trick"; actor: string; trick: SharedPuppyTrick }
  | { type: "leave"; id: string }
  | { type: "garden"; garden: GardenState; event: { action: GardenAction; actor: string; x: number; z: number } }
  | { type: "chat"; chatHour: number; entry: SharedChatEntry }
  | { type: "chat_sync"; chatHour: number; chat: SharedChatEntry[]; removedMessageIds: string[] }
  | { type: "hour"; chatHour: number }
  | { type: "kicked"; until: number }
  | { type: "error"; message: string };

export function connectSharedWorld(options: {
  getPose: () => { x: number; y?: number; z: number; heading: number; lookout?: number | null; horse?: string | null; swing?: SharedSwingRide | null; bench?: SwingSeat | null; activity?: PlaceId | null; active?: boolean; holdingPuppy?: string | null } | null;
  onState: (snapshot: { selfId: string; visitors: SharedVisitor[]; garden: GardenState; gardenChanged: boolean; chatHour: number; chat: SharedChatEntry[] }) => void;
  onChat: (entry: SharedChatEntry) => void;
  onChatModerated?: (removedMessageIds: string[]) => void;
  onChatCooldown: (until: number) => void;
  onAction: (event: { action: GardenAction; x: number; z: number; isSelf: boolean }) => void;
  onDisconnect: () => void;
  onKicked?: () => void;
  onSwingTaken?: () => void;
  onPuppyTrick?: (trick: SharedPuppyTrick) => void;
  onWorld?: (world: SharedActors, selfId: string) => void;
  onCrumbs?: (hasCrumbs: boolean) => void;
  onForageInventory?: (inventory: ForageInventory) => void;
  onRejected?: (message: string) => void;
  signal?: AbortSignal;
}): Promise<SharedWorldConnection> {
  let inventoryToken = "";
  try {
    const cached = JSON.parse(localStorage.getItem("cosy.village.inventory.v1") || "null");
    if (typeof cached?.token === "string" && /^[0-9a-f-]{36}$/.test(cached.token)) inventoryToken = cached.token;
  } catch { /* A private basket remains available for this connection when storage is disabled. */ }
  const acceptedInventory = (inventory: ForageInventory, token?: string) => {
    if (token) inventoryToken = token;
    try { localStorage.setItem("cosy.village.inventory.v1", JSON.stringify({ token: inventoryToken, inventory })); }
    catch { /* Local storage can be unavailable in a private browser. */ }
    options.onForageInventory?.(inventory);
  };
  const endpoint = process.env.NEXT_PUBLIC_SHARED_WORLD_URL || "ws://127.0.0.1:2567";
  return new Promise((resolve, reject) => {
    const visitors = new Map<string, SharedVisitor>();
    let selfId = "";
    let garden = readGarden(null);
    let chatHour = 0;
    let chat: SharedChatEntry[] = [];
    let interval = 0;
    let retry = 0;
    let retryDelay = 1000;
    let socket: WebSocket | null = null;
    let connectedOnce = false;
    let closed = false;
    let lastPose: ReturnType<typeof options.getPose> = null;
    let nextChatAt = 0;
    let nextTrickAt = 0;
    let trickTimer = 0;
    let joinTimer = 0;
    let requestNumber = 0;
    const pending = new Map<string, { resolve: (result: InteractionResult) => void; timer: number }>();
    const failPending = () => {
      for (const request of pending.values()) { window.clearTimeout(request.timer); request.resolve({ ok: false, reason: "Wait for the village to reconnect." }); }
      pending.clear();
    };
    const publish = (gardenChanged = false) => options.onState({
      selfId, visitors: [...visitors.values()], garden, gardenChanged, chatHour, chat,
    });
    const connection: SharedWorldConnection = {
      sendHorseInput: input => {
        if (!closed && socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: "horseInput", ...input }));
      },
      sendGarden: action => { if (!closed && socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: "garden", action })); },
      sendPuppyTrick: trick => {
        window.clearTimeout(trickTimer);
        if (closed || socket?.readyState !== WebSocket.OPEN) return;
        const delay = Math.max(0, nextTrickAt - Date.now());
        if (delay) { trickTimer = window.setTimeout(() => connection.sendPuppyTrick(trick), delay); return; }
        nextTrickAt = Date.now() + 160;
        socket.send(JSON.stringify({ type: "puppy_trick", trick }));
      },
      sendChat: message => {
        if (closed || socket?.readyState !== WebSocket.OPEN || Date.now() < nextChatAt) return false;
        try { socket.send(JSON.stringify({ type: "chat", message })); }
        catch { return false; }
        nextChatAt = Date.now() + 3100; // The Worker accepts one message per visitor every 3 seconds.
        options.onChatCooldown(nextChatAt);
        return true;
      },
      interact: request => new Promise(done => {
        if (closed || !selfId || socket?.readyState !== WebSocket.OPEN) { done({ ok: false, reason: "Wait for the village to reconnect." }); return; }
        const requestId = `${selfId}:${++requestNumber}`;
        const timer = window.setTimeout(() => { pending.delete(requestId); done({ ok: false, reason: "The village didn't respond. Try again." }); }, 4000);
        pending.set(requestId, { resolve: done, timer });
        socket.send(JSON.stringify({ type: "interaction", requestId, request, pose: options.getPose() }));
      }),
      close: () => {
        closed = true;
        window.clearInterval(interval);
        window.clearTimeout(retry);
        window.clearTimeout(trickTimer);
        window.clearTimeout(joinTimer);
        failPending();
        options.signal?.removeEventListener("abort", connection.close);
        socket?.close();
      },
    };
    const kicked = () => {
      if (closed) return;
      connection.close();
      options.onKicked?.();
      if (!connectedOnce) reject(new Error("You've been kicked from this village. Log back in later!"));
    };
    const open = () => {
      if (closed) return;
      const active = new WebSocket(endpoint);
      socket = active;
      let joined = false;
      joinTimer = window.setTimeout(() => { if (!joined) active.close(); }, 8000);
      active.onmessage = event => {
        if (closed || socket !== active) return;
        let message: WorldMessage;
        try { message = JSON.parse(event.data) as WorldMessage; }
        catch { return; }
        if (message.type === "kicked") {
          kicked();
        } else if (message.type === "welcome") {
          if (options.onWorld && (message.protocol !== 2 || !message.world)) {
            options.onRejected?.("The shared village needs its matching update. Please try again later.");
            connection.close(); reject(new Error("The shared village needs its matching update.")); return;
          }
          window.clearTimeout(joinTimer);
          joined = true;
          retryDelay = 1000;
          lastPose = null;
          nextChatAt = 0;
          nextTrickAt = 0;
          options.onChatCooldown(0);
          selfId = message.selfId;
          visitors.clear();
          for (const visitor of message.visitors) visitors.set(visitor.id, visitor);
          garden = readGarden(JSON.stringify(message.garden));
          chatHour = message.chatHour;
          chat = message.chat;
          publish(true);
          options.onCrumbs?.(message.hasCrumbs === true);
          if (inventoryToken) active.send(JSON.stringify({ type: "inventory_resume", token: inventoryToken }));
          else {
            acceptedInventory(message.forageInventory ?? { apples: 0, mushrooms: 0 }, message.inventoryToken);
            active.send(JSON.stringify({ type: "inventory_resume", token: inventoryToken }));
          }
          if (message.world) options.onWorld?.(message.world, selfId);
          for (const trick of message.puppyTricks ?? []) options.onPuppyTrick?.(trick);
          window.clearInterval(interval);
          interval = window.setInterval(() => {
            const pose = options.getPose();
            if (pose && !pose.horse && active.readyState === WebSocket.OPEN && (!lastPose
              || Math.hypot(pose.x - lastPose.x, pose.z - lastPose.z) > 0.01
              || pose.y !== lastPose.y
              || Math.abs(pose.heading - lastPose.heading) > 0.01
              || JSON.stringify(pose.swing ?? null) !== JSON.stringify(lastPose.swing ?? null)
              || JSON.stringify(pose.bench ?? null) !== JSON.stringify(lastPose.bench ?? null)
              || pose.lookout !== lastPose.lookout || pose.activity !== lastPose.activity || pose.horse !== lastPose.horse)) {
              lastPose = pose;
              active.send(JSON.stringify({ type: "move", ...pose }));
            }
            if (pose && active.readyState === WebSocket.OPEN) active.send(JSON.stringify({ type: "heartbeat", active: pose.active !== false,
              lookout: pose.lookout ?? null, holdingPuppy: pose.holdingPuppy ?? null, activity: pose.activity ?? null, bench: pose.bench ?? null, horse: pose.horse ?? null,
              swing: pose.swing ? { id: pose.swing.id, index: pose.swing.index } : null }));
          }, 120);
          if (!connectedOnce) { connectedOnce = true; resolve(connection); }
        } else if (message.type === "join") {
          visitors.set(message.visitor.id, message.visitor);
          publish();
        } else if (message.type === "move") {
          const visitor = visitors.get(message.id);
          if (visitor) { Object.assign(visitor, { x: message.x, y: message.y, z: message.z, heading: message.heading, lookout: message.lookout ?? null, horse: message.horse ?? null, swing: message.swing ?? null, bench: message.bench ?? null, activity: message.activity ?? null }); publish(); }
        } else if (message.type === "actors") {
          options.onWorld?.(message.world, selfId);
        } else if (message.type === "crumbs") {
          options.onCrumbs?.(message.hasCrumbs);
        } else if (message.type === "action_rejected") {
          options.onRejected?.(message.message);
        } else if (message.type === "interaction_result") {
          const request = pending.get(message.requestId);
          if (request) { pending.delete(message.requestId); window.clearTimeout(request.timer); request.resolve(message.result); }
        } else if (message.type === "forageInventory") {
          acceptedInventory(message.inventory, message.token);
        } else if (message.type === "swing_taken") {
          options.onSwingTaken?.();
        } else if (message.type === "puppy_trick") {
          if (message.actor === selfId) nextTrickAt = Date.now() + 160;
          options.onPuppyTrick?.(message.trick);
        } else if (message.type === "leave") {
          visitors.delete(message.id);
          publish();
        } else if (message.type === "garden") {
          garden = readGarden(JSON.stringify(message.garden));
          publish(true);
          options.onAction({ action: message.event.action, x: message.event.x, z: message.event.z, isSelf: message.event.actor === selfId });
        } else if (message.type === "chat") {
          if (chatHour !== message.chatHour) chat = [];
          chatHour = message.chatHour;
          chat = [...chat, message.entry].slice(-80);
          publish();
          options.onChat(message.entry);
        } else if (message.type === "chat_sync") {
          chatHour = message.chatHour;
          chat = message.chat;
          publish();
          options.onChatModerated?.(message.removedMessageIds);
        } else if (message.type === "hour") {
          chatHour = message.chatHour;
          chat = [];
          publish();
        } else if (message.type === "error" && !joined) {
          reject(new Error(message.message));
          active.close();
        }
      };
      active.onclose = event => {
        if (socket !== active) return;
        if (event.code === 4003) { kicked(); return; }
        window.clearInterval(interval);
        window.clearTimeout(trickTimer);
        window.clearTimeout(joinTimer);
        failPending();
        if (closed) return;
        selfId = "";
        options.onForageInventory?.({ apples: 0, mushrooms: 0 });
        options.onDisconnect();
        retry = window.setTimeout(open, retryDelay);
        retryDelay = Math.min(retryDelay * 2, 10_000);
      };
    };
    options.signal?.addEventListener("abort", connection.close, { once: true });
    if (options.signal?.aborted) { connection.close(); return; }
    open();
  });
}
