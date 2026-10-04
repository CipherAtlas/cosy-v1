import type { SharedVisitor } from "../features/village/sharedWorld";
import type { SharedChatEntry, SharedPuppyTrick } from "../features/village/sharedWorld";
import type { GardenState } from "../features/village/garden";
import type { VillageSimulation } from "./simulation";
import type { ForageInventory } from "../features/village/townShared";

export type StoredRecords = {
  garden: GardenState;
  chat: { hour: number; entries: SharedChatEntry[] };
  puppyTricks: SharedPuppyTrick[];
  sharedActors: ReturnType<VillageSimulation["save"]>;
  ipKicks: [string | null, number][];
  nextSlot: number;
  visitorInventories: [string, { inventory: ForageInventory; usedAt: number }][];
};

export type WorkerVisitor = SharedVisitor & {
  ipHash: string | null; lastMove: number; lastChat: number; lastSeen: number;
  reservationUntil?: number; lastInteraction?: number; lastTrick?: number;
  active?: boolean; crumbPouch: boolean; left?: boolean; kickedUntil?: number;
  forageInventory?: ForageInventory;
  inventoryToken?: string;
  holdingPuppy?: string | null; activityPosition?: [number, number, number] | null; requestingActivity?: boolean;
};
export type WorkerEnvironment = {
  VILLAGE_ADMIN_TOKEN?: string;
  VILLAGE: { getByName(name: string): { fetch(request: Request): Promise<Response> } };
};
export type WorkerSocket = WebSocket & {
  accept(): void;
  deserializeAttachment(): WorkerVisitor;
  serializeAttachment(visitor: WorkerVisitor): void;
};
export type WorkerState = {
  getWebSockets(): WorkerSocket[];
  acceptWebSocket(socket: WorkerSocket): void;
  storage: {
    transactionSync<T>(callback: () => T): T;
    kv: {
      get<K extends keyof StoredRecords>(key: K): StoredRecords[K] | undefined;
      put<K extends keyof StoredRecords>(key: K, value: StoredRecords[K]): void;
    };
    getAlarm(): Promise<number | null>;
    setAlarm(time: number): Promise<void>;
  };
};
declare global {
  var WebSocketPair: { new(): { 0: WorkerSocket; 1: WorkerSocket } };
  interface ResponseInit { webSocket?: WorkerSocket }
}
