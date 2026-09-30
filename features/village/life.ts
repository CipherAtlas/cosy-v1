import * as T from "three";
import { VillageMovement } from "./movement";
import { BIRD_CLEARING, type Collider } from "./environment";
import { VILLAGERS } from "./villagers";
import { VillageNavigation } from "./navigation";
import { ACTIVITY_STAGES } from "./activityScene";
import type { PlaceId } from "./places";
import { CROP_MODELS, type Crop, type GardenAction } from "./garden";
import { CompanionWalk, relaxBlobArm } from "./companionWalk";
import { RESIDENT_IDS, type AuthoredWorld } from "./worldLayout";

const COMPANION_STAGES: Record<PlaceId, [number, number, number][]> = {
  focus: [[107.6, .1, -.45], [109.8, .1, -.3], [107.3, .1, 1], [109.2, .1, 1.1], [110.6,.1,1.1]],
  music: [[-6.8, .4, -16.1], [-4.8, .4, -16.1], [-5, .4, -21.9], [-6.7, .4, -21.9], [-7.5,.05,-19]],
  breathe: [[-21.9, .24, -5.6], [-20.8, .24, -5.5], [-22.5, .24, -4.9], [-21.2, .24, -4.9], [-20,.1,-5]],
  mood: [[13.9, .4, -10.85], [13.9, .4, -9.15], [16.5, .1, -8.5], [16.5, .1, -11.5], [17,.1,-10]],
  gratitude: [[-18.1, .05, 5.2], [-17, .05, 6.6], [-18.1, .05, 7.8], [-17, .05, 8.1], [-16,.05,7.8]],
  compliment: [[2, .05, .5], [4.1, .05, .5], [2.5, .05, 1.6], [3.8, .05, 1.6], [4.8,.05,1.6]],
  birds: [[-38.5,.1,6.5],[-35.5,.1,6.5],[-39.8,.1,5.9],[-34.2,.1,5.9],[-38,.1,1.5]],
  garden: [[24.4, .05, -7.3], [20, .05, -7.5], [28.3, .05, -7.4], [25, .05, -3], [29,.05,-4]],
};

/** Residents wander safe routes, join activities and tend their village rituals. */
export class VillageLife {
  readonly group = new T.Group();
  readonly companionWalk: CompanionWalk;
  readonly residents: {
    root: T.Object3D; spirit: T.Object3D; fins: T.Object3D[]; phase: number;
    movement: VillageMovement; route: [number, number][]; routePauses?: number[]; waypoint: number; pause: number; walking: boolean; chatting: boolean;
    encounter: {
      state: "roam" | "approach" | "visit" | "return";
      path: [number, number][]; time: number; noticed: boolean; cooldown: number; checkIn: number;
    };
    pace: number;
    following: boolean; companionPath: [number, number][]; replan: number;
    goal: [number, number]; returning: boolean; cup: T.Group; wateringCan?: T.Object3D;
  }[] = [];
  private birdFeedAt = -100;
  private approachScan = 0;
  private navigation: VillageNavigation;
  private activity: PlaceId | null = null;
  private breath = 0;
  private tea = 0;
  private lastTime = 0;
  private gardeningAt = -100;
  private gardening?: GardenAction;
  private giftAt = -100;
  private giftCrop: Crop = "carrot";
  private giftProps = new Map<Crop, T.Object3D>();
  private giftHeart = new T.Group();

  constructor(source: T.Object3D, colliders: Collider[], props?: T.Object3D, authored?: AuthoredWorld) {
    this.navigation = new VillageNavigation(colliders, authored);
    this.companionWalk = new CompanionWalk(colliders);
    const routes: [number, number][][] = [
      // Cottage lane and the entrance meadow.
      [[1.4, 7], [3.8, 10.8], [4.7, 13.5], [3.8, 19], [1.8, 30], [-.7, 28], [-.8, 18], [-.6, 7]],
      // Cross the bridge, visit the pond approach, then return to the cottages.
      [[-5, 3], [-17.8, 3], [-18.3, 0], [-18.3, -4.5], [-17.1, -5.3], [-18, 0], [-17.8, 3],
        [-5, 3], [-1.5, 4], [2.8, 6], [3.8, 10.8], [1.3, 10], [-1.5, 4]],
      // Northern lane and the riverside verge, outside the hearth seating.
      [[-.7, -8], [-.6, -16], [.1, -24], [1, -31], [-1.2, -32], [-2.5, -25],
        [-2.8, -22], [-3.2, -15], [-5, -13], [-5, -8]],
      // Tea garden, central junction and the open garden perimeter.
      [[13.8, -6.8], [12.8, -7.5], [9, -7.8], [6.5, -7.8], [4, -3], [.5, 1],
        [-1.2, -3], [-.8, -9], [4, -10], [8, -10], [12, -14.5], [18, -14.5], [19, -7.5], [17, -5.8]],
      [[-38, 1.5], [-38.8, 1.8], [-37.5, 2], [-36, 1.5]],
    ];
    for (const [index, id] of RESIDENT_IDS.entries()) if (authored?.routes[id]) routes[index] = authored.routes[id]!.points;
    routes.forEach((route, i) => {
      const root = source.clone(true);
      root.name = `${VILLAGERS[i].name.en} spirit`;
      root.position.y = .55;
      const fins: T.Object3D[] = [], materials = new Map<T.Material, T.Material>();
      root.traverse(node => {
        if (node.name.startsWith("SpiritFin")) fins.push(node);
        if (!(node instanceof T.Mesh)) return;
        const tint = (material: T.Material) => {
          if (materials.has(material)) return materials.get(material)!;
          const copy = material.clone();
          if (copy instanceof T.MeshStandardMaterial && material.name === "Pearl white spirit") {
            copy.color.set(VILLAGERS[i].color); copy.emissive.copy(copy.color); copy.emissiveIntensity = .09;
          }
          materials.set(material, copy); return copy;
        };
        node.material = Array.isArray(node.material) ? node.material.map(tint) : tint(node.material);
      });
      this.dressSpirit(root, i);
      const actor = new T.Group(); actor.add(root); actor.scale.setScalar([.96,1.07,.92,1,.96][i]);
      const movement = new VillageMovement(colliders, () => {});
      movement.settle(...route[0]);
      actor.position.set(movement.position.x, movement.position.y, movement.position.z);
      if (i === 4) actor.rotation.y = Math.PI / 4;
      this.group.add(actor);
      actor.name = VILLAGERS[i].name.en;
      const cup = new T.Group(); cup.visible = false; actor.add(cup);
      const porcelain = new T.MeshStandardMaterial({ color: ["#a5dfef", "#ffdab9", "#c8e6a6", "#d6c7fa", "#f4c3d4"][i], roughness: .5 });
      const bowl = new T.Mesh(new T.CylinderGeometry(.105, .08, .14, 16), porcelain); cup.add(bowl);
      const handle = new T.Mesh(new T.TorusGeometry(.054, .012, 6, 12), porcelain); handle.position.x = .11; cup.add(handle);
      const wateringCan = props?.getObjectByName("WateringCan")?.clone(true);
      if (wateringCan) { wateringCan.scale.multiplyScalar(.5); wateringCan.visible = false; actor.add(wateringCan); }
      this.residents.push({ root: actor, spirit: root, fins, phase: i * 1.7, movement, route, routePauses: authored?.routes[RESIDENT_IDS[i]]?.pauses, waypoint: route.length > 1 ? 1 : 0,
        pause: i * 2, walking: false, chatting: false, pace: [.48, .4, .34, .38, .32][i],
        following: false, companionPath: [], replan: 0, goal: [0, 0], returning: false, cup, wateringCan,
        encounter: { state: "roam", path: [], time: 0, noticed: false, cooldown: 0, checkIn: 0 } });
    });
    const luma = this.residents[3].root;
    for (const crop of ["carrot", "radish", "mint", "daisy", "sunflower"] as const) {
      const template = props?.getObjectByName(CROP_MODELS[crop]);
      if (template) { const gift = template.clone(true); gift.visible = false; luma.add(gift); this.giftProps.set(crop, gift); }
    }
    const heart = new T.Shape(); heart.moveTo(0, -.4);
    heart.bezierCurveTo(-.2, -.15, -.5, .02, -.42, .26); heart.bezierCurveTo(-.35, .48, -.1, .44, 0, .25);
    heart.bezierCurveTo(.1, .44, .35, .48, .42, .26); heart.bezierCurveTo(.5, .02, .2, -.15, 0, -.4);
    this.giftHeart.add(new T.Mesh(new T.ShapeGeometry(heart, 12), new T.MeshBasicMaterial({ color: "#f7a6c0", side: T.DoubleSide })));
    this.giftHeart.name = "Luma's thank-you heart"; this.giftHeart.visible = false; this.group.add(this.giftHeart);
  }
  get caretakerPresent() {
    const wren = this.residents[4];
    return !wren.following && !wren.returning && Math.hypot(wren.root.position.x - BIRD_CLEARING.x, wren.root.position.z - BIRD_CLEARING.z) < 4.5;
  }
  get otherBlobAtBirdClearing() {
    return this.residents.some((resident, index) => index !== 4 && resident.root.visible &&
      Math.hypot(resident.root.position.x - BIRD_CLEARING.x, resident.root.position.z - BIRD_CLEARING.z) <= BIRD_CLEARING.feedingPerimeter);
  }
  feedBirds() { this.birdFeedAt = this.lastTime; }

  setCompanions(ids: string[]) {
    this.residents.forEach((r, i) => {
      const following = ids.includes(VILLAGERS[i].id);
      if (r.following === following) return;
      r.following = following; r.replan = 0; r.companionPath = []; r.chatting = false;
      r.encounter.state = "roam"; r.encounter.path = []; r.encounter.cooldown = 15;
      if (!following) {
        // Return to the closest authored route via navigation, including across the bridge.
        const p = r.movement.position;
        r.waypoint = r.route.reduce((best, point, index) => Math.hypot(point[0] - p.x, point[1] - p.z) < Math.hypot(r.route[best][0] - p.x, r.route[best][1] - p.z) ? index : best, 0);
        r.returning = true;
      } else r.returning = false;
    });
  }
  setActivity(place: PlaceId | null, arrival?: [number, number]) {
    this.activity = place;
    this.residents.forEach((r, i) => {
      r.root.visible = place !== "focus" || r.following;
      r.cup.visible = (r.following || i === 3) && place === "mood";
      if (!r.following) return;
      r.chatting = false; r.companionPath = []; r.replan = 0;
      if (arrival) {
        const offsets = [[-1, 1.1], [1, 1.1], [-1, 2.2], [1, 2.2], [0, 3.3]];
        const target: [number, number] = [arrival[0] + offsets[i][0], arrival[1] + offsets[i][1]];
        if (r.movement.clear(...target)) r.movement.settle(...target);
        else r.movement.settle(...arrival);
      }
    });
  }
  setMoment(moment: import("./environment").ActivityMoment) {
    if (moment.kind === "breathe") this.breath = moment.active ? moment.amount : 0;
    if (moment.kind === "tea") this.tea = this.lastTime;
  }
  gardenMoment(action: GardenAction) {
    this.gardening = action; this.gardeningAt = this.lastTime;
    if (action.kind === "gift") { this.giftAt = this.lastTime; this.giftCrop = action.crop; }
  }
  private updateCompanion(r: typeof this.residents[number], index: number, delta: number, time: number, player: T.Vector3, reduced: boolean) {
    if (this.activity && (r.following || index === 3 && this.activity === "mood")) {
      r.root.position.fromArray(COMPANION_STAGES[this.activity][index]);
      const look = this.activity === "mood" ? index === 3 ? ACTIVITY_STAGES.mood.actor : [25, 1, -7] : ACTIVITY_STAGES[this.activity].look;
      r.root.rotation.y = Math.atan2(look[0] - r.root.position.x, look[2] - r.root.position.z);
      r.walking = false; r.movement.pause();
      r.cup.visible = this.activity === "mood";
      r.spirit.position.y = .55 + (reduced ? 0 : Math.sin(time * 1.8 + index) * .025 + (this.activity === "breathe" ? this.breath * .12 : 0));
      const sip = !reduced && time - this.tea < 3.2 ? Math.sin((time - this.tea) / 3.2 * Math.PI) : 0;
      r.cup.position.set(.24, .95 + sip * .25, .35); r.cup.rotation.x = sip * .3;
      r.spirit.rotation.x = this.activity === "focus" || this.activity === "gratitude" ? .07 : 0;
      const tending = this.activity === "garden" && time - this.gardeningAt < 2.5;
      if (r.wateringCan) {
        r.wateringCan.visible = tending && (this.gardening?.kind === "water" || this.gardening?.kind === "flowers");
        r.wateringCan.position.set(.28, .9, .35); r.wateringCan.rotation.z = reduced ? -.3 : -.3 + Math.sin(time * 3 + index) * .1;
      }
      if (tending && !reduced) r.spirit.rotation.x = .09 + Math.sin(time * 3 + index) * .035;
      r.spirit.rotation.z = !reduced && this.activity === "music" ? Math.sin(time * 1.8 + index) * .055 : 0;
      r.fins.forEach(fin => relaxBlobArm(fin, time + index, false, reduced));
      return;
    }
    r.cup.visible = false;
    if (r.wateringCan) r.wateringCan.visible = false;
    const slot = this.residents.filter(resident => resident.following).indexOf(r);
    const target: [number, number] = r.returning ? r.route[r.waypoint]
      : this.companionWalk.avoidPlayer(r.movement.position, this.companionWalk.target(slot));
    const direct = !r.returning && Math.hypot(target[0] - r.movement.position.x, target[1] - r.movement.position.z) < 2.5 && r.movement.canWalkTo(...target);
    r.replan -= delta;
    if (direct) { r.goal = target; r.companionPath = [target]; }
    else if (r.replan <= 0 && (Math.hypot(target[0] - r.goal[0], target[1] - r.goal[1]) > .25 || !r.companionPath.length)) {
      r.goal = target; r.replan = r.returning ? 1 + index * .11 : .35;
      r.companionPath = this.navigation.path([r.movement.position.x, r.movement.position.z], target);
    }
    let waypoint = r.companionPath[0];
    if (!direct && waypoint && Math.hypot(waypoint[0] - r.movement.position.x, waypoint[1] - r.movement.position.z) < .18) { r.companionPath.shift(); waypoint = r.companionPath[0]; }
    const dx = waypoint ? waypoint[0] - r.movement.position.x : 0, dz = waypoint ? waypoint[1] - r.movement.position.z : 0, length = Math.hypot(dx, dz);
    const moving = length > .12 && (r.following || !r.chatting || r.root.position.distanceTo(player) > 4);
    const distance = r.root.position.distanceTo(player), pace = r.returning ? .55 : Math.min(1, Math.max(.45, length / 1.4));
    if (direct) {
      // Match the player's velocity while closing the formation error, so hands stay together.
      const velocity = this.companionWalk.velocity.clone().add(new T.Vector2(dx, dz).multiplyScalar(4)).clampLength(0, 6);
      r.movement.update(delta, { x: velocity.x / 6, z: velocity.y / 6, run: false, sprint: true, blocked: false });
    } else r.movement.update(delta, { x: moving ? dx / length * pace : 0, z: moving ? dz / length * pace : 0, run: !r.returning && distance > 3, sprint: !r.returning && distance > 5, blocked: false });
    r.root.position.set(r.movement.position.x, r.movement.position.y, r.movement.position.z);
    if (moving && r.movement.speed < .03) { r.companionPath = []; r.replan = Math.min(r.replan, .2); }
    if (moving || direct) {
      const angle = direct && length < .5 ? this.companionWalk.heading : Math.atan2(dx, dz);
      const turn = T.MathUtils.euclideanModulo(angle - r.root.rotation.y + Math.PI, Math.PI * 2) - Math.PI;
      r.root.rotation.y += turn * (1 - Math.exp(-delta * 10));
    }
    r.walking = r.movement.speed > .1;
    r.spirit.position.y = .55 + (reduced ? 0 : Math.sin(time * 2.5 + r.phase) * .065);
    r.spirit.rotation.x = reduced ? 0 : r.movement.speed * .025;
    r.spirit.rotation.z = reduced ? 0 : Math.sin(time * 1.6 + r.phase) * .035;
    r.fins.forEach(fin => relaxBlobArm(fin, time + r.phase, r.walking, reduced));
    if (r.returning && Math.hypot(target[0] - r.root.position.x, target[1] - r.root.position.z) < .4) { r.returning = false; r.pause = 2; }
  }
  update(delta: number, elapsed: number, player: T.Vector3, reduced: boolean, canApproach = true, cameraRotation?: T.Quaternion, playerHeading?: number) {
    this.lastTime = elapsed;
    if (!this.activity) this.companionWalk.update(delta, player, this.residents.filter(r => r.following).length, playerHeading);
    this.approachScan -= delta;
    if (canApproach && this.approachScan <= 0) {
      this.approachScan = .4;
      if (!this.residents.some(r => r.encounter.state === "approach" || r.encounter.state === "visit" || r.chatting)) {
        const nearby = this.residents.filter(r => r !== this.residents[4] && !r.following && !r.returning && r.encounter.state === "roam" && !r.encounter.noticed
          && r.encounter.cooldown === 0 && r.root.position.distanceTo(player) < 6)
          .sort((a, b) => a.root.position.distanceToSquared(player) - b.root.position.distanceToSquared(player));
        const r = nearby.find(r => r.movement.canWalkTo(player.x, player.z));
        if (r) {
          r.encounter.state = "approach";
          r.encounter.noticed = true;
          r.encounter.time = 0;
          r.encounter.checkIn = .4;
          r.encounter.path = [[r.movement.position.x, r.movement.position.z]];
        }
      }
    }
    for (const r of this.residents) {
      if (r.following || r.returning || this.activity === "mood" && r === this.residents[3]) { this.updateCompanion(r, this.residents.indexOf(r), delta, elapsed, player, reduced); continue; }
      const encounter = r.encounter;
      const distance = Math.hypot(player.x - r.movement.position.x, player.z - r.movement.position.z);
      encounter.cooldown = Math.max(0, encounter.cooldown - delta);
      if (distance > 9) encounter.noticed = false;
      encounter.time += delta;
      if (encounter.state === "approach" || encounter.state === "visit") {
        encounter.checkIn -= delta;
        const origin = encounter.path[0];
        const tooFar = Math.hypot(player.x - origin[0], player.z - origin[1]) > 8;
        const obstructed = encounter.state === "approach" && encounter.checkIn <= 0 && !r.movement.canWalkTo(player.x, player.z);
        if (encounter.checkIn <= 0) encounter.checkIn = .4;
        if (!canApproach || tooFar || obstructed || (encounter.state === "approach" && encounter.time > 10)
          || (encounter.state === "visit" && (distance > 4.5 || (encounter.time > 8 && !r.chatting)))) {
          encounter.state = "return";
          encounter.cooldown = 15;
          r.chatting = false;
        } else if (encounter.state === "approach" && (distance <= 2.2 || r.chatting)) {
          encounter.state = "visit";
          encounter.time = 0;
        }
      }
      if (encounter.state === "return") {
        const last = encounter.path.at(-1);
        if (last && Math.hypot(last[0] - r.movement.position.x, last[1] - r.movement.position.z) < .2) encounter.path.pop();
        if (!encounter.path.length) { encounter.state = "roam"; r.pause = 2; }
      }
      if (encounter.state === "roam") r.pause = Math.max(0, r.pause - delta);
      const target = encounter.state === "approach" ? [player.x, player.z]
        : encounter.state === "return" ? encounter.path.at(-1)! : r.route[r.waypoint];
      const dx = target[0] - r.movement.position.x, dz = target[1] - r.movement.position.z;
      const length = Math.hypot(dx, dz);
      if (encounter.state === "roam" && length < .3 && r.route.length > 1) {
        // Rest twice per circuit; intermediate waypoints guide turns without repeated stops.
        r.pause = r.routePauses?.[r.waypoint] ?? (r.waypoint === 0 || r.waypoint === Math.floor(r.route.length / 2) ? 4.5 : 0);
        r.waypoint = (r.waypoint + 1) % r.route.length;
      }
      const moving = !r.chatting && distance > 1.2 && (encounter.state === "approach" || (encounter.state === "return" && length >= .2)
        || (encounter.state === "roam" && r.route.length > 1 && r.pause === 0 && length > .3));
      const pace = encounter.state === "approach" ? r.pace : .43;
      r.movement.update(delta, { x: moving ? dx / length * pace : 0, z: moving ? dz / length * pace : 0, run: false, sprint: false, blocked: false });
      r.root.position.set(r.movement.position.x, r.movement.position.y, r.movement.position.z);
      if (encounter.state === "approach") {
        const last = encounter.path.at(-1)!;
        if (Math.hypot(r.root.position.x - last[0], r.root.position.z - last[1]) >= .4)
          encounter.path.push([r.root.position.x, r.root.position.z]);
      }
      if (moving || r.chatting || encounter.state === "visit") {
        const angle = r.chatting || encounter.state === "visit" ? Math.atan2(player.x - r.root.position.x, player.z - r.root.position.z) : Math.atan2(dx, dz);
        const turn = T.MathUtils.euclideanModulo(angle - r.root.rotation.y + Math.PI, Math.PI * 2) - Math.PI;
        r.root.rotation.y += turn * (1 - Math.exp(-delta * 4));
      }
      const walking = r.movement.speed > .1;
      r.walking = walking;
      r.spirit.position.y = .55 + (reduced ? 0 : Math.sin(elapsed * 2.5 + r.phase) * .065);
      r.spirit.rotation.x = reduced ? 0 : r.movement.speed * .035;
      r.spirit.rotation.z = reduced ? 0 : Math.sin(elapsed * 1.6 + r.phase) * .035;
      r.fins.forEach(fin => relaxBlobArm(fin, elapsed + r.phase, walking, reduced));

    }
    const age = elapsed - this.giftAt, thanking = this.activity === "mood" && age < 4.8;
    const luma = this.residents[3];
    this.giftProps.forEach((gift, crop) => {
      gift.visible = thanking && crop === this.giftCrop;
      gift.position.set(.15, 1 + (reduced ? 0 : Math.sin(Math.min(1, age / 4.8) * Math.PI) * .28), .45);
      gift.scale.setScalar(.42); gift.rotation.y = reduced ? 0 : age * .65;
    });
    this.giftHeart.visible = thanking;
    if (thanking) {
      const joy = reduced ? 0 : Math.sin(Math.min(1, age / 4.8) * Math.PI);
      luma.spirit.position.y += Math.abs(Math.sin(age * 5)) * joy * .12;
      luma.spirit.rotation.z = Math.sin(age * 5) * joy * .09;
      luma.fins.forEach((fin, i) => { fin.rotation.z = reduced ? 0 : Math.sin(age * 9 + i * Math.PI) * joy * .4; });
      this.giftHeart.position.copy(luma.root.position).y += 2 + (reduced ? 0 : age * .08);
      this.giftHeart.scale.setScalar(reduced ? .42 : Math.min(1, age * 5, (4.8 - age) * 3) * .52);
      if (cameraRotation) this.giftHeart.quaternion.copy(cameraRotation);
    }
    const wren = this.residents[4], feeding = elapsed - this.birdFeedAt;
    if (this.caretakerPresent && feeding < 2.5) {
      wren.root.rotation.y = Math.atan2(BIRD_CLEARING.x - wren.root.position.x, BIRD_CLEARING.z - wren.root.position.z);
      wren.spirit.rotation.x = reduced ? .1 : Math.sin(feeding / 2.5 * Math.PI) * .2;
      wren.fins.forEach((fin, i) => { fin.rotation.z = reduced ? 0 : Math.sin(feeding * 5 + i) * .5; });
      wren.pause = Math.max(wren.pause, .1);
    }
  }

  private dressSpirit(root: T.Object3D, index: number) {
    const cream = new T.MeshStandardMaterial({ color: "#fff2d1", roughness: .75 });
    const gold = new T.MeshStandardMaterial({ color: "#ffd36f", roughness: .55 });
    const accent = new T.MeshStandardMaterial({ color: ["#318c9b", "#de8e9b", "#6f9d52", "#7772b5", "#6c9290"][index], roughness: .8 });
    const sphere = new T.SphereGeometry(1, 16, 10);
    const add = (geometry: T.BufferGeometry, material: T.Material, x: number, y: number, z: number, sx=1, sy=1, sz=1) => {
      const mesh = new T.Mesh(geometry, material); mesh.position.set(x,y,z); mesh.scale.set(sx,sy,sz);
      mesh.castShadow = mesh.receiveShadow = true; root.add(mesh); return mesh;
    };
    const star = new T.Shape();
    for (let i=0;i<10;i++) { const a=i*Math.PI/5+Math.PI/2, r=i%2?.042:.09; if(i===0)star.moveTo(Math.cos(a)*r,Math.sin(a)*r);else star.lineTo(Math.cos(a)*r,Math.sin(a)*r); }
    star.closePath();
    const starGeometry = new T.ExtrudeGeometry(star,{depth:.025,bevelEnabled:false});
    if (index === 0) {
      add(new T.TorusGeometry(.33,.055,8,32),accent,0,.27,0).rotation.x=Math.PI/2;
      add(sphere,accent,.22,.25,.275,.1,.16,.06);
      add(starGeometry,gold,.22,.26,.335);
      add(sphere,cream,-.27,.29,.26,.08,.08,.04);
    } else if (index === 1) {
      add(new T.CylinderGeometry(.22,.23,.09,24),accent,0,1.005,0);
      for (let i=0;i<4;i++) add(sphere,cream,Math.cos(i*Math.PI/2)*.125,1.13,Math.sin(i*Math.PI/2)*.09,.16,.125,.14);
      add(sphere,accent,-.16,.29,.29,.1,.055,.035).rotation.z=-.25;
      add(sphere,accent,.02,.29,.31,.1,.055,.035).rotation.z=.25;
      add(sphere,gold,-.065,.29,.335,.04,.04,.025);
    } else if (index === 2) {
      add(new T.CylinderGeometry(.018,.025,.19,8),accent,.06,1.07,0).rotation.z=-.2;
      for(const side of [-1,1]) add(sphere,accent,.06+side*.105,1.15,.02,.15,.045,.075).rotation.z=side*.4;
      add(sphere,cream,.17,.3,.3,.105,.11,.045);
      add(starGeometry,gold,.17,.31,.35).scale.setScalar(.55);
    } else if (index === 4) {
      add(new T.TorusGeometry(.3,.045,8,24),accent,0,.28,0).rotation.x=Math.PI/2;
      add(sphere,accent,-.28,.15,.27,.14,.18,.08);
      add(sphere,gold,-.28,.2,.35,.065,.035,.025);
      for(let i=0;i<5;i++) { const a=i*Math.PI*2/5; add(sphere,cream,.2+Math.cos(a)*.067,.91+Math.sin(a)*.067,.2,.055,.055,.025); }
      add(sphere,gold,.2,.91,.235,.033,.033,.02);
    } else {
      const crescent = new T.Shape();
      crescent.absarc(0,0,.15,Math.PI*.32,Math.PI*1.68,false);
      crescent.absarc(.082,0,.133,-Math.PI*.56,Math.PI*.56,true);crescent.closePath();
      add(new T.ExtrudeGeometry(crescent,{depth:.025,bevelEnabled:false}),gold,0,1.06,.05).rotation.z=-.35;
      add(new T.TorusGeometry(.33,.047,8,32),accent,0,.27,0).rotation.x=Math.PI/2;
      add(starGeometry,gold,0,.3,.345);
    }
  }
  dispose() { this.residents.forEach(r => r.chatting = false); }
}
