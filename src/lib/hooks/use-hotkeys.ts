"use client";

import { useEffect, useRef } from "react";

type Handler = (e: KeyboardEvent) => void;

function isTyping(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  return !!el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName));
}

/**
 * Minimaler Hotkey-Hook. Keys: "j", "shift+e", "mod+enter" (⌘/Strg), Sequenzen wie "g i".
 * Einfache Tasten werden beim Tippen in Feldern ignoriert, "mod+…" funktioniert überall.
 */
export function useHotkeys(map: Record<string, Handler>, enabled = true) {
  const ref = useRef(map);
  useEffect(() => {
    ref.current = map;
  });

  useEffect(() => {
    if (!enabled) return;
    let prefix: string | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const onKey = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      const combo = [e.metaKey || e.ctrlKey ? "mod" : "", e.shiftKey ? "shift" : "", e.altKey ? "alt" : "", key]
        .filter(Boolean)
        .join("+");
      const typing = isTyping(e.target);
      const handlers = ref.current;

      if (prefix) {
        const seq = handlers[`${prefix} ${key}`];
        prefix = null;
        clearTimeout(timer);
        if (seq && !typing) {
          e.preventDefault();
          seq(e);
          return;
        }
      }

      const handler = handlers[combo];
      if (handler && (!typing || combo.startsWith("mod+") || key === "escape")) {
        e.preventDefault();
        handler(e);
        return;
      }

      if (!typing && !e.metaKey && !e.ctrlKey && Object.keys(handlers).some((k) => k.startsWith(`${key} `))) {
        prefix = key;
        timer = setTimeout(() => (prefix = null), 800);
      }
    };

    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      clearTimeout(timer);
    };
  }, [enabled]);
}
