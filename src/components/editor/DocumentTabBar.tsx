type DocumentTabBarProps = {
  documents: Array<{
    id: string;
    poseFileName: string;
  }>;
  activeDocumentId: string;
  onSelectDocument: (documentId: string) => void;
};

export function DocumentTabBar({
  documents,
  activeDocumentId,
  onSelectDocument,
}: DocumentTabBarProps) {
  return (
    <div className="document-tabbar" aria-label="Open pose files">
      <div className="document-tabbar-scroll">
        {documents.map((document) => (
          <button
            key={document.id}
            className={document.id === activeDocumentId ? "document-tab is-active" : "document-tab"}
            type="button"
            onClick={() => onSelectDocument(document.id)}
          >
            <span className="document-tab-label">{document.poseFileName}</span>
          </button>
        ))}
      </div>
    </div>
  );
}