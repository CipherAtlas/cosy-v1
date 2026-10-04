import * as T from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { animateAnimalRig, disposeAnimalRig, hasAnimalRig, makeAnimalRig } from "./animalRig";

export type HorseCoat = "bay" | "grey";
type HorseRig = { body: T.Group; neck: T.Group; tail: T.Group; ears: T.Group[]; legs: { upper: T.Group; lower: T.Group; rear: boolean }[]; distance: number; phase: number };
const rigs = new WeakMap<T.Group, HorseRig>();
const nativeRigs = new WeakMap<T.Group, { distance: number; phase: number; tack: T.Mesh[]; neck: T.Object3D; head: T.Object3D; neckPose: T.Quaternion; headPose: T.Quaternion; feeding: boolean }>();
export const HORSE_SADDLE_HEIGHT = 1.64;

function makeNativeHorse(coat: HorseCoat): T.Group {
  const model = makeAnimalRig(coat === "grey" ? "horse-grey" : "horse-bay");
  const body = model.getObjectByName("Body"), neck = model.getObjectByName("Neck"), head = model.getObjectByName("Head"), seat = model.getObjectByName("HorseSeat");
  if (!body || !neck || !head || !seat) throw Error(`The ${coat} horse rig needs its body, neck, head and saddle attachment.`);
  const leather = new T.MeshStandardMaterial({ color: "#503c33", roughness: .76 });
  const blanket = new T.MeshStandardMaterial({ color: coat === "grey" ? "#567d78" : "#5b727e", roughness: .96 });
  const brass = new T.MeshStandardMaterial({ color: "#bb9b5a", metalness: .5, roughness: .4 });
  const tack: T.Mesh[] = [];
  const oval = (position: number[], scale: number[]) => {
    const geometry = new T.SphereGeometry(1, 12, 8);
    geometry.applyMatrix4(new T.Matrix4().compose(new T.Vector3(...position), new T.Quaternion(), new T.Vector3(...scale)));
    return geometry;
  };
  const curve = (points: number[][], radius: number) => new T.TubeGeometry(
    new T.CatmullRomCurve3(points.map(point => new T.Vector3(...point))), 10, radius, 5, false);
  const attach = (parent: T.Object3D, material: T.Material, parts: T.BufferGeometry[]) => {
    const mesh = new T.Mesh(mergeGeometries(parts, false)!, material);
    parts.forEach(part => part.dispose()); mesh.name = "Horse riding tack"; mesh.castShadow = true; mesh.receiveShadow = true;
    model.add(mesh); model.updateMatrixWorld(true); parent.attach(mesh); tack.push(mesh);
  };
  attach(body, blanket, [oval([0, 1.59, -.08], [.425, .1, .47]),
    ...[-1, 1].map(side => oval([side * .36, 1.39, -.08], [.055, .22, .39]))]);
  attach(body, leather, [oval([0, 1.68, -.08], [.29, .095, .34]), oval([0, 1.73, -.36], [.29, .13, .09]),
    oval([0, 1.72, .23], [.24, .12, .07]), ...[-1, 1].map(side => curve([[side * .38, 1.5, .03], [side * .4, .9, .03]], .022))]);
  attach(body, brass, [-1, 1].map(side => curve([[side * .4, .97, .03], [side * .46, .84, .03],
    [side * .34, .84, .03], [side * .4, .97, .03]], .016)));
  attach(head, leather, [curve([[-.145, 1.83, 1.58], [0, 1.87, 1.69], [.145, 1.83, 1.58]], .016),
    ...[-1, 1].map(side => curve([[side * .15, 2.2, 1.02], [side * .16, 2.08, 1.17], [side * .145, 1.83, 1.58]], .013))]);
  nativeRigs.set(model, { distance: 0, phase: 0, tack, neck, head, neckPose: neck.quaternion.clone(), headPose: head.quaternion.clone(), feeding: false });
  return model;
}

/** Loaded native skins serve gameplay; unpreloaded source previews retain the kit fallback. */
export function makeHorseModel(coat: HorseCoat = "bay"): T.Group {
  if (hasAnimalRig(coat === "grey" ? "horse-grey" : "horse-bay")) return makeNativeHorse(coat);
  const grey = coat === "grey", root = new T.Group(), body = new T.Group();
  root.name = `Horse-${coat}`; root.add(body);
  const materials = {
    coat: new T.MeshStandardMaterial({ color: grey ? "#a9b4b7" : "#915339", roughness: .82 }),
    light: new T.MeshStandardMaterial({ color: grey ? "#ced6d2" : "#b8784e", roughness: .85 }),
    dark: new T.MeshStandardMaterial({ color: grey ? "#596167" : "#392a27", roughness: .92 }),
    hair: new T.MeshStandardMaterial({ color: grey ? "#e0e1d9" : "#272322", roughness: .96 }),
    cream: new T.MeshStandardMaterial({ color: "#e7ddc2", roughness: .94 }),
    leather: new T.MeshStandardMaterial({ color: "#503c33", roughness: .76 }),
    blanket: new T.MeshStandardMaterial({ color: grey ? "#567d78" : "#5b727e", roughness: .96 }),
    brass: new T.MeshStandardMaterial({ color: "#bb9b5a", metalness: .5, roughness: .4 }),
    eye: new T.MeshStandardMaterial({ color: "#171a19", roughness: .18 }),
  };
  type Material = keyof typeof materials;
  const batches = new Map<T.Group, Map<Material, T.BufferGeometry[]>>();
  function shape(parent: T.Group, material: Material, geometry: T.BufferGeometry, position: number[], scale = [1, 1, 1], rotation = [0, 0, 0]) {
    geometry.applyMatrix4(new T.Matrix4().compose(new T.Vector3(...position), new T.Quaternion().setFromEuler(new T.Euler(...rotation)), new T.Vector3(...scale)));
    let parts = batches.get(parent); if (!parts) batches.set(parent, parts = new Map());
    const list = parts.get(material) ?? []; list.push(geometry); parts.set(material, list);
  }
  const oval = (parent: T.Group, material: Material, position: number[], scale: number[], rotation?: number[]) =>
    shape(parent, material, new T.SphereGeometry(1, 14, 10), position, scale, rotation);
  const rod = (parent: T.Group, material: Material, from: number[], to: number[], radius: number, endRadius = radius) => {
    const a = new T.Vector3(...from), b = new T.Vector3(...to), direction = b.clone().sub(a);
    const geometry = new T.CylinderGeometry(endRadius, radius, direction.length(), 8);
    geometry.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), direction.normalize()));
    shape(parent, material, geometry, a.add(b).multiplyScalar(.5).toArray());
  };
  function curve(parent: T.Group, material: Material, points: number[][], radius: number) {
    shape(parent, material, new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p => new T.Vector3(...p))), 12, radius, 5, false), [0, 0, 0]);
  }
  oval(body, "coat", [0, 1.25, -.08], [.39, .39, .87]);
  oval(body, "coat", [0, 1.27, -.68], [.4, .4, .42]);
  oval(body, "coat", [0, 1.29, .52], [.36, .42, .39]);
  oval(body, "light", [0, 1.03, .09], [.32, .22, .6]);
  // Withers and an arched neck give the horse its silhouette above the saddle.
  oval(body, "coat", [0, 1.57, .54], [.24, .21, .3]);
  const neck = new T.Group(); neck.position.set(0, 1.43, .59); body.add(neck);
  oval(neck, "coat", [0, .31, .12], [.26, .57, .29], [.32, 0, 0]);
  oval(neck, "light", [0, .36, .3], [.19, .43, .17], [.32, 0, 0]);
  const head = new T.Group(); head.position.set(0, .77, .34); head.rotation.x = -.52; neck.add(head);
  oval(head, "coat", [0, -.13, .13], [.22, .35, .23]);
  oval(head, "coat", [0, -.39, .25], [.16, .3, .16], [-.2, 0, 0]);
  oval(head, "dark", [0, -.6, .3], [.17, .12, .17]);
  oval(head, "cream", [0, -.25, .321], [.044, .3, .018], [-.12, 0, 0]);
  const ears: T.Group[] = [];
  for (const side of [-1, 1]) {
    oval(head, "dark", [side * .145, -.575, .367], [.034, .03, .02]);
    oval(head, "dark", [side * .196, -.1, .186], [.041, .047, .048]);
    oval(head, "eye", [side * .219, -.089, .2], [.022, .025, .027]);
    oval(head, "cream", [side * .23, -.08, .215], [.006, .007, .007]);
    const ear = new T.Group(); ear.position.set(side * .135, .105, .04); ear.rotation.z = -side * .16; head.add(ear); ears.push(ear);
    oval(ear, "coat", [0, .115, 0], [.061, .18, .075], [-.15, 0, 0]);
    oval(ear, "dark", [0, .12, .055], [.03, .114, .022], [-.15, 0, 0]);
    curve(head, "leather", [[side * .205, -.02, .14], [side * .205, -.25, .21], [side * .17, -.51, .33]], .014);
    oval(head, "brass", [side * .181, -.47, .3], [.025, .032, .025]);
  }
  curve(head, "leather", [[-.16, -.49, .33], [0, -.505, .447], [.16, -.49, .33]], .018);
  curve(head, "leather", [[-.19, .02, .15], [0, .075, -.105], [.19, .02, .15]], .016);
  // Overlapping tapered locks remain opaque and cast clean, inexpensive shadows.
  for (let i = 0; i < 10; i++) {
    const t = i / 9;
    oval(neck, "hair", [.045 + .055 * Math.sin(t * 2), .85 - t * .95, .08 - t * .34], [.11, .17, .11], [-.4, 0, -.22]);
  }
  oval(head, "hair", [.025, .045, .205], [.125, .18, .075], [0, 0, -.27]);
  oval(body, "blanket", [0, 1.56, -.05], [.425, .15, .47]);
  for (const side of [-1, 1]) {
    oval(body, "blanket", [side * .365, 1.37, -.06], [.075, .25, .4]);
    curve(body, "cream", [[side * .408, 1.39, -.4], [side * .433, 1.19, -.37], [side * .433, 1.17, .25]], .012);
    oval(body, "leather", [side * .29, 1.48, -.08], [.095, .26, .24]);
    rod(body, "leather", [side * .38, 1.47, .03], [side * .4, .91, .03], .023);
    curve(body, "brass", [[side * .4, .97, .03], [side * .46, .84, .03], [side * .34, .84, .03], [side * .4, .97, .03]], .016);
    curve(body, "leather", [[side * .17, 1.91, 1.16], [side * .27, 1.55, .71], [side * .24, 1.69, .2]], .012);
  }
  oval(body, "leather", [0, 1.68, -.08], [.29, .095, .34]);
  oval(body, "leather", [0, 1.73, -.36], [.29, .13, .09]);
  oval(body, "leather", [0, 1.72, .23], [.24, .12, .07]);
  const seat = new T.Object3D(); seat.name = "HorseSeat"; seat.position.set(0, HORSE_SADDLE_HEIGHT, -.08); body.add(seat);
  const legs: HorseRig["legs"] = [];
  for (const rear of [false, true]) for (const side of [-1, 1]) {
    const upper = new T.Group(), lower = new T.Group(); upper.position.set(side * .265, 1.19, rear ? -.66 : .57); body.add(upper);
    oval(upper, "coat", [0, -.17, rear ? .05 : -.015], [rear ? .16 : .12, .31, rear ? .23 : .15], [rear ? -.25 : .07, 0, 0]);
    rod(upper, "coat", [0, -.2, 0], [0, -.6, 0], .09, .061);
    lower.position.set(0, -.6, 0); upper.add(lower);
    oval(lower, "dark", [0, -.014, 0], [.068, .087, .073]);
    rod(lower, "dark", [0, -.045, 0], [0, -.42, .045], .052, .04);
    if (grey || rear || side === -1) rod(lower, "cream", [0, -.32, .035], [0, -.49, .06], .054, .065);
    oval(lower, "dark", [0, -.52, .088], [.084, .071, .118]);
    legs.push({ upper, lower, rear });
  }
  const tail = new T.Group(); tail.position.set(0, 1.47, -.96); tail.rotation.x = -.17; body.add(tail);
  for (let i = 0; i < 6; i++) {
    const side = (i - 2.5) * .037;
    curve(tail, "hair", [[side * .3, 0, 0], [side, -.23, -.19], [side * 1.4, -.61, -.22], [side * 1.8, -.96 + Math.abs(side), -.1]], .055);
  }
  for (const [parent, parts] of batches) for (const [material, geometries] of parts) {
    const geometry = mergeGeometries(geometries, false)!;
    geometries.forEach(part => part.dispose());
    const mesh = new T.Mesh(geometry, materials[material]); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh);
  }
  rigs.set(root, { body, neck, tail, ears, legs, distance: 0, phase: 0 });
  return root;
}

export function animateHorseModel(model: T.Group, time: number, speed: number, distance: number, reducedMotion = false, feeding = false, feedingAge = time) {
  const native = nativeRigs.get(model);
  if (native) {
    // Remove last frame's additive meal pose before sampling the authored clip.
    if (native.feeding) {
      native.neck.quaternion.copy(native.neckPose); native.head.quaternion.copy(native.headPose);
    }
    native.phase += Math.max(0, distance - native.distance) / horseStrideLength(speed); native.distance = distance;
    const action = feeding || Math.abs(speed) < .05 ? "idle" : Math.abs(speed) < 3.2 ? "walk" : Math.abs(speed) < 5.7 ? "trot" : "canter";
    animateAnimalRig(model, { action, time: feeding ? feedingAge : time, reduced: reducedMotion,
      phase: !feeding && Math.abs(speed) >= .05 ? native.phase % 1 : undefined });
    native.feeding = feeding;
    if (feeding) {
      native.neckPose.copy(native.neck.quaternion); native.headPose.copy(native.head.quaternion);
      const lower = reducedMotion ? 1 : T.MathUtils.smoothstep(feedingAge, 0, .85);
      const chew = reducedMotion ? 0 : Math.sin(feedingAge * 13) * .035 * lower;
      native.neck.rotateX(.72 * lower + chew * .25);
      native.head.rotateX(.28 * lower + chew);
      native.head.rotateY(reducedMotion ? 0 : Math.sin(feedingAge * 6.5) * .018 * lower);
    }
    return;
  }
  const rig = rigs.get(model); if (!rig) return;
  const moving = T.MathUtils.smoothstep(Math.abs(speed), .05, .7), canter = T.MathUtils.smoothstep(Math.abs(speed), 4.6, 6.4);
  const stride = horseStrideLength(speed);
  rig.phase += Math.max(0, distance - rig.distance) / stride * Math.PI * 2; rig.distance = distance;
  const phase = rig.phase;
  const gait = Math.abs(speed) < 3.2 ? [0, Math.PI, Math.PI * 1.5, Math.PI * .5] : [0, Math.PI, Math.PI, 0];
  const bounce = Math.sin(phase * 2) * .012 * moving + Math.sin(phase) * .018 * canter;
  rig.body.position.y = -.065 * moving + (reducedMotion ? 0 : bounce);
  rig.body.rotation.x = reducedMotion ? 0 : Math.sin(phase) * .035 * canter;
  rig.neck.rotation.x = feeding ? .72 * (reducedMotion ? 1 : T.MathUtils.smoothstep(feedingAge, 0, .85)) + (reducedMotion ? 0 : Math.sin(feedingAge * 13) * .025)
    : reducedMotion ? 0 : Math.sin(time * .65) * .015 * (1 - moving) + Math.sin(phase) * .04 * moving;
  rig.tail.rotation.z = reducedMotion ? 0 : Math.sin(time * 1.3) * .12 + Math.sin(phase) * .06 * moving;
  rig.tail.rotation.x = -.17 - moving * .22;
  rig.ears.forEach((ear, i) => { ear.rotation.x = reducedMotion ? 0 : Math.sin(time * .7 + i * 1.7) * .07; });
  rig.legs.forEach(({ upper, lower, rear }, i) => {
    const cycle = phase + gait[i] + canter * (rear ? .55 : -.22);
    // Solve each hoof path as a two-bone chain so stance feet reach the ground.
    const footZ = .088 + Math.sin(cycle) * (.2 + Math.min(Math.abs(speed), 7) * .015) * moving;
    const footY = .071 - 1.19 - rig.body.position.y + Math.max(0, Math.cos(cycle)) * (.14 + canter * .07) * moving;
    const upperLength = .6, lowerLength = Math.hypot(.52, .088);
    const reach = Math.min(upperLength + lowerLength - .0001, Math.hypot(footY, footZ));
    const knee = Math.acos(T.MathUtils.clamp((reach ** 2 - upperLength ** 2 - lowerLength ** 2) / (2 * upperLength * lowerLength), -1, 1)) * (rear ? -1 : 1);
    upper.rotation.x = Math.atan2(-footZ, -footY) - Math.atan2(lowerLength * Math.sin(knee), upperLength + lowerLength * Math.cos(knee));
    lower.rotation.x = knee + Math.atan2(.088, .52);
  });
}

export function horseStrideLength(speed: number) { return Math.abs(speed) < 3.2 ? 1.8 : Math.abs(speed) < 5.7 ? 2.9 : 3.8; }

export function disposeHorseModel(model: T.Group) {
  const native = nativeRigs.get(model);
  if (native) {
    disposeAnimalRig(model);
    const materials = new Set<T.Material>();
    native.tack.forEach(mesh => { mesh.geometry.dispose(); materials.add(mesh.material as T.Material); });
    materials.forEach(material => material.dispose()); nativeRigs.delete(model); return;
  }
  const materials = new Set<T.Material>();
  model.traverse(node => { if (node instanceof T.Mesh) { node.geometry.dispose(); (Array.isArray(node.material) ? node.material : [node.material]).forEach(material => materials.add(material)); } });
  materials.forEach(material => material.dispose()); rigs.delete(model);
}
