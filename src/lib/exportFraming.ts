import { Box3, Mesh, Vector3, type Object3D, type PerspectiveCamera } from "three";

/** Fit rendered surfaces, not hidden original limbs or the corners of a world
 * axis-aligned box. The latter adds large empty margins to angled poses. */
export function fitVisibleAvatar(root: Object3D, camera: PerspectiveCamera) {
  root.updateWorldMatrix(true, true);
  const inverse = camera.quaternion.clone().invert();
  const bounds = new Box3();
  const point = new Vector3();
  const visitPoints = (visit: (point: Vector3) => void) => root.traverseVisible(object => {
    if (!(object instanceof Mesh)) return;
    const position = object.geometry.getAttribute("position");
    if (!position) return;
    for (let i = 0; i < position.count; i++) {
      point.fromBufferAttribute(position, i).applyMatrix4(object.matrixWorld).applyQuaternion(inverse);
      visit(point);
    }
  });
  visitPoints(point => bounds.expandByPoint(point));
  if (bounds.isEmpty()) return null;
  const center = bounds.getCenter(new Vector3());
  const vertical = Math.tan(camera.fov * Math.PI / 360) / camera.zoom;
  const horizontal = vertical * camera.aspect;
  let distance = 1;
  visitPoints(point => {
    point.sub(center);
    distance = Math.max(distance, point.z + Math.abs(point.x) / horizontal, point.z + Math.abs(point.y) / vertical);
  });
  return { center: center.applyQuaternion(camera.quaternion), distance: distance * 1.08 };
}
