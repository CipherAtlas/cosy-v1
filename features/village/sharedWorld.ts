import { readGarden, type GardenAction, type GardenState } from "./garden";

export type SharedVisitor = { id: string; name: string; color: string; slot: number; x: number; z: number; heading: number };
export type SharedChatEntry = { id?: string; messageId?: string; name: string; message: string };
export type SharedWorldConnection = {
  sendGarden: (action: GardenAction) => void;
  sendChat: (message: string) => void;
  close: () => void;
};

type WorldMessage =
  | { type: "welcome"; selfId: string; visitors: SharedVisitor[]; garden: GardenState; chatHour: number; chat: SharedChatEntry[] }
  | { type: "join"; visitor: SharedVisitor }
  | { type: "move"; id: string; x: number; z: number; heading: number }
  | { type: "leave"; id: string }
  | { type: "garden"; garden: GardenState; event: { action: GardenAction; actor: string; x: number; z: number } }
  | { type: "chat"; chatHour: number; entry: SharedChatEntry }
  | { type: "chat_sync"; chatHour: number; chat: SharedChatEntry[]; removedMessageIds: string[] }
  | { type: "hour"; chatHour: number }
  | { type: "error"; message: string };

export function connectSharedWorld(options: {
  getPose: () => { x: number; z: number; heading: number } | null;
  onState: (snapshot: { selfId: string; visitors: SharedVisitor[]; garden: GardenState; gardenChanged: boolean; chatHour: number; chat: SharedChatEntry[] }) => void;
  onChat: (entry: SharedChatEntry) => void;
  onChatModerated?: (removedMessageIds: string[]) => void;
  onAction: (event: { action: GardenAction; x: number; z: number; isSelf: boolean }) => void;
  onDisconnect: () => void;
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
    let lastPose: { x: number; z: number; heading: number } | null = null;
    const publish = (gardenChanged = false) => options.onState({
      selfId, visitors: [...visitors.values()], garden, gardenChanged, chatHour, chat,
    });
    const connection: SharedWorldConnection = {
      sendGarden: action => { if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: "garden", action })); },
      sendChat: message => { if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: "chat", message })); },
      close: () => {
        closed = true;
        window.clearInterval(interval);
        window.clearTimeout(retry);
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
          selfId = message.selfId;
          visitors.clear();
          for (const visitor of message.visitors) visitors.set(visitor.id, visitor);
          garden = readGarden(JSON.stringify(message.garden));
          chatHour = message.chatHour;
          chat = message.chat;
          publish(true);
          window.clearInterval(interval);
          interval = window.setInterval(() => {
            const pose = options.getPose();
            if (pose && active.readyState === WebSocket.OPEN && (!lastPose
              || Math.hypot(pose.x - lastPose.x, pose.z - lastPose.z) > 0.01
              || Math.abs(pose.heading - lastPose.heading) > 0.01)) {
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
          if (visitor) { Object.assign(visitor, { x: message.x, z: message.z, heading: message.heading }); publish(); }
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
