import { useId, useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronDown } from "@fortawesome/free-solid-svg-icons";
import "./CollapsiblePanel.css";

export function CollapsiblePanel({
  title,
  children,
  storageKey,
  stretch = false,
}: {
  title: string;
  children: ReactNode;
  storageKey?: string;
  stretch?: boolean;
}) {
  const [open, setOpen] = useState(() => {
    try {
      return (
        !storageKey ||
        localStorage.getItem("mcposer.panel." + storageKey) !== "closed"
      );
    } catch {
      return true;
    }
  });
  const toggle = () =>
    setOpen((value) => {
      const next = !value;
      try {
        if (storageKey)
          localStorage.setItem(
            "mcposer.panel." + storageKey,
            next ? "open" : "closed",
          );
      } catch {
        /* Storage may be unavailable. */
      }
      return next;
    });
  const id = useId();
  const reducedMotion = useReducedMotion();

  return (
    <motion.section
      initial={false}
      animate={stretch ? { flexGrow: open ? 1 : 0 } : undefined}
      transition={{ duration: reducedMotion ? 0 : 0.24, ease: "easeInOut" }}
      className={`editor-panel collapsible-panel ${stretch ? "stretch" : ""} ${open ? "is-open" : ""}`}
    >
      <h2 className="heading">
        <button
          className="panel-heading trigger"
          type="button"
          aria-expanded={open}
          aria-controls={id}
          onClick={toggle}
        >
          <span>{title}</span>
          <motion.span
            aria-hidden="true"
            animate={{ rotate: open ? 0 : 180 }}
            transition={{ duration: reducedMotion ? 0 : 0.24 }}
          >
            <FontAwesomeIcon icon={faChevronDown} />
          </motion.span>
        </button>
      </h2>
      <motion.div
        id={id}
        className="body"
        inert={!open}
        aria-hidden={!open}
        initial={false}
        animate={{ height: open ? "auto" : 0, opacity: open ? 1 : 0 }}
        transition={{ duration: reducedMotion ? 0 : 0.24, ease: "easeInOut" }}
      >
        {children}
      </motion.div>
    </motion.section>
  );
}
