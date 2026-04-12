import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faDiscord,
  faGithub,
  faRedditAlien,
  faYoutube,
} from "@fortawesome/free-brands-svg-icons";
import {
  faArrowUpRightFromSquare,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";

import pockydevPoseImage from "../../img/pockydev-pose.png";

export type HelpContactModalKind = "ideas" | "issues";

type HelpContactModalProps = {
  kind: HelpContactModalKind | null;
  onClose: () => void;
};

const HELP_MODAL_CONTENT = {
  ideas: {
    description: "Have a feature idea, workflow improvement, or polish request? Reach out directly and I can take a look.",
    guidanceCopy: "Share what you want to do, what feels missing right now, and what outcome you are aiming for. Mockups and examples help too.",
    guidanceTitle: "What helps most",
    title: "Suggest an idea",
  },
  issues: {
    description: "If something looks wrong, breaks, or behaves unexpectedly, send the details directly so I can reproduce it and sort it out.",
    guidanceCopy: "Tell me what you were doing, what you expected to happen, and what happened instead. Screenshots, error text, and reproduction steps are the most useful.",
    guidanceTitle: "What helps most",
    title: "Report a bug or issue",
  },
} as const;

const SOCIAL_LINKS = [
  {
    href: "https://www.reddit.com/user/PckyDev/",
    icon: faRedditAlien,
    label: "Reddit",
  },
  {
    href: "https://github.com/PckyDev",
    icon: faGithub,
    label: "GitHub",
  },
  {
    href: "https://www.youtube.com/@PckyDev",
    icon: faYoutube,
    label: "YouTube",
  },
] as const;

export function HelpContactModal({ kind, onClose }: HelpContactModalProps) {
  if (!kind) {
    return null;
  }

  const modalContent = HELP_MODAL_CONTENT[kind];

  return (
    <div className="document-overlay">
      <div
        className="startup-modal startup-modal--welcome help-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-contact-modal-title"
      >
        <button
          className="icon-button modal-close-button help-modal-close-button"
          type="button"
          aria-label="Close help modal"
          onClick={onClose}
        >
          <FontAwesomeIcon icon={faXmark} />
        </button>

        <div className="startup-hero help-modal-hero">
          <div className="startup-welcome-copy help-modal-copy">
            <h2 id="help-contact-modal-title">{modalContent.title}</h2>

            <p className="startup-copy modal-copy">{modalContent.description}</p>

            <div className="help-modal-discord-card">
              <span className="help-modal-discord-label">
                <FontAwesomeIcon icon={faDiscord} />
                <span>Discord</span>
              </span>

              <strong className="help-modal-discord-username">PockyDev</strong>

              <p className="help-modal-discord-copy">
                Add me directly if you want the fastest route for follow-up questions.
              </p>
            </div>
          </div>

          <div className="startup-hero-media help-modal-media" aria-hidden="true">
            <img className="startup-hero-image help-modal-image" src={pockydevPoseImage} alt="" />
          </div>
        </div>

        <div className="help-modal-body">
          <section className="help-modal-card modal-page-section">
            <div className="modal-section-header">
              <h3>{modalContent.guidanceTitle}</h3>
              <p className="modal-section-copy">{modalContent.guidanceCopy}</p>
            </div>
          </section>

          <section className="help-modal-card modal-page-section">
            <div className="modal-section-header">
              <h3>Find me here</h3>
              <p className="modal-section-copy">
                These links open in a new tab if you would rather reach out somewhere other than Discord.
              </p>
            </div>

            <div className="help-modal-social-grid">
              {SOCIAL_LINKS.map((socialLink) => (
                <a
                  key={socialLink.label}
                  className="toolbar-button help-social-link"
                  href={socialLink.href}
                  rel="noreferrer"
                  target="_blank"
                >
                  <span className="help-social-link-label">
                    <FontAwesomeIcon icon={socialLink.icon} />
                    <span>{socialLink.label}</span>
                  </span>

                  <FontAwesomeIcon
                    className="help-social-link-arrow"
                    icon={faArrowUpRightFromSquare}
                  />
                </a>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}