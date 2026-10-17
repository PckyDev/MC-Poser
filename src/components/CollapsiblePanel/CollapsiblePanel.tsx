import { useId, useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronDown } from "@fortawesome/free-solid-svg-icons";
import "./CollapsiblePanel.css";

export function CollapsiblePanel({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(true);
  const id = useId();
  const reducedMotion = useReducedMotion();

  return (
    <section className="editor-panel collapsible-panel">
      <h2 className="heading">
        <button className="panel-heading trigger" type="button" aria-expanded={open}
          aria-controls={id} onClick={() => setOpen(value => !value)}>
          <span>{title}</span>
          <motion.span aria-hidden="true" animate={{ rotate: open ? 0 : 180 }}
            transition={{ duration: reducedMotion ? 0 : 0.24 }}><FontAwesomeIcon icon={faChevronDown} /></motion.span>
        </button>
      </h2>
      <motion.div id={id} className="body" inert={!open} aria-hidden={!open}
        initial={false} animate={{ height: open ? "auto" : 0, opacity: open ? 1 : 0 }}
        transition={{ duration: reducedMotion ? 0 : 0.24, ease: "easeInOut" }}>
        {children}
      </motion.div>
    </section>
  );
}
