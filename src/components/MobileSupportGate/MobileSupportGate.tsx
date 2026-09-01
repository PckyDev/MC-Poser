import { useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faDesktop } from "@fortawesome/free-solid-svg-icons";

import App from "../../App";
import "./MobileSupportGate.css";

const UNSUPPORTED_DEVICE_QUERY = "(max-width: 760px), (hover: none) and (pointer: coarse)";

function isUnsupportedDevice(): boolean {
  return window.matchMedia(UNSUPPORTED_DEVICE_QUERY).matches;
}

export function MobileSupportGate() {
  const [isUnsupported, setIsUnsupported] = useState(isUnsupportedDevice);

  useEffect(() => {
    const mediaQuery = window.matchMedia(UNSUPPORTED_DEVICE_QUERY);
    const handleDeviceChange = () => setIsUnsupported(mediaQuery.matches);

    mediaQuery.addEventListener("change", handleDeviceChange);

    return () => mediaQuery.removeEventListener("change", handleDeviceChange);
  }, []);

  if (!isUnsupported) {
    return <App />;
  }

  return (
    <main className="mobile-support-gate">
      <section className="card" aria-labelledby="mobile-support-title">
        <img
          className="brand-icon"
          src="/brand/icon-transparent-cover.png"
          alt="MC Poser"
        />

        <div className="device-icon" aria-hidden="true">
          <FontAwesomeIcon icon={faDesktop} />
        </div>

        <div className="copy">
          <span className="eyebrow">Desktop required</span>
          <h1 id="mobile-support-title">MC Poser is not supported on mobile</h1>
          <p>
            Please switch to a desktop or laptop with a larger screen and a mouse or trackpad to use the pose editor.
          </p>
        </div>
      </section>
    </main>
  );
}
