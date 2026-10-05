"use client";
import { createContext, useContext, useEffect, useState, type ComponentProps } from "react";
import { BINDING_ACTIONS, DEFAULT_KEYBINDINGS, allowedBinding, keyName, shortcutKeys, type BindingAction, type Keybindings } from "./keybindings";

export const KeybindingContext = createContext<Keybindings>(DEFAULT_KEYBINDINGS);

export function Keycap({ children, ...props }: ComponentProps<"kbd">) {
  const bindings = useContext(KeybindingContext);
  return <kbd {...props}>{typeof children === "string" || typeof children === "number" ? shortcutKeys(bindings, String(children)) : children}</kbd>;
}

export function ShortcutButton({ "aria-keyshortcuts": shortcuts, ...props }: ComponentProps<"button">) {
  const bindings = useContext(KeybindingContext);
  return <button {...props} aria-keyshortcuts={shortcuts ? shortcutKeys(bindings, shortcuts) : undefined} />;
}

export function KeybindingControls({ bindings, setBindings, language }: {
  bindings: Keybindings; setBindings: (value: Keybindings) => void; language: "en" | "ja";
}) {
  const ja = language === "ja";
  const [capturing, setCapturing] = useState<BindingAction | null>(null);
  const [conflict, setConflict] = useState<{ other: BindingAction; key: string } | null>(null);
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (!capturing) return;
    const capture = (event: KeyboardEvent) => {
      if (event.key === "Tab") return;
      if ((event.key === "Enter" || event.key === " ") && event.target instanceof Element && event.target.closest(".v-binding-status button")) return;
      event.preventDefault(); event.stopImmediatePropagation();
      if (event.key === "Escape") { setCapturing(null); setConflict(null); setMessage(""); return; }
      if (event.repeat || event.isComposing) return;
      const key = event.key.toLowerCase();
      if (event.metaKey || event.ctrlKey || event.altKey || !allowedBinding(key)) {
        setMessage(ja ? "文字・数字・記号・Space・Shiftから選んでください。" : "Choose a letter, number, punctuation key, Space or Shift."); return;
      }
      const other = BINDING_ACTIONS.find(action => action.id !== capturing && bindings[action.id] === key);
      if (other) {
        setConflict({ other: other.id, key });
        setMessage(ja ? `${keyName(key)}は「${other.ja}」に使用中です。` : `${keyName(key)} is used for ${other.label.toLowerCase()}.`);
      } else {
        setBindings({ ...bindings, [capturing]: key }); setCapturing(null); setConflict(null);
        setMessage(ja ? "キーを保存しました。" : "Key saved.");
      }
    };
    window.addEventListener("keydown", capture, true);
    return () => window.removeEventListener("keydown", capture, true);
  }, [capturing, bindings, setBindings, ja]);
  return <div className="v-keybindings">
    <div className="v-settings-section-heading"><h3>{ja ? "キーの割り当て" : "Keybindings"}</h3>
      <button className="v-settings-reset" disabled={!!capturing} onClick={() => { setBindings({ ...DEFAULT_KEYBINDINGS }); setMessage(ja ? "初期設定に戻しました。" : "Default keys restored."); }}>{ja ? "初期設定に戻す" : "Reset keys"}</button></div>
    <p className="v-settings-help">{ja ? "キーを選んで新しいキーを押します。Escapeでキャンセル。矢印キー・Enter・Tab・Escape・Backspaceは常に使用できます。" : "Select a key, then press its replacement. Escape cancels. Arrow keys, Enter, Tab, Escape and Backspace keep their navigation roles."}</p>
    {(capturing || message) && <div className="v-binding-status" role="status">
      <span>{message || (ja ? "新しいキーを押してください…" : "Press a new key…")}</span>
      {capturing && <div>
        {conflict && <button onClick={() => { setBindings({ ...bindings, [capturing]: conflict.key, [conflict.other]: bindings[capturing] }); setCapturing(null); setConflict(null); setMessage(ja ? "キーを入れ替えました。" : "Keys swapped and saved."); }}>{ja ? "入れ替える" : "Swap keys"}</button>}
        <button onClick={() => { setCapturing(null); setConflict(null); setMessage(""); }}>{ja ? "キャンセル" : "Cancel"}</button>
      </div>}
    </div>}
    {(["Movement", "Interactions", "Dogs", "Menus"] as const).map((group, index) => <details className="v-binding-group" key={group} open={index === 0 ? true : undefined}>
      <summary>{ja ? ["移動", "ふれあい", "犬", "メニュー"][index] : group}</summary>
      {BINDING_ACTIONS.filter(action => action.group === group).map(action => <div className="v-binding-row" key={action.id}>
        <span>{ja ? action.ja : action.label}</span>
        <button className={capturing === action.id ? "is-capturing" : ""} aria-label={ja ? `${action.ja}のキーを変更` : `Change key for ${action.label.toLowerCase()}`}
          aria-pressed={capturing === action.id} onClick={() => { setCapturing(action.id); setConflict(null); setMessage(""); }}>
          <kbd>{capturing === action.id ? "…" : keyName(bindings[action.id])}</kbd>
        </button>
      </div>)}
    </details>)}
  </div>;
}
