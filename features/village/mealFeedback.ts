import * as T from "three";
import { EATING_MS, MEAL_FEEDBACK_MS, MEAL_HEART_MS, type SharedPicnic } from "./picnic";

/** Render only accepted Worker bite clocks, including late snapshots and resumed visitors. */
export class MealFeedback {
  readonly group = new T.Group();
  readonly hearts = new Map<string, T.Mesh<T.ShapeGeometry, T.MeshBasicMaterial>>();
  private geometry: T.ShapeGeometry;
  constructor() {
    const heart = new T.Shape();
    heart.moveTo(0, -.4);
    heart.bezierCurveTo(-.2, -.15, -.5, .02, -.42, .26);
    heart.bezierCurveTo(-.35, .48, -.1, .44, 0, .25);
    heart.bezierCurveTo(.1, .44, .35, .48, .42, .26);
    heart.bezierCurveTo(.5, .02, .2, -.15, 0, -.4);
    this.geometry = new T.ShapeGeometry(heart, 12);
    this.group.name = "Shared meal feedback";
  }
  beginFrame(bites: SharedPicnic["bites"] | undefined, now: number) {
    for (const [id, heart] of this.hearts) {
      const bite = bites?.find(bite => bite.visitor === id);
      if (!bite || now - bite.at >= MEAL_FEEDBACK_MS) {
        heart.removeFromParent(); heart.material.dispose(); this.hearts.delete(id);
      } else heart.visible = false;
    }
  }
  pose(actor: { id: string; root: T.Object3D; character: T.Object3D; fins: T.Object3D[]; baseTilt: number }, bite: SharedPicnic["bites"][number] | undefined,
    now: number, camera: T.Quaternion, reduced: boolean, visible: boolean) {
    const age = bite ? now - bite.at : Infinity;
    if (!visible || age < 0 || age >= MEAL_FEEDBACK_MS) return;
    if (age < EATING_MS) {
      if (reduced) return;
      const progress = age / EATING_MS, lift = Math.sin(progress * Math.PI);
      actor.character.rotation.x = actor.baseTilt - .12 * lift + Math.sin(progress * Math.PI * 6) * .035 * lift;
      actor.fins.forEach((fin, index) => { fin.rotation.z += (index ? -.72 : .72) * lift; });
      return;
    }
    let heart = this.hearts.get(actor.id);
    if (!heart) {
      heart = new T.Mesh(this.geometry, new T.MeshBasicMaterial({ color: "#f7a6c0", side: T.DoubleSide, transparent: true, depthWrite: false }));
      heart.name = "Meal heart"; this.hearts.set(actor.id, heart); this.group.add(heart);
    }
    const progress = (age - EATING_MS) / MEAL_HEART_MS;
    heart.visible = true;
    heart.position.copy(actor.root.position); heart.position.y += 2.1 + (reduced ? 0 : progress * .5);
    heart.quaternion.copy(camera);
    heart.scale.setScalar(reduced ? .55 : .55 * Math.min(1, progress * 7));
    heart.material.opacity = reduced ? 1 : Math.min(1, progress * 7, (1 - progress) * 4);
  }
  dispose() {
    for (const heart of this.hearts.values()) heart.material.dispose();
    this.hearts.clear(); this.group.clear(); this.geometry.dispose();
  }
}
