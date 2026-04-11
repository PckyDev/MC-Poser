import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
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

            <p className="panel-note startup-choice-note">
              Best when you are starting a new composition, testing a skin, or setting up something to export.
            </p>
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

            <p className="panel-note startup-choice-note">
              Use this when you already have an MC Poser project and just want to keep working.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
