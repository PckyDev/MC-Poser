import { getPoseBones } from "../../config/pose";
import type { AvatarType, PoseBoneId, PoseSelection, PoseState } from "../../types/editor";

type LeftSidebarProps = {
  avatarType: AvatarType;
  selectedSelection: PoseSelection;
  onSelectBone: (boneId: PoseBoneId) => void;
  onSelectJoint: (jointKey: keyof PoseState) => void;
};

export function LeftSidebar({
  avatarType,
  selectedSelection,
  onSelectBone,
  onSelectJoint,
}: LeftSidebarProps) {
  const visibleBones = getPoseBones(avatarType);

  return (
    <aside className="editor-sidebar editor-sidebar--left">
      <section className="editor-panel editor-panel--stretch">
        <div className="panel-heading">
          <div>
            <h2>Bones</h2>
          </div>
        </div>

        <div className="panel-content panel-content--scroll panel-content--stacked">
          <div className="bone-tree">
            {visibleBones.map((bone) => (
              <div key={bone.id} className="bone-tree-group">
                <button
                  className={
                    selectedSelection.kind === "bone" && selectedSelection.id === bone.id
                      ? "bone-tree-button is-active"
                      : "bone-tree-button"
                  }
                  type="button"
                  onClick={() => onSelectBone(bone.id)}
                >
                  {bone.label}
                </button>

                <div className="bone-tree-children">
                  {bone.fields.map((field) => (
                    <button
                      key={field.key}
                      className={
                        selectedSelection.kind === "joint" && selectedSelection.id === field.key
                          ? "bone-tree-joint-button is-active"
                          : "bone-tree-joint-button"
                      }
                      type="button"
                      onClick={() => onSelectJoint(field.key)}
                    >
                      {field.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </aside>
  );
}
