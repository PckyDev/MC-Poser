import { useEffect, useId, useRef, useState } from "react";
import { faPlus } from "@fortawesome/free-solid-svg-icons";
import { SceneToolButton } from "../SceneToolButton";
import "./SceneAddMenu.css";

export function SceneAddMenu({
  onAvatar,
  onModel,
  onBackground,
  hasBackground,
}: {
  onBackground: () => void;
  hasBackground: boolean;
  onAvatar: () => void;
  onModel: () => void;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const id = useId();
  const trigger = () =>
    root.current?.querySelector<HTMLButtonElement>("button");
  function close(restore = false) {
    setOpen(false);
    if (restore) trigger()?.focus();
  }
  useEffect(() => {
    if (!open) return;
    root.current
      ?.querySelector<HTMLButtonElement>('[role="menuitem"]')
      ?.focus();
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  return (
    <div
      className="scene-add-menu"
      ref={root}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null))
          setOpen(false);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.preventDefault();
          event.stopPropagation();
          close(true);
        }
      }}
    >
      <SceneToolButton
        label="Add scene object"
        icon={faPlus}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(true);
          }
        }}
      />
      {open ? (
        <div
          className="menu-dropdown-panel"
          id={id}
          role="menu"
          aria-label="Add scene object"
          onKeyDown={(event) => {
            const items = Array.from(
              event.currentTarget.querySelectorAll<HTMLButtonElement>(
                '[role="menuitem"]:not(:disabled)',
              ),
            );
            const index = items.indexOf(
              document.activeElement as HTMLButtonElement,
            );
            const next =
              event.key === "ArrowDown"
                ? (index + 1) % items.length
                : event.key === "ArrowUp"
                  ? (index + items.length - 1) % items.length
                  : event.key === "Home"
                    ? 0
                    : event.key === "End"
                      ? items.length - 1
                      : -1;
            if (next >= 0) {
              event.preventDefault();
              items[next]?.focus();
            }
          }}
        >
          <button
            type="button"
            role="menuitem"
            className="menu-dropdown-item"
            onClick={() => {
              close(true);
              onAvatar();
            }}
          >
            Avatar
          </button>
          <button
            type="button"
            role="menuitem"
            className="menu-dropdown-item"
            onClick={() => {
              close(true);
              onModel();
            }}
          >
            Java Model
          </button>
          <button
            type="button"
            role="menuitem"
            className="menu-dropdown-item"
            disabled={hasBackground}
            onClick={() => {
              close(true);
              onBackground();
            }}
          >
            Scene Background
          </button>
        </div>
      ) : null}
    </div>
  );
}
