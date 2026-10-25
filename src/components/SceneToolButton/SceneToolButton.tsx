import { useEffect, useId, useState, type ButtonHTMLAttributes } from "react";
import { createPortal } from "react-dom";
import type { IconDefinition } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import "./SceneToolButton.css";

export function SceneToolButton({
  label,
  icon,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  icon: IconDefinition;
}) {
  const id = useId();
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  useEffect(() => {
    if (!anchor) return;
    const dismiss = () => setAnchor(null);
    window.addEventListener("scroll", dismiss, true);
    window.addEventListener("resize", dismiss);
    return () => {
      window.removeEventListener("scroll", dismiss, true);
      window.removeEventListener("resize", dismiss);
    };
  }, [anchor]);
  return (
    <>
      <button
        {...props}
        type="button"
        className={`scene-tool-button ${className}`.trim()}
        aria-label={label}
        aria-describedby={anchor ? id : undefined}
        onClick={(e) => {
          setAnchor(null);
          props.onClick?.(e);
        }}
        onMouseEnter={(e) => {
          setAnchor(e.currentTarget.getBoundingClientRect());
          props.onMouseEnter?.(e);
        }}
        onMouseLeave={(e) => {
          setAnchor(null);
          props.onMouseLeave?.(e);
        }}
        onFocus={(e) => {
          setAnchor(e.currentTarget.getBoundingClientRect());
          props.onFocus?.(e);
        }}
        onBlur={(e) => {
          setAnchor(null);
          props.onBlur?.(e);
        }}
        onPointerDown={(e) => {
          setAnchor(null);
          props.onPointerDown?.(e);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") setAnchor(null);
          props.onKeyDown?.(e);
        }}
      >
        <FontAwesomeIcon icon={icon} />
      </button>
      {anchor &&
        !props["aria-expanded"] &&
        createPortal(
          <span
            id={id}
            role="tooltip"
            className="scene-tool-tooltip"
            style={{
              left: Math.max(8, Math.min(anchor.left, window.innerWidth - 190)),
              top: Math.min(anchor.bottom + 6, window.innerHeight - 38),
            }}
          >
            {label}
          </span>,
          document.body,
        )}
    </>
  );
}
