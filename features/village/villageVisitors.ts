import * as T from "three";
import { clone as cloneSkeleton } from "three/addons/utils/SkeletonUtils.js";
import { relaxBlobArm } from "./companionWalk";
import { SWING_MAX_ANGLE, type VillageSwingSet } from "./swings";
import type { SharedChatEntry, SharedVisitor, SharedSwingRide } from "./sharedWorld";
import type { PlaceId } from "./places";
import type { World } from "./world";

const spiritGlowColor = new T.Color("#ffd58e");
export function tintSpirit(spirit: T.Object3D, color: string, copyMaterials: boolean) {
    spirit.traverse(object => {
      if (!(object instanceof T.Mesh)) return;
      const materials = (Array.isArray(object.material) ? object.material : [object.material]).map(material => {
        const result = copyMaterials ? material.clone() : material;
        if (result instanceof T.MeshStandardMaterial && result.name === "Pearl white spirit") {
          result.color.set(color);
          result.userData.dayColor = result.color.getHex();
        }
        return result;
      });
      if (copyMaterials) object.material = Array.isArray(object.material) ? materials : materials[0];
    });
  }
export function glowSpirit(spirit: T.Object3D, night: number) {
    spirit.traverse(object => {
      if (!(object instanceof T.Mesh)) return;
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        if (!(material instanceof T.MeshStandardMaterial) || material.name !== "Pearl white spirit") continue;
        if (material.userData.dayEmissive === undefined) {
          material.userData.dayColor = material.color.getHex();
          material.userData.dayEmissive = material.emissive.getHex();
          material.userData.dayEmissiveIntensity = material.emissiveIntensity;
        }
        material.color.setHex(material.userData.dayColor).lerp(spiritGlowColor, night * .72);
        material.emissive.setHex(material.userData.dayEmissive).lerp(spiritGlowColor, night);
        material.emissiveIntensity = material.userData.dayEmissiveIntensity + night * .65;
      }
    });
  }

export class VillageVisitors {
  readonly entries = new Map<string, { name: string; slot: number; group: T.Group; spirit: T.Object3D; fins: T.Object3D[]; target: T.Vector3; heading: number; label: HTMLDivElement; swing: SharedSwingRide | null; swingReceivedAt: number; bench: { id: string; index: number } | null; activity: PlaceId | null; lookout: number | null }>();
  private chatBubbles = new Map<string, { element: HTMLDivElement; timer: number; messageId?: string }>();
  private visitorLabelPoint = new T.Vector3();
  private temp = new T.Vector3();
  constructor(private scene: T.Scene, private host: HTMLElement) {}
  showChatBubble(entry: SharedChatEntry, selfId: string, selfName: string) {
    const id = entry.id ?? (entry.name === selfName ? selfId : [...this.entries].find(([, remote]) => remote.name === entry.name)?.[0]);
    if (!id || (id !== selfId && !this.entries.has(id))) return;
    const previous = this.chatBubbles.get(id);
    if (previous) { clearTimeout(previous.timer); previous.element.remove(); }
    const element = document.createElement("div");
    element.className = "v-visitor-chat";
    element.textContent = entry.message;
    this.host.append(element);
    const timer = window.setTimeout(() => {
      element.remove();
      this.chatBubbles.delete(id);
    }, 6000);
    this.chatBubbles.set(id, { element, timer, messageId: entry.messageId });
  }
  removeChatBubbles(messageIds: string[]) {
    const removed = new Set(messageIds);
    for (const [id, bubble] of this.chatBubbles) {
      if (!bubble.messageId || !removed.has(bubble.messageId)) continue;
      clearTimeout(bubble.timer);
      bubble.element.remove();
      this.chatBubbles.delete(id);
    }
  }
  sync(visitors: SharedVisitor[], character: T.Object3D | undefined, world: World | undefined, elapsed: number,
    night: number, focus: boolean, inferredHeight: (visitor: SharedVisitor) => number) {
    if (!character) return;
    const active = new Set(visitors.map(visitor => visitor.id));
    for (const [id, remote] of this.entries) if (!active.has(id)) {
      remote.group.traverse(object => {
        if (object instanceof T.SkinnedMesh) object.skeleton.dispose();
        if (object instanceof T.Mesh) for (const material of Array.isArray(object.material) ? object.material : [object.material]) material.dispose();
      });
      remote.label.remove();
      const bubble = this.chatBubbles.get(id);
      if (bubble) { clearTimeout(bubble.timer); bubble.element.remove(); this.chatBubbles.delete(id); }
      remote.group.removeFromParent(); this.entries.delete(id);
    }
    for (const visitor of visitors) {
      const height = visitor.y !== undefined && Number.isFinite(visitor.y) ? visitor.y
        : inferredHeight(visitor);
      let remote = this.entries.get(visitor.id);
      if (!remote) {
        const group = new T.Group(), spirit = cloneSkeleton(character);
        spirit.position.set(0, .62, 0); spirit.rotation.set(0, 0, 0);
        tintSpirit(spirit, visitor.color, true);
        glowSpirit(spirit, night);
        const label = document.createElement("div");
        label.className = "v-visitor-name";
        label.textContent = visitor.name;
        label.style.setProperty("--visitor-color", visitor.color);
        this.host.append(label);
        group.add(spirit);
        const fins: T.Object3D[] = [];
        spirit.traverse(node => { if (node.name.startsWith("SpiritFin")) fins.push(node); });
        group.position.set(visitor.x, height, visitor.z);
        group.rotation.y = visitor.heading;
        this.scene.add(group);
        remote = { name: visitor.name, slot: visitor.slot, group, spirit, fins, target: group.position.clone(), heading: visitor.heading, label, swing: null, swingReceivedAt: elapsed, bench: null, activity: null, lookout: visitor.lookout ?? null };
        this.entries.set(visitor.id, remote);
      }
      if (remote.label.textContent !== visitor.name) remote.label.textContent = visitor.name;
      remote.name = visitor.name;
      remote.slot = visitor.slot;
      remote.label.style.setProperty("--visitor-color", visitor.color);
      remote.target.set(visitor.x, height, visitor.z);
      const lookout = visitor.lookout ?? null;
      // Tower entry/exit teleports between floors; smoothing would float through the shaft.
      if (remote.lookout !== lookout) remote.group.position.copy(remote.target);
      remote.lookout = lookout;
      remote.heading = visitor.heading;
      remote.bench = visitor.bench ?? null; remote.activity = visitor.activity ?? null;
      const ride = visitor.swing;
      const swing = ride && [0, 1].includes(ride.index) && [ride.angle, ride.velocity].every(Number.isFinite)
        && world?.swings.find(value => value.placement.id === ride.id);
      if (JSON.stringify(remote.swing) !== JSON.stringify(swing ? ride : null)) remote.swingReceivedAt = elapsed;
      remote.swing = swing && ride ? { ...ride } : null;
      remote.group.visible = !focus && visitor.activity !== "focus";
    }
  }
  update(dt: number, elapsed: number, reducedMotion: boolean, swings: VillageSwingSet[]) {
    for (const remote of this.entries.values()) {
      remote.spirit.rotation.x = remote.bench ? -.08 : 0;
      const ride = remote.swing, swing = ride && swings.find(value => value.placement.id === ride.id);
      if (ride && swing) {
        // Predict only a short gap between packets, then hold if the rider stops sending.
        const age = Math.min(.24, Math.max(0, elapsed - remote.swingReceivedAt));
        const angle = T.MathUtils.clamp(ride.angle + ride.velocity * age, -SWING_MAX_ANGLE, SWING_MAX_ANGLE);
        swing.showSharedMotion(ride.index, angle, ride.velocity, dt);
        swing.seatPoint(ride.index, remote.group.position); remote.group.position.y -= .62;
        remote.heading = swing.placement.yaw;
      } else remote.group.position.lerp(remote.target, 1 - Math.exp(-dt * 12));
      const turn = T.MathUtils.euclideanModulo(remote.heading - remote.group.rotation.y + Math.PI, Math.PI * 2) - Math.PI;
      remote.group.rotation.y += turn * (1 - Math.exp(-dt * 12));
      remote.fins.forEach(fin => relaxBlobArm(fin, elapsed + remote.slot, remote.group.position.distanceTo(remote.target) > .05, reducedMotion));
    }
  }
  projectLabels(camera: T.PerspectiveCamera, player: T.Vector3, focus: boolean) {
    for (const remote of this.entries.values()) {
      const point = this.visitorLabelPoint.copy(remote.group.position).add(this.temp.set(0, 1.65, 0)).project(camera);
      remote.label.hidden = point.z < -1 || point.z > 1 || Math.abs(point.x) > 1 || Math.abs(point.y) > 1 || focus;
      if (!remote.label.hidden) {
        remote.label.style.left = `${(point.x * .5 + .5) * this.host.clientWidth}px`;
        remote.label.style.top = `${(-point.y * .5 + .5) * this.host.clientHeight}px`;
      }
    }
    for (const [id, bubble] of this.chatBubbles) {
      const origin = this.entries.get(id)?.group.position ?? player;
      const point = this.visitorLabelPoint.copy(origin).add(this.temp.set(0, 2.25, 0)).project(camera);
      bubble.element.hidden = (focus && this.entries.has(id)) ||
        point.z < -1 || point.z > 1 || Math.abs(point.x) > 1 || Math.abs(point.y) > 1;
      if (!bubble.element.hidden) {
        bubble.element.style.left = `${(point.x * .5 + .5) * this.host.clientWidth}px`;
        bubble.element.style.top = `${(-point.y * .5 + .5) * this.host.clientHeight}px`;
      }
    }
  }
  dispose() {
    for (const bubble of this.chatBubbles.values()) { clearTimeout(bubble.timer); bubble.element.remove(); }
    this.chatBubbles.clear();
    for (const remote of this.entries.values()) remote.label.remove();
  }
}
