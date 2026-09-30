import layout from "../public/village/world-layout.json";
import physics from "./world-physics.json";
import { projectWorldLayout, type ResidentId } from "../features/village/worldLayout";
import { BIRD_CLEARING, floorHeight, setAuthoredWorld } from "../features/village/environment";
import { VillageMovement } from "../features/village/movement";
import { VillageNavigation } from "../features/village/navigation";
import { CompanionWalk } from "../features/village/companionWalk";
import { Vector3 } from "three";
import type { PlaceId } from "../features/village/places";
import { VILLAGERS } from "../features/village/villagers";
import type { GardenAction } from "../features/village/garden";
import { ACTIVITY_STAGES, COMPANION_STAGES, PUPPY_PATROLS, PUPPY_TRICK_SECONDS, RESIDENT_ROUTES,
  type SharedActor, type SharedActors, type SharedBirds, type SharedInteraction } from "../features/village/sharedActors";

type Visitor = { id: string; x: number; y?: number; z: number; heading: number; active?: boolean; lastSeen?: number;
  activity?: PlaceId | null; activityPosition?: [number, number, number] | null; bench?: { id: string; index: 0 | 1 } | null; swing?: { id: string; index: 0 | 1 } | null; holdingPuppy?: string | null };
type Actor = { state: SharedActor; movement: VillageMovement; route: [number, number][]; waypoint: number;
  pause: number; path: [number, number][]; goal: [number, number] | null; nextPath: number;
  followOwner: string | null; hold: boolean; cooldown: number; chat: number; petOrigin: [number, number] | null; height: number; activity: PlaceId | null };

/** The Worker advances one world; browsers only render its accepted poses and actions. */
export class VillageSimulation {
  readonly authored = projectWorldLayout(layout);
  readonly actors: Actor[] = [];
  readonly benches = physics.benches;
  private navigation: VillageNavigation;
  private lastTime = 0;
  private epoch = 0;
  pondFeedAt: number | null = null;
  gift: SharedActors["gift"] = null;
  private trails = new Map<string, [number, number][]>();
  private companionWalks = new Map<string, CompanionWalk>();
  birds: SharedBirds = { phase: "flight", since: 0, mealAt: null, queued: false, served: false, throwAt: null, origin: [0, 0, 0], flightCount: 0 };

  constructor(saved?: ReturnType<VillageSimulation["save"]>) {
    setAuthoredWorld(this.authored);
    this.navigation = new VillageNavigation(physics.colliders, this.authored);
    const add = (id: string, kind: SharedActor["kind"], route: [number, number][], heading: number, height = 0) => {
      const movement = new VillageMovement(physics.colliders, () => {});
      movement.settle(...route[0]);
      this.actors.push({ state: { id, kind, ...movement.position, y: movement.position.y + height, heading,
        speed: 0, owner: null, following: false, mode: "roam", action: null, startedAt: 0, until: 0, speech: null },
        movement, route, waypoint: route.length > 1 ? 1 : 0, pause: this.actors.length * .6 + 2,
        path: [], goal: null, nextPath: 0, followOwner: null, hold: false, cooldown: 0, chat: 0, petOrigin: null, height, activity: null });
    };
    for (const placement of this.authored.puppies) {
      const route = PUPPY_PATROLS[placement.breed].map(([dx, dz]): [number, number] => [
        placement.x + dx * Math.cos(placement.yaw) + dz * Math.sin(placement.yaw),
        placement.z - dx * Math.sin(placement.yaw) + dz * Math.cos(placement.yaw)]);
      const probe = new VillageMovement(physics.colliders, () => {});
      const clear = route.filter(point => probe.clear(...point));
      add(placement.id, "puppy", clear.length ? clear : [[placement.x, placement.z]], placement.yaw, placement.y - floorHeight(placement.x, placement.z));
    }
    VILLAGERS.forEach((profile, index) => add(profile.id, "resident", this.authored.routes[profile.id as ResidentId]?.points ?? RESIDENT_ROUTES[index], index === 4 ? Math.PI / 4 : 0));
    if (saved) {
      this.lastTime = saved.time;
      this.epoch = saved.epoch ?? 0; this.pondFeedAt = saved.pondFeedAt ?? null; this.gift = saved.gift ?? null;
      this.birds = saved.birds;
      for (const record of saved.actors) {
        const actor = this.actors.find(value => value.state.id === record.state.id && value.state.kind === record.state.kind);
        if (!actor) continue;
        const { outdoorPosition, ...restored } = record;
        Object.assign(actor, restored);
        actor.movement.settle(outdoorPosition?.x ?? actor.state.x, outdoorPosition?.z ?? actor.state.z);
      }
      this.trails = new Map(saved.trails);
    }
  }

  save() {
    return { time: this.lastTime, epoch: this.epoch, pondFeedAt: this.pondFeedAt, gift: this.gift, birds: this.birds,
      trails: [...this.trails.entries()].filter(([id]) => this.actors.some(actor => actor.followOwner === id)),
      actors: this.actors.map(({ movement, route: _route, ...record }) => ({ ...record, outdoorPosition: { ...movement.position } })) };
  }
  snapshot(now: number): SharedActors { return { time: now, epoch: this.epoch, pondFeedAt: this.pondFeedAt, gift: this.gift, actors: this.actors.map(actor => ({ ...actor.state, activity: actor.activity })), birds: { ...this.birds } }; }
  actor(id: string, kind: SharedActor["kind"]) { return this.actors.find(actor => actor.state.id === id && actor.state.kind === kind); }
  visitTea(visitor: Visitor, now: number) {
    const luma = this.actor("luma", "resident")!;
    if (luma.state.owner && luma.state.owner !== visitor.id) return;
    luma.state.owner = visitor.id; luma.state.mode = "activity"; luma.state.until = 0;
    luma.state.action = null; luma.state.speech = null; luma.state.gesture = undefined; luma.state.startedAt = now; luma.activity = "mood";
  }
  gardenMoment(visitor: Visitor, action: GardenAction, now: number) {
    const kind = action.kind === "drink" ? "tea" : ["water", "flowers"].includes(action.kind) ? "water" : null;
    if (!kind) return;
    for (const actor of this.actors) if (actor.state.kind === "resident" && actor.state.owner === visitor.id
      && actor.state.mode === "activity" && actor.activity === (kind === "tea" ? "mood" : "garden"))
      actor.state.gesture = { kind, at: now };
  }
  private visitorPoint(visitor: Visitor): [number, number] {
    if (visitor.bench) {
      const bench = this.benches.find(bench => bench.id === visitor.bench!.id);
      if (bench) { const offset = visitor.bench.index === 0 ? -.68 : .68;
        return [bench.x + Math.cos(bench.facing) * offset, bench.z - Math.sin(bench.facing) * offset]; }
    }
    const stage = visitor.activity && (visitor.activityPosition ?? ACTIVITY_STAGES[visitor.activity].actor);
    return stage ? [stage[0], stage[2]] : [visitor.x, visitor.z];
  }
  activityPosition(visitor: Visitor, id: PlaceId, visitors: Visitor[]): [number, number, number] | null {
    const [x, , z] = ACTIVITY_STAGES[id].actor;
    const probe = this.actors[0].movement;
    for (const [dx, dz] of [[0, 0], [-1.7, 0], [1.7, 0], [0, -1.7], [0, 1.7], [-1.7, -1.7], [1.7, -1.7], [-1.7, 1.7], [1.7, 1.7]]) {
      const point: [number, number] = [x + dx, z + dz];
      if (probe.clear(...point) && !visitors.some(other => other.id !== visitor.id && other.activity !== "focus"
        && Math.hypot(this.visitorPoint(other)[0] - point[0], this.visitorPoint(other)[1] - point[1]) < 1.4)
        && !this.actors.some(actor => Math.hypot(actor.state.x - point[0], actor.state.z - point[1]) < 1.2))
        return [point[0], floorHeight(...point) + .05, point[1]];
    }
    return null;
  }
  private stageCompanion(actor: Actor, visitor: Visitor, visitors: Visitor[]) {
    const place = visitor.activity!;
    if (actor.state.mode === "activity" && actor.activity === place) return;
    actor.activity = place;
    actor.state.gesture = undefined;
    const index = VILLAGERS.findIndex(profile => profile.id === actor.state.id);
    let point = COMPANION_STAGES[place][index];
    if (place !== "focus") {
      const [x, z] = this.visitorPoint(visitor);
      const choices: [number, number, number][] = [point];
      for (const radius of [1.8, 2.8, 3.8]) for (let slot = 0; slot < 8; slot++) {
        const angle = (slot + index) * Math.PI / 4;
        const px = x + Math.sin(angle) * radius, pz = z + Math.cos(angle) * radius;
        choices.push([px, floorHeight(px, pz), pz]);
      }
      point = choices.find(([px, , pz]) => actor.movement.clear(px, pz)
        && !visitors.some(other => other.activity !== "focus" && Math.hypot(this.visitorPoint(other)[0] - px, this.visitorPoint(other)[1] - pz) < 1.3)
        && !this.actors.some(other => other !== actor && Math.hypot(other.state.x - px, other.state.z - pz) < 1.2))
        ?? [actor.state.x, actor.state.y, actor.state.z];
    }
    const [x, y, z] = point;
    Object.assign(actor.state, { x, y, z, speed: 0, mode: "activity", heading: ACTIVITY_STAGES[place].yaw });
  }
  private available(visitor: Visitor) { return visitor.active !== false && !visitor.activity && !visitor.bench && !visitor.swing; }
  private gap(actor: Actor, visitor: Visitor) { return Math.hypot(actor.state.x - visitor.x, actor.state.z - visitor.z); }
  private release(actor: Actor, now: number) {
    if (actor.state.mode === "activity") {
      if (actor.activity === "focus") Object.assign(actor.state, actor.movement.position);
      else actor.movement.settle(actor.state.x, actor.state.z);
    }
    actor.state.owner = actor.followOwner;
    actor.state.following = !!actor.followOwner;
    actor.state.mode = actor.followOwner ? "follow" : "return";
    actor.state.action = null; actor.state.speech = null; actor.state.gesture = undefined; actor.state.until = 0;
    actor.hold = false; actor.petOrigin = null; actor.path = []; actor.goal = null; actor.activity = null;
    actor.cooldown = now + 15000;
    if (!actor.followOwner) actor.waypoint = actor.route.reduce((best, point, index) =>
      Math.hypot(point[0] - actor.state.x, point[1] - actor.state.z) < Math.hypot(actor.route[best][0] - actor.state.x, actor.route[best][1] - actor.state.z) ? index : best, 0);
  }
  releaseVisitor(id: string, now: number) {
    this.trails.delete(id);
    this.companionWalks.delete(id);
    for (const actor of this.actors) if (actor.state.owner === id || actor.followOwner === id) {
      actor.followOwner = null; this.release(actor, now);
    }
  }
  interact(visitor: Visitor, request: Extract<SharedInteraction, { kind: "puppy" | "resident" }>, now: number) {
    const actor = this.actor(request.id, request.kind);
    if (!actor) return { ok: false, reason: "That resident is no longer here." };
    if (actor.state.owner && actor.state.owner !== visitor.id) return { ok: false, reason: "They are spending time with another visitor." };
    if (request.action === "release" || request.action === "home") {
      if (actor.state.owner !== visitor.id) return { ok: false, reason: "They are already at home." };
      if (request.action === "release" && ["pet", "petApproach", "trick"].includes(actor.state.mode)) {
        actor.hold = false;
        actor.state.until = actor.state.startedAt + (actor.state.action ? PUPPY_TRICK_SECONDS[actor.state.action] * 1000 : actor.state.mode === "petApproach" ? 5000 : 3000);
        return { ok: true };
      }
      if (request.action === "home") actor.followOwner = null;
      this.release(actor, now); return { ok: true };
    }
    if (!this.available(visitor) || this.gap(actor, visitor) > (request.kind === "puppy" ? 2.8 : 4.5))
      return { ok: false, reason: "Come a little closer first." };
    actor.movement.position = { x: actor.state.x, y: floorHeight(actor.state.x, actor.state.z), z: actor.state.z };
    if (!actor.movement.canWalkTo(visitor.x, visitor.z)) return { ok: false, reason: "Come around to the same side." };
    if (request.action === "walk") {
      actor.followOwner = visitor.id; actor.state.following = true;
      actor.hold = false; actor.state.action = null; actor.state.speech = null;
      actor.state.mode = "follow"; actor.state.until = 0;
    } else if (request.kind === "puppy" && request.action === "hold") {
      actor.hold = true;
      if (!["trick", "pet", "petApproach"].includes(actor.state.mode)) actor.state.mode = "hold";
      actor.state.until = Math.max(actor.state.until, now + 3000);
    } else if (request.kind === "puppy" && request.action === "pet") {
      if (this.actors.some(other => other.state.owner === visitor.id && ["pet", "petApproach"].includes(other.state.mode)))
        return { ok: false, reason: "Finish petting your dog first." };
      const dx = actor.state.x - visitor.x, dz = actor.state.z - visitor.z, gap = Math.hypot(dx, dz) || 1;
      const target: [number, number] = [visitor.x + dx / gap * 1.14, visitor.z + dz / gap * 1.14];
      if (!actor.movement.clear(...target)) return { ok: false, reason: "Make a little room for your dog." };
      actor.petOrigin = [visitor.x, visitor.z]; actor.goal = target;
      actor.state.mode = "petApproach"; actor.state.action = null; actor.state.until = now + 5000;
    } else if (request.kind === "puppy" && Object.hasOwn(PUPPY_TRICK_SECONDS, request.action)) {
      actor.state.mode = "trick"; actor.state.action = request.action as keyof typeof PUPPY_TRICK_SECONDS;
      actor.state.until = now + PUPPY_TRICK_SECONDS[actor.state.action] * 1000;
    } else if (request.kind === "resident" && request.action === "talk") {
      const profile = VILLAGERS.find(value => value.id === actor.state.id)!;
      actor.state.mode = "talk"; actor.state.speech = profile.chat[actor.chat++ % profile.chat.length];
      actor.state.until = now + 6000;
    } else return { ok: false, reason: "That action is unavailable." };
    actor.state.owner = visitor.id; actor.state.startedAt = now; actor.state.speed = 0;
    actor.state.heading = Math.atan2(visitor.x - actor.state.x, visitor.z - actor.state.z);
    actor.path = []; actor.nextPath = 0;
    return { ok: true };
  }

  feedBirds(visitor: Visitor, now: number) {
    if (this.birds.queued || this.birds.served || visitor.activity === "focus"
      || Math.hypot(visitor.x - BIRD_CLEARING.x, visitor.z - BIRD_CLEARING.z) > BIRD_CLEARING.feedingPerimeter) return false;
    this.birds.queued = true; this.birds.throwAt = now; this.birds.origin = [visitor.x, (visitor.y ?? floorHeight(visitor.x, visitor.z)) + 1.05, visitor.z];
    if (this.birds.phase === "ground") { this.birds.queued = false; this.birds.served = true; this.birds.mealAt = now; }
    return true;
  }
  private trailing(visitor: Visitor, distance: number): [number, number] {
    const trail = this.trails.get(visitor.id)!;
    for (let index = trail.length - 1; index > 0; index--) {
      const end = trail[index], start = trail[index - 1], length = Math.hypot(end[0] - start[0], end[1] - start[1]);
      if (distance <= length) return [end[0] + (start[0] - end[0]) * distance / length, end[1] + (start[1] - end[1]) * distance / length];
      distance -= length;
    }
    return trail[0];
  }
  private walk(actor: Actor, target: [number, number], speed: number, delta: number, now: number, visitors: Visitor[], velocity?: [number, number]) {
    const movement = actor.movement;
    if (velocity) actor.path = [target];
    else if (now >= actor.nextPath && (!actor.goal || Math.hypot(target[0] - actor.goal[0], target[1] - actor.goal[1]) > .3 || !actor.path.length)) {
      actor.path = this.navigation.path([actor.state.x, actor.state.z], target); actor.goal = target; actor.nextPath = now + 550;
    }
    while (!velocity && actor.path.length && Math.hypot(actor.path[0][0] - movement.position.x, actor.path[0][1] - movement.position.z) < .16) actor.path.shift();
    const next = actor.path[0];
    if (!next) { actor.state.speed = 0; movement.pause(); return; }
    let dx = next[0] - movement.position.x, dz = next[1] - movement.position.z;
    const gap = Math.hypot(dx, dz);
    for (const other of [...this.actors.filter(other => other !== actor).map(other => other.state),
      ...visitors.filter(visitor => visitor.activity !== "focus" && !(["petApproach", "approach"].includes(actor.state.mode) && visitor.id === actor.state.owner))]) {
      const ox = movement.position.x - other.x, oz = movement.position.z - other.z, distance = Math.hypot(ox, oz);
      if (distance > .001 && distance < .8) { dx += ox / distance * (.8 - distance) * 2; dz += oz / distance * (.8 - distance) * 2; }
    }
    if (velocity) { dx = velocity[0] + dx * 4; dz = velocity[1] + dz * 4; }
    const length = Math.hypot(dx, dz) || 1, throttle = velocity ? Math.min(speed, length) : Math.min(speed, gap * 3);
    for (let remaining = delta; remaining > .00001; remaining -= .05) movement.update(Math.min(.05, remaining),
      { x: dx / length * throttle / 6, z: dz / length * throttle / 6, run: false, sprint: true, blocked: false });
    actor.state.heading = Math.atan2(dx, dz); actor.state.speed = movement.speed;
    actor.state.x = movement.position.x; actor.state.y = movement.position.y + actor.height; actor.state.z = movement.position.z;
    if (movement.speed < .02) { actor.path = []; actor.nextPath = now + 300; }
  }
  step(now: number, visitors: Visitor[]) {
    const delta = this.lastTime ? Math.min(.25, Math.max(0, (now - this.lastTime) / 1000)) : 0;
    this.lastTime = now;
    if (!this.epoch) this.epoch = now;
    if (!this.birds.since) this.birds.since = now;
    const present = new Map(visitors.map(visitor => [visitor.id, visitor]));
    for (const [id] of this.trails) if (!present.has(id)) this.trails.delete(id);
    for (const [id] of this.companionWalks) if (!present.has(id)) this.companionWalks.delete(id);
    for (const visitor of visitors) {
      let walk = this.companionWalks.get(visitor.id);
      if (!walk) { walk = new CompanionWalk(physics.colliders); this.companionWalks.set(visitor.id, walk); }
      walk.update(delta, new Vector3(visitor.x, floorHeight(visitor.x, visitor.z), visitor.z),
        this.actors.filter(actor => actor.state.kind === "resident" && actor.followOwner === visitor.id).length, visitor.heading);
      const trail = this.trails.get(visitor.id);
      if (!trail || Math.hypot(visitor.x - trail.at(-1)![0], visitor.z - trail.at(-1)![1]) > 5) {
        this.trails.set(visitor.id, [[visitor.x - Math.sin(visitor.heading) * 10, visitor.z - Math.cos(visitor.heading) * 10], [visitor.x, visitor.z]]);
      } else if (Math.hypot(visitor.x - trail.at(-1)![0], visitor.z - trail.at(-1)![1]) > .12) {
        trail.push([visitor.x, visitor.z]); if (trail.length > 180) trail.shift();
      }
    }
    for (const actor of this.actors) {
      let owner = actor.state.owner ? present.get(actor.state.owner) : undefined;
      if (actor.state.owner && (!owner || now - (owner.lastSeen ?? now) > 10000)) {
        actor.followOwner = null; this.release(actor, now); owner = undefined;
      }
      if (actor.hold && owner) {
        if (this.available(owner) && owner.holdingPuppy === actor.state.id && this.gap(actor, owner) < 3) actor.state.until = Math.max(actor.state.until, now + 3000);
        else { actor.hold = false; if (actor.state.mode === "hold") this.release(actor, now); }
      }
      if (actor.state.mode === "activity" && !actor.followOwner) {
        if (owner?.activity === "mood" && actor.state.id === "luma") {
          const [x, y, z] = COMPANION_STAGES.mood[3]; Object.assign(actor.state, { x, y, z, speed: 0, heading: -Math.PI / 2 }); continue;
        }
        this.release(actor, now);
      }
      if (owner && !actor.followOwner && (owner.active === false || owner.activity || owner.bench || owner.swing || this.gap(actor, owner) > (actor.state.kind === "puppy" ? 3.5 : 6))) this.release(actor, now);
      if (owner && actor.petOrigin && (Math.hypot(owner.x - actor.petOrigin[0], owner.z - actor.petOrigin[1]) > .6
        || owner.active === false || owner.activity || owner.bench || owner.swing)) this.release(actor, now);
      if (actor.state.until && now >= actor.state.until && !actor.hold) this.release(actor, now);
      if (["hold", "pet", "trick", "talk", "visit"].includes(actor.state.mode)) {
        actor.state.speed = 0;
        if (owner) actor.state.heading = Math.atan2(owner.x - actor.state.x, owner.z - actor.state.z);
        if (actor.hold && !["trick", "pet"].includes(actor.state.mode)) actor.state.mode = "hold";
        if (actor.hold && ["trick", "pet"].includes(actor.state.mode) && now - actor.state.startedAt >= (actor.state.action ? PUPPY_TRICK_SECONDS[actor.state.action] * 1000 : 3000)) {
          actor.state.mode = "hold"; actor.state.action = null;
        }
        continue;
      }
      if (actor.state.mode === "petApproach" && owner && actor.petOrigin) {
        const dx = actor.state.x - actor.petOrigin[0], dz = actor.state.z - actor.petOrigin[1], gap = Math.hypot(dx, dz) || 1;
        const target = actor.goal ?? [actor.petOrigin[0] + dx / gap * 1.14, actor.petOrigin[1] + dz / gap * 1.14] as [number, number];
        if (Math.hypot(actor.state.x - target[0], actor.state.z - target[1]) < .14) {
          actor.state.mode = "pet"; actor.state.startedAt = now; actor.state.until = now + 3000; actor.state.speed = 0;
        } else this.walk(actor, target, 1.15, delta, now, visitors);
        continue;
      }
      if (actor.followOwner) {
        const visitor = present.get(actor.followOwner);
        if (!visitor) { actor.followOwner = null; this.release(actor, now); continue; }
        actor.state.owner = visitor.id; actor.state.following = true;
        if (visitor.activity && actor.state.kind === "resident") {
          this.stageCompanion(actor, visitor, visitors);
          continue;
        }
        if (actor.state.mode === "activity") {
          const wasPrivate = actor.activity === "focus";
          actor.movement.settle(wasPrivate ? actor.movement.position.x : actor.state.x, wasPrivate ? actor.movement.position.z : actor.state.z);
          Object.assign(actor.state, actor.movement.position); actor.path = []; actor.goal = null; actor.activity = null;
        }
        actor.state.mode = "follow";
        if (visitor.active === false || visitor.activity || visitor.bench || visitor.swing) { actor.state.speed = 0; continue; }
        const followers = this.actors.filter(other => other.followOwner === visitor.id && other.state.kind === actor.state.kind);
        const slot = followers.indexOf(actor), distance = 1.55 + Math.floor(slot / 2) * 1.35;
        const point = this.trailing(visitor, distance), side = (slot % 2 ? 1 : -1) * .8;
        let target: [number, number] = [point[0] + Math.cos(visitor.heading) * side, point[1] - Math.sin(visitor.heading) * side];
        actor.movement.position = { x: actor.state.x, y: floorHeight(actor.state.x, actor.state.z), z: actor.state.z };
        if (!actor.movement.clear(...target)) target = this.trailing(visitor, 1.55 + slot * 1.15);
        const companionWalk = actor.state.kind === "resident" ? this.companionWalks.get(visitor.id)! : null;
        if (companionWalk) target = companionWalk.avoidPlayer(actor.state, companionWalk.target(slot));
        const waiting = this.actors.some(other => other.state.owner === visitor.id && ["pet", "petApproach"].includes(other.state.mode));
        const error = Math.hypot(target[0] - actor.state.x, target[1] - actor.state.z);
        const direct = companionWalk && error < 2.5 && actor.movement.canWalkTo(...target);
        if (!waiting && (direct || error > .2)) this.walk(actor, target, direct ? 6 : this.gap(actor, visitor) > 5 ? 5.8 : 3.8, delta, now, visitors,
          direct ? [companionWalk.velocity.x, companionWalk.velocity.y] : undefined);
        else actor.state.speed = 0;
        if (companionWalk && error < .5) actor.state.heading = visitor.heading;
        else if (!actor.state.speed) actor.state.heading = Math.atan2(visitor.x - actor.state.x, visitor.z - actor.state.z);
        continue;
      }
      if (actor.state.kind === "resident" && actor.state.id !== "wren" && actor.state.mode === "roam" && now >= actor.cooldown) {
        const visitor = visitors.filter(visitor => this.available(visitor) && this.gap(actor, visitor) < 6
          && !this.actors.some(other => other.state.kind === "resident" && other.state.owner === visitor.id))
          .sort((a, b) => this.gap(actor, a) - this.gap(actor, b)).find(visitor => actor.movement.canWalkTo(visitor.x, visitor.z));
        if (visitor) { actor.state.mode = "approach"; actor.state.owner = visitor.id; actor.state.until = now + 10000; owner = visitor; }
      }
      if (actor.state.mode === "approach" && owner) {
        if (this.gap(actor, owner) <= 2.2) { actor.state.mode = "visit"; actor.state.until = now + 8000;
          actor.state.speech = VILLAGERS.find(profile => profile.id === actor.state.id)!.greeting; actor.state.startedAt = now; actor.state.speed = 0; }
        else this.walk(actor, [owner.x, owner.z], 1.15, delta, now, visitors);
        continue;
      }
      actor.pause = Math.max(0, actor.pause - delta);
      const target = actor.route[actor.waypoint];
      if (Math.hypot(target[0] - actor.state.x, target[1] - actor.state.z) < .35) {
        actor.state.mode = "roam"; actor.state.owner = null; actor.state.following = false;
        actor.pause = actor.state.kind === "puppy" ? 2.3 : this.authored.routes[actor.state.id as ResidentId]?.pauses?.[actor.waypoint] ?? (actor.waypoint === 0 ? 4.5 : 0);
        actor.waypoint = (actor.waypoint + 1) % actor.route.length; actor.path = []; actor.goal = null;
      }
      if (!actor.pause && actor.route.length > 1) this.walk(actor, target, 1.25, delta, now, visitors);
      else actor.state.speed = 0;
    }
    const birds = this.birds;
    if (birds.phase === "flight" && now - birds.since >= 30000) { birds.phase = "ground"; birds.since = now; }
    if (birds.phase === "ground" && !birds.served) {
      const wren = this.actor("wren", "resident")!;
      const visitorNearby = visitors.some(visitor => visitor.activity !== "focus" && Math.hypot(visitor.x - BIRD_CLEARING.x, visitor.z - BIRD_CLEARING.z) <= BIRD_CLEARING.feedingPerimeter);
      const residentNearby = this.actors.some(actor => actor.state.kind === "resident" && actor.state.id !== "wren" && Math.hypot(actor.state.x - BIRD_CLEARING.x, actor.state.z - BIRD_CLEARING.z) <= BIRD_CLEARING.feedingPerimeter);
      if (birds.queued || !wren.state.following && Math.hypot(wren.state.x - BIRD_CLEARING.x, wren.state.z - BIRD_CLEARING.z) < 4.5 && !visitorNearby && !residentNearby && now - birds.since >= 2500) {
        birds.queued = false; birds.served = true; birds.mealAt = now;
      }
    }
    if (birds.phase === "ground" && (birds.served ? now - (birds.mealAt ?? now) >= 10000 : now - birds.since >= 18000))
      Object.assign(birds, { phase: "flight", since: now, mealAt: null, served: false, flightCount: (birds.flightCount ?? 0) + 1 });
  }
}
