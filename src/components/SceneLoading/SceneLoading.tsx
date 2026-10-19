import "./SceneLoading.css";

export function SceneLoading({
  loading,
  error,
  onChooseSkin,
}: {
  loading: boolean;
  error: string | null;
  onChooseSkin: () => void;
}) {
  return (
    <main className="scene-loading" aria-label="Advanced editor loading">
      <h2>
        {loading ? "Loading your first avatar..." : "Your scene needs a skin"}
      </h2>
      {error ? (
        <p role="alert">{error}</p>
      ) : (
        <p>
          Once the skin is ready, you can add more avatars and start arranging
          the scene.
        </p>
      )}
      {!loading ? (
        <button className="toolbar-button" type="button" onClick={onChooseSkin}>
          Choose a skin
        </button>
      ) : null}
    </main>
  );
}
