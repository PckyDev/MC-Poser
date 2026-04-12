import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faKoFi } from "@fortawesome/free-brands-svg-icons";
import {
  faImage,
  faShareNodes,
  faSliders,
} from "@fortawesome/free-solid-svg-icons";

import pockydevPoseImage from "../../img/pockydev-pose.png";

type StartupModalProps = {
  isOpen: boolean;
  isLoading: boolean;
  onCreateNewFile: () => void;
  onOpenPoseFile: () => void;
};

const STARTUP_FEATURE_CARDS = [
  {
    description: "Start from a Minecraft username lookup or drop in a PNG skin.",
    icon: faImage,
    title: "Load a skin",
  },
  {
    description: "Adjust joints, layers, and framing until the pose reads the way you want.",
    icon: faSliders,
    title: "Pose the model",
  },
  {
    description: "Export a final render or share the project once the scene is ready.",
    icon: faShareNodes,
    title: "Export or share",
  },
] as const;

export function StartupModal({
  isOpen,
  isLoading,
  onCreateNewFile,
  onOpenPoseFile,
}: StartupModalProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="startup-overlay">
      <div
        className="startup-modal startup-modal--welcome"
        role="dialog"
        aria-modal="true"
        aria-labelledby="startup-modal-title"
      >
        <div className="startup-hero">
          <div className="startup-welcome-copy">
            <h2 id="startup-modal-title">Welcome to MC Poser</h2>
            <p className="startup-copy modal-copy">
              MC Poser is a lightweight editor for posing Minecraft skins in 3D and exporting or sharing the result.
            </p>

            <div className="startup-feature-stack" aria-label="Quick flow">
              {STARTUP_FEATURE_CARDS.map((featureCard) => (
                <div key={featureCard.title} className="startup-feature-card">
                  <span className="startup-feature-icon" aria-hidden="true">
                    <FontAwesomeIcon icon={featureCard.icon} />
                  </span>

                  <div className="startup-feature-copy">
                    <strong>{featureCard.title}</strong>
                    <span>{featureCard.description}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="startup-hero-media" aria-hidden="true">
            <img className="startup-hero-image" src={pockydevPoseImage} alt="" />
          </div>
        </div>

        <div className="startup-choice-grid startup-choice-grid--welcome">
          <section className="startup-choice-card startup-choice-card--primary">
            <div className="modal-section-header">
              <h3>Create new file</h3>
              <p className="modal-section-copy">
                Start a fresh workspace from a username lookup or a PNG skin and jump straight into posing.
              </p>
            </div>

            <button
              className="toolbar-button toolbar-button--accent"
              type="button"
              onClick={onCreateNewFile}
              disabled={isLoading}
            >
              Create New File
            </button>
          </section>

          <section className="startup-choice-card startup-choice-card--secondary">
            <div className="modal-section-header">
              <h3>Open existing file</h3>
              <p className="modal-section-copy">
                Open a saved .mcpose workspace and continue from the exact pose, skin, and layer setup you already had.
              </p>
            </div>

            <button
              className="toolbar-button"
              type="button"
              onClick={onOpenPoseFile}
              disabled={isLoading}
            >
              Open Existing File
            </button>
          </section>
          <aside className="startup-support-banner" aria-label="Support MC Poser on Ko-Fi">
            <div className="startup-support-copy-wrap">
              <strong className="startup-support-title">Support MC Poser</strong>
              <p className="startup-support-copy">
                If MC Poser is useful to you, you can help support future updates on Ko-Fi.
              </p>
            </div>

            <a
              className="toolbar-button toolbar-button--accent startup-support-button"
              href="https://ko-fi.com/pockydev"
              target="_blank"
              rel="noreferrer"
            >
              <FontAwesomeIcon className="startup-support-button-icon" icon={faKoFi} />
              <span>Support on Ko-Fi</span>
            </a>
          </aside>
        </div>
      </div>
    </div>
  );
}
