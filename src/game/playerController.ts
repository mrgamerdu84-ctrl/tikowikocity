import * as THREE from "three";

export type PlayerController = {
  root: THREE.Group;
  position: () => [number, number, number];
  setPosition: (value: unknown) => void;
  setEnabled: (enabled: boolean) => void;
  setPaused: (paused: boolean) => void;
  react: () => void;
  setTouch: (x: number, y: number) => void;
  update: (dt: number, camera: THREE.PerspectiveCamera) => void;
  dispose: () => void;
};

export function createPlayerController(scene: THREE.Scene, modelSource: THREE.Object3D): PlayerController {
  const root = new THREE.Group();
  root.name = "TikowikoPlayer";
  const model = modelSource.clone(true);
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  model.scale.setScalar(1.8 / Math.max(size.y, 0.001));
  model.updateMatrixWorld(true);
  model.position.y -= new THREE.Box3().setFromObject(model).min.y;
  model.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (mesh.isMesh) { mesh.castShadow = true; mesh.receiveShadow = true; }
  });
  root.add(model);
  root.position.set(6, 0, -28);
  root.visible = false;
  scene.add(root);

  const keys = new Set<string>();
  const touch = new THREE.Vector2();
  let enabled = false;
  let paused = false;
  let reactionTime = 0;
  const forward = new THREE.Vector3();
  const right = new THREE.Vector3();
  const move = new THREE.Vector3();
  const desiredCamera = new THREE.Vector3();
  const look = new THREE.Vector3();
  const reactionScaleVector = new THREE.Vector3(1, 1, 1);

  const onDown = (event: KeyboardEvent) => { keys.add(event.code); };
  const onUp = (event: KeyboardEvent) => { keys.delete(event.code); };
  window.addEventListener("keydown", onDown);
  window.addEventListener("keyup", onUp);

  return {
    root,
    position: () => [root.position.x, root.position.y, root.position.z],
    setPosition: (value) => {
      if (!Array.isArray(value) || value.length < 3) return;
      const [x, y, z] = value;
      if ([x, y, z].every((n) => typeof n === "number" && Number.isFinite(n))) root.position.set(x, y, z);
    },
    setEnabled: (value) => { enabled = value; root.visible = value; touch.set(0, 0); },
    setPaused: (value) => { paused = value; touch.set(0, 0); },
    react: () => { reactionTime = 0.75; },
    setTouch: (x, y) => touch.set(THREE.MathUtils.clamp(x, -1, 1), THREE.MathUtils.clamp(y, -1, 1)),
    update: (dt, camera) => {
      if (!enabled) return;
      reactionTime = Math.max(0, reactionTime - dt);
      const ahead = paused ? 0 : (keys.has("KeyW") || keys.has("ArrowUp") ? 1 : 0) - (keys.has("KeyS") || keys.has("ArrowDown") ? 1 : 0) - touch.y;
      const strafe = paused ? 0 : (keys.has("KeyD") || keys.has("ArrowRight") ? 1 : 0) - (keys.has("KeyA") || keys.has("ArrowLeft") ? 1 : 0) + touch.x;
      camera.getWorldDirection(forward);
      forward.y = 0;
      if (forward.lengthSq() < 0.001) forward.set(0, 0, -1);
      forward.normalize();
      right.crossVectors(forward, camera.up).normalize();
      move.set(0, 0, 0).addScaledVector(forward, ahead).addScaledVector(right, strafe);
      if (move.lengthSq() > 0.01) {
        move.normalize();
        root.position.addScaledVector(move, 6 * dt);
        root.position.x = THREE.MathUtils.clamp(root.position.x, -82, 82);
        root.position.z = THREE.MathUtils.clamp(root.position.z, -58, 86);
        const yaw = Math.atan2(move.x, move.z);
        root.rotation.y += Math.atan2(Math.sin(yaw - root.rotation.y), Math.cos(yaw - root.rotation.y)) * Math.min(1, dt * 10);
        model.position.y = Math.abs(Math.sin(performance.now() * 0.008)) * 0.06;
      } else model.position.y *= Math.exp(-8 * dt);
      const reactionScale = 1 + Math.sin((reactionTime / 0.75) * Math.PI) * 0.08;
      reactionScaleVector.setScalar(reactionScale);
      root.scale.lerp(reactionScaleVector, 1 - Math.exp(-12 * dt));
      desiredCamera.copy(root.position).addScaledVector(forward, -8).add(new THREE.Vector3(0, 5.5, 0));
      camera.position.lerp(desiredCamera, 1 - Math.exp(-4 * dt));
      look.copy(root.position).add(new THREE.Vector3(0, 1.4, 0));
      camera.lookAt(look);
    },
    dispose: () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      scene.remove(root);
    },
  };
}
