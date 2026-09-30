import { readGarden, type GardenAction, type GardenState } from "./garden";
import type { PuppyCommand } from "./puppies";
import type { SwingSeat } from "./swings";

export type SharedSwingRide = SwingSeat & { angle: number; velocity: number };
export type SharedPuppyTrick = { id: string; command: PuppyCommand; x: number; z: number; heading: number; startedAt: number };
export type SharedVisitor = { id: string; name: string; color: string; slot: number; x: number; y?: number; z: number; heading: number; swing?: SharedSwingRide | null };
export type SharedChatEntry = { id?: string; messageId?: string; name: string; message: string; sentAt?: number };
export type SharedWorldConnection = {
  sendGarden: (action: GardenAction) => void;
  sendChat: (message: string) => boolean;
  sendPuppyTrick: (trick: SharedPuppyTrick) => void;
  close: () => void;
};

type WorldMessage =
  | { type: "welcome"; selfId: string; visitors: SharedVisitor[]; garden: GardenState; chatHour: number; chat: SharedChatEntry[]; puppyTricks?: SharedPuppyTrick[] }
  | { type: "join"; visitor: SharedVisitor }
  | { type: "move"; id: string; x: number; y?: number; z: number; heading: number; swing?: SharedSwingRide | null }
  | { type: "swing_taken" }
  | { type: "puppy_trick"; actor: string; trick: SharedPuppyTrick }
  | { type: "leave"; id: string }
  | { type: "garden"; garden: GardenState; event: { action: GardenAction; actor: string; x: number; z: number } }
  | { type: "chat"; chatHour: number; entry: SharedChatEntry }
  | { type: "chat_sync"; chatHour: number; chat: SharedChatEntry[]; removedMessageIds: string[] }
  | { type: "hour"; chatHour: number }
  | { type: "error"; message: string };

export function connectSharedWorld(options: {
  getPose: () => { x: number; y?: number; z: number; heading: number; swing?: SharedSwingRide | null } | null;
  onState: (snapshot: { selfId: string; visitors: SharedVisitor[]; garden: GardenState; gardenChanged: boolean; chatHour: number; chat: SharedChatEntry[] }) => void;
  onChat: (entry: SharedChatEntry) => void;
  onChatModerated?: (removedMessageIds: string[]) => void;
  onChatCooldown: (until: number) => void;
  onAction: (event: { action: GardenAction; x: number; z: number; isSelf: boolean }) => void;
  onDisconnect: () => void;
  onSwingTaken?: () => void;
  onPuppyTrick?: (trick: SharedPuppyTrick) => void;
}): Promise<SharedWorldConnection> {
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
    const publish = (gardenChanged = false) => options.onState({
      selfId, visitors: [...visitors.values()], garden, gardenChanged, chatHour, chat,
    });
    const connection: SharedWorldConnection = {
      sendGarden: action => { if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: "garden", action })); },
      sendPuppyTrick: trick => {
        window.clearTimeout(trickTimer);
        if (socket?.readyState !== WebSocket.OPEN) return;
        const delay = Math.max(0, nextTrickAt - Date.now());
        if (delay) { trickTimer = window.setTimeout(() => connection.sendPuppyTrick(trick), delay); return; }
        nextTrickAt = Date.now() + 160;
        socket.send(JSON.stringify({ type: "puppy_trick", trick }));
      },
      sendChat: message => {
        if (socket?.readyState !== WebSocket.OPEN || Date.now() < nextChatAt) return false;
        try { socket.send(JSON.stringify({ type: "chat", message })); }
        catch { return false; }
        nextChatAt = Date.now() + 3100; // The Worker accepts one message per visitor every 3 seconds.
        options.onChatCooldown(nextChatAt);
        return true;
      },
      close: () => {
        closed = true;
        window.clearInterval(interval);
        window.clearTimeout(retry);
        window.clearTimeout(trickTimer);
        socket?.close();
      },
    };
    const open = () => {
      if (closed) return;
      const active = new WebSocket(endpoint);
      socket = active;
      let joined = false;
      active.onmessage = event => {
        let message: WorldMessage;
        try { message = JSON.parse(event.data) as WorldMessage; }
        catch { return; }
        if (message.type === "welcome") {
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
          for (const trick of message.puppyTricks ?? []) options.onPuppyTrick?.(trick);
          window.clearInterval(interval);
          interval = window.setInterval(() => {
            const pose = options.getPose();
            if (pose && active.readyState === WebSocket.OPEN && (!lastPose
              || Math.hypot(pose.x - lastPose.x, pose.z - lastPose.z) > 0.01
              || pose.y !== lastPose.y
              || Math.abs(pose.heading - lastPose.heading) > 0.01
              || JSON.stringify(pose.swing ?? null) !== JSON.stringify(lastPose.swing ?? null))) {
              lastPose = pose;
              active.send(JSON.stringify({ type: "move", ...pose }));
            }
          }, 120);
          if (!connectedOnce) { connectedOnce = true; resolve(connection); }
        } else if (message.type === "join") {
          visitors.set(message.visitor.id, message.visitor);
          publish();
        } else if (message.type === "move") {
          const visitor = visitors.get(message.id);
          if (visitor) { Object.assign(visitor, { x: message.x, y: message.y, z: message.z, heading: message.heading, swing: message.swing ?? null }); publish(); }
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
      active.onclose = () => {
        window.clearInterval(interval);
        window.clearTimeout(trickTimer);
        if (closed) return;
        if (!connectedOnce) { reject(new Error("Could not join the shared village.")); return; }
        if (joined) options.onDisconnect();
        retry = window.setTimeout(open, retryDelay);
        retryDelay = Math.min(retryDelay * 2, 10_000);
      };
    };
    open();
  });
}
