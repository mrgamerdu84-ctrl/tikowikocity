import * as THREE from "three";
import type { CityPlan } from "./cityPlan";
import { DIR_VEC, TILE, parseKey } from "./grid";

export type PedestrianSystem = {
  update: (dt: number, elapsed: number, population: number, traffic: THREE.Object3D[]) => void;
  refresh: () => void;
  dispose: () => void;
};

type Agent = {
  root: THREE.Group;
  route: THREE.Vector3[];
  waypoint: number;
  speed: number;
  phase: number;
  wait: number;
};

const SIDE = TILE * 0.43;
const MAX_DESKTOP = 18;
const MAX_MOBILE = 10;

export function createPedestrianSystem(scene: THREE.Scene, plan: CityPlan, templates: THREE.Object3D[]): PedestrianSystem {
  const group = new THREE.Group();
  group.name = "TikowikoPedestrians";
  scene.add(group);
  const agents: Agent[] = [];
  let destinations: THREE.Vector3[] = [];

  const nearestRoad = (cx: number, cz: number) => {
    for (let d = 0; d < 4; d++) {
      const [dx, dz] = DIR_VEC[d]!;
      if (plan.has(cx + dx, cz + dz)) return { cx: cx + dx, cz: cz + dz, dx, dz };
    }
    return null;
  };

  const sidewalkPoint = (cx: number, cz: number, dx = 1, dz = 0) =>
    new THREE.Vector3(cx * TILE - dz * SIDE, 0, cz * TILE + dx * SIDE);

  const refresh = () => {
    const next: THREE.Vector3[] = [];
    plan.houses.forEach((_house, k) => {
      const [cx, cz] = parseKey(k);
      const road = nearestRoad(cx, cz);
      if (road) next.push(sidewalkPoint(road.cx, road.cz, road.dx, road.dz));
    });
    plan.decor.forEach((_decor, k) => {
      const [cx, cz] = parseKey(k);
      const road = nearestRoad(cx, cz);
      if (road) next.push(sidewalkPoint(road.cx, road.cz, road.dx, road.dz));
    });
    plan.cells.forEach((_cell, k) => {
      if (next.length > 40) return;
      const [cx, cz] = parseKey(k);
      next.push(sidewalkPoint(cx, cz, (cx + cz) % 2 === 0 ? 1 : -1, 0));
    });
    next.push(new THREE.Vector3(-9, 0, -34), new THREE.Vector3(9, 0, -34));
    destinations = next;
  };

  const routeFor = (from: THREE.Vector3) => {
    if (destinations.length < 2) return [from.clone()];
    const nearby = destinations.filter((point) => {
      const distance = point.distanceTo(from);
      return distance > 1 && distance < TILE * 1.75;
    });
    const target = (nearby.length ? nearby : destinations)[Math.floor(Math.random() * (nearby.length || destinations.length))]!.clone();
    return [from.clone(), target];
  };

  const spawn = () => {
    if (!templates.length || !destinations.length) return;
    const start = destinations[Math.floor(Math.random() * destinations.length)]!.clone();
    const model = templates[agents.length % templates.length]!.clone(true);
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    model.scale.setScalar(1.65 / Math.max(size.y, 0.001));
    model.updateMatrixWorld(true);
    const grounded = new THREE.Box3().setFromObject(model);
    model.position.y -= grounded.min.y;
    model.traverse((node) => {
      const mesh = node as THREE.Mesh;
      if (mesh.isMesh) { mesh.castShadow = true; mesh.receiveShadow = true; }
    });
    const root = new THREE.Group();
    root.add(model);
    root.position.copy(start);
    group.add(root);
    agents.push({ root, route: routeFor(start), waypoint: 1, speed: 1.2 + Math.random() * 0.65, phase: Math.random() * 10, wait: 0 });
  };

  const update = (dt: number, elapsed: number, population: number, traffic: THREE.Object3D[]) => {
    const mobile = window.innerWidth < 700;
    const wanted = Math.min(mobile ? MAX_MOBILE : MAX_DESKTOP, Math.max(0, Math.ceil(population / 2)));
    while (agents.length < wanted) spawn();
    while (agents.length > wanted) {
      const agent = agents.pop();
      if (agent) group.remove(agent.root);
    }
    agents.forEach((agent, index) => {
      if (agent.wait > 0) { agent.wait -= dt; return; }
      const target = agent.route[agent.waypoint];
      if (!target) {
        agent.route = routeFor(agent.root.position);
        agent.waypoint = 1;
        agent.wait = 1 + Math.random() * 3;
        return;
      }
      const dx = target.x - agent.root.position.x;
      const dz = target.z - agent.root.position.z;
      const distance = Math.hypot(dx, dz);
      const nearTraffic = traffic.some((car) => car.position.distanceToSquared(agent.root.position) < 10);
      if (nearTraffic) return;
      if (distance < 0.22) { agent.waypoint += 1; return; }
      const step = Math.min(distance, agent.speed * dt);
      agent.root.position.x += (dx / distance) * step;
      agent.root.position.z += (dz / distance) * step;
      const yaw = Math.atan2(dx, dz);
      agent.root.rotation.y += Math.atan2(Math.sin(yaw - agent.root.rotation.y), Math.cos(yaw - agent.root.rotation.y)) * Math.min(1, dt * 8);
      const model = agent.root.children[0];
      if (model) model.position.y = Math.abs(Math.sin(elapsed * 6 + agent.phase + index)) * 0.045;
    });
  };

  refresh();
  return {
    update,
    refresh,
    dispose: () => { group.clear(); scene.remove(group); },
  };
}
