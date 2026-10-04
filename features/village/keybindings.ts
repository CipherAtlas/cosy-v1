export const BINDING_ACTIONS = [
  { id: "forward", key: "w", label: "Move forward", ja: "前へ移動", group: "Movement" },
  { id: "left", key: "a", label: "Move left", ja: "左へ移動", group: "Movement" },
  { id: "back", key: "s", label: "Move back", ja: "後ろへ移動", group: "Movement" },
  { id: "right", key: "d", label: "Move right", ja: "右へ移動", group: "Movement" },
  { id: "run", key: "shift", label: "Hold to run / canter", ja: "走る・駆ける", group: "Movement" },
  { id: "jump", key: " ", label: "Jump / brake / pause", ja: "ジャンプ・停止・一時停止", group: "Movement" },
  { id: "interact", key: "e", label: "Interact / pet / sit", ja: "調べる・なでる・座る", group: "Interactions" },
  { id: "talk", key: "f", label: "Talk / feed / tend", ja: "話す・餌やり・お世話", group: "Interactions" },
  { id: "invite", key: "c", label: "Invite / offer", ja: "誘う・渡す", group: "Interactions" },
  { id: "bread", key: "b", label: "Ask for crumbs / take a break", ja: "パンくず・休憩", group: "Interactions" },
  { id: "recover", key: "r", label: "Recover / reset", ja: "安全な場所へ・リセット", group: "Interactions" },
  { id: "pace", key: "g", label: "Toggle glide speed", ja: "移動速度を切り替える", group: "Interactions" },
  { id: "choiceOne", key: "1", label: "First action / preset", ja: "操作・プリセット1", group: "Interactions" },
  { id: "choiceTwo", key: "2", label: "Second action / preset", ja: "操作・プリセット2", group: "Interactions" },
  { id: "choiceThree", key: "3", label: "Third action / preset", ja: "操作・プリセット3", group: "Interactions" },
  { id: "walkDog", key: "p", label: "Walk with a dog", ja: "犬とお散歩", group: "Dogs" },
  { id: "homeDogs", key: "h", label: "Send dogs home", ja: "犬をおうちへ", group: "Dogs" },
  { id: "tricks", key: "t", label: "Open dog tricks", ja: "犬の芸を開く", group: "Dogs" },
  { id: "sitDog", key: "z", label: "Sit trick", ja: "おすわり", group: "Dogs" },
  { id: "danceDog", key: "x", label: "Dance trick", ja: "ダンス", group: "Dogs" },
  { id: "spinDog", key: "v", label: "Spin trick", ja: "まわる", group: "Dogs" },
  { id: "bowDog", key: "q", label: "Bow trick", ja: "おじぎ", group: "Dogs" },
  { id: "waveDog", key: "j", label: "Wave trick", ja: "おてて", group: "Dogs" },
  { id: "rollDog", key: "k", label: "Roll trick / keep a note", ja: "ごろん・手紙を保存", group: "Dogs" },
  { id: "map", key: "m", label: "Village map", ja: "村の地図", group: "Menus" },
  { id: "inventory", key: "i", label: "Harvest basket", ja: "収穫かご", group: "Menus" },
  { id: "sound", key: "o", label: "Sound", ja: "音", group: "Menus" },
  { id: "settings", key: ",", label: "Settings", ja: "設定", group: "Menus" },
  { id: "activity", key: "u", label: "Show activity controls", ja: "操作を表示", group: "Menus" },
] as const;
export type BindingAction = typeof BINDING_ACTIONS[number]["id"];
export type Keybindings = Record<BindingAction, string>;
export const DEFAULT_KEYBINDINGS = Object.fromEntries(BINDING_ACTIONS.map(action => [action.id, action.key])) as Keybindings;

export function allowedBinding(key: string) {
  return key === "shift" || key === " " || /^[a-z0-9,.;'\/\\\[\]`=\-]$/.test(key);
}

export function readKeybindings(value: unknown): Keybindings {
  if (!value || typeof value !== "object") return { ...DEFAULT_KEYBINDINGS };
  const bindings = { ...DEFAULT_KEYBINDINGS, ...Object.fromEntries(BINDING_ACTIONS.map(action =>
    [action.id, (value as Record<string, unknown>)[action.id] ?? action.key])) };
  const keys = Object.values(bindings);
  return keys.every(key => typeof key === "string" && allowedBinding(key)) && new Set(keys).size === keys.length
    ? bindings as Keybindings : { ...DEFAULT_KEYBINDINGS };
}

/** Translate physical keys into the scene's existing action tokens at its input boundary. */
export function gameKey(bindings: Keybindings, physical: string) {
  const key = physical.toLowerCase();
  const action = BINDING_ACTIONS.find(action => bindings[action.id] === key);
  if (action) return action.key;
  return BINDING_ACTIONS.some(action => action.key === key) ? "" : key;
}

export function keyName(key: string) {
  return key === " " ? "Space" : key === "shift" ? "Shift" : key.length === 1 ? key.toUpperCase() : key;
}

export function boundKey(bindings: Keybindings, token: string) {
  const key = ["Space", "␣"].includes(token) ? " " : token.toLowerCase();
  const action = BINDING_ACTIONS.find(action => action.key === key);
  return action ? keyName(bindings[action.id]) : token;
}

export function shortcutKeys(bindings: Keybindings, keys: string) {
  return keys.split(/\s+/).map(key => boundKey(bindings, key)).join(" ");
}
