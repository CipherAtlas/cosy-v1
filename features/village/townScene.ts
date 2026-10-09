import * as T from "three";
import { TownCropRendering } from "./townCropRendering";
import { applySceneTransform } from "./sceneLayout";
import { drawGardenGrowthClock } from "./gardenGrowthDisplay";
import { TOWN_GROW_MS, TOWN_MEAL_MS, townItems, townPoint, type SharedTown } from "./townShared";
import type { AuthoredWorld, WorldItem } from "./worldLayout";
import { animalHeartGeometry } from "./animalEmotes";
import { createAnimalDialogueCue, type AnimalDialogueCue } from "./animalDialogue";
import { owlFlightPose } from "./owlFlight";
import type { AnimalSoundSource, TownAnimalSoundEvent } from "./townAnimalAudio";
import { animateAnimalRig, disposeAnimalRig, isAnimalRigLoaded, makeAnimalRig } from "./animalRig";
import { clone as cloneSkeleton } from "three/addons/utils/SkeletonUtils.js";

const OWL_THANKS = { en: "Hoot hoot~ (Thank you~)", ja: "ホーホー〜（ありがとう〜）" };
const OWL_HELLO = { en: "Hoot hoot~", ja: "ホーホー〜" };

/** Plants and owls render the accepted public clocks; pending requests change nothing. */
export class TownScene {
  readonly group = new T.Group();
  private town?: SharedTown;
  private clock = 0;
  private reducedMotion = false;
  readonly dialogueCues: AnimalDialogueCue[] = [];
  private cropAt = -Infinity;
  private cropSignature = "";
  private rows: WorldItem[];
  private cropRendering: TownCropRendering;
  private owls: { root: T.Object3D; home: WorldItem; head?: T.Object3D; body?: T.Object3D; wings: T.Object3D[]; base: T.Vector3; speech: AnimalDialogueCue; heard: number }[] = [];
  get soundSources(): AnimalSoundSource[] {
    return this.group.visible ? this.owls.map(owl => ({ id: owl.home.id, species: "owl", position: owl.root.position.toArray() as [number, number, number] })) : [];
  }
  private hearts: T.InstancedMesh;
  private clocks: { row: WorldItem; sprite: T.Sprite; canvas: HTMLCanvasElement; texture: T.CanvasTexture; text: string }[] = [];
  private perch?: WorldItem;
  private crumbs: T.InstancedMesh;
  private dummy = new T.Object3D();

  constructor(authored: AuthoredWorld, source: T.Object3D, townKit: T.Object3D, private sound: (event: TownAnimalSoundEvent) => void = () => {}) {
    this.group.name = "Shared town farms and owl roost";
    this.rows = townItems(authored, "farm-row");
    this.perch = townItems(authored, "owl-feeding-perch")[0];
    this.cropRendering = new TownCropRendering(this.rows, source); this.group.add(this.cropRendering.group);
    const owlSource = townKit.getObjectByName("OwlBrown");
    if (!owlSource) throw Error("The original Blender owl is missing from the town kit.");
    for (const item of townItems(authored, "owl-brown").slice(0, 3)) {
      const root = isAnimalRigLoaded("owl") ? makeAnimalRig("owl") : cloneSkeleton(owlSource); applySceneTransform(root, item); root.visible = false;
      const body = root.getObjectByName(root.userData.animalRigSlug ? "Body" : "OwlBody");
      const speech = createAnimalDialogueCue(item.id, "Hoot hoot~ (Thank you~)", "ホーホー〜（ありがとう〜）");
      this.dialogueCues.push(speech);
      this.owls.push({ root, home: item, head: root.getObjectByName(root.userData.animalRigSlug ? "Head" : "OwlHead"), body,
        wings: (root.userData.animalRigSlug ? [root.getObjectByName("WingLeft"), root.getObjectByName("WingRight")] : [root.getObjectByName("OwlWingLeft"), root.getObjectByName("OwlWingRight")]).filter((wing): wing is T.Object3D => Boolean(wing)), base: body?.position.clone() ?? new T.Vector3(), speech, heard: -Infinity });
      this.group.add(root);
    }
    this.hearts = new T.InstancedMesh(animalHeartGeometry(), new T.MeshBasicMaterial({ color: "#ffc1b5", side: T.DoubleSide, depthWrite: false }), this.owls.length * 3);
    this.hearts.name = "Happy owl hearts"; this.hearts.visible = false; this.hearts.frustumCulled = false;
    this.hearts.instanceMatrix.setUsage(T.DynamicDrawUsage); this.group.add(this.hearts);
    for (const row of this.rows) {
      const canvas = document.createElement("canvas"); canvas.width = canvas.height = 192;
      const texture = new T.CanvasTexture(canvas); texture.colorSpace = T.SRGBColorSpace;
      const sprite = new T.Sprite(new T.SpriteMaterial({ map: texture, depthWrite: false }));
      sprite.name = `${row.name || row.id} growth timer`; sprite.scale.set(.65, .65, 1); sprite.visible = false;
      const [x, z] = townPoint(row, 0, 0); sprite.position.set(x, row.position[1] + 2.2 * row.scale[1], z);
      this.clocks.push({ row, sprite, canvas, texture, text: "" }); this.group.add(sprite);
    }
    this.crumbs = new T.InstancedMesh(new T.IcosahedronGeometry(.022, 0), new T.MeshStandardMaterial({ color: "#d5b56f", roughness: 1 }), 36);
    this.crumbs.visible = false; this.group.add(this.crumbs);
    if (this.perch) {
      for (let i = 0; i < this.crumbs.count; i++) {
        const [x, z] = townPoint(this.perch, Math.sin(i * 2.4) * .92, 1.25 + Math.cos(i * 2.4) * .16);
        this.dummy.position.set(x, this.perch.position[1] + .61 * this.perch.scale[1], z);
        this.dummy.rotation.set(i, i * .7, 0); this.dummy.scale.setScalar(.8 + i % 3 * .16); this.dummy.updateMatrix(); this.crumbs.setMatrixAt(i, this.dummy.matrix);
      }
      this.crumbs.instanceMatrix.needsUpdate = true; this.crumbs.computeBoundingSphere();
    }
  }

  applyShared(town: SharedTown | undefined, time: number, _selfId = "") {
    this.town = town; this.clock = time - Date.now();
    const signature = JSON.stringify(town?.beds);
    if (signature !== this.cropSignature) { this.cropAt = -Infinity; this.cropSignature = signature; }
    for (const owl of this.owls) { owl.root.visible = Boolean(town); if (!town) owl.speech.visible = false; }
    if (!town) {
      this.cropRendering.hide(); this.crumbs.visible = this.hearts.visible = false;
      this.clocks.forEach(clock => { clock.sprite.visible = false; });
      return;
    }
    this.update(this.reducedMotion);
  }

  update(reducedMotion: boolean, cameraRotation?: T.Quaternion) {
    this.reducedMotion = reducedMotion;
    if (!this.town) return;
    const time = Date.now() + this.clock;
    if (time - this.cropAt >= 750) { this.cropRendering.update(this.town.beds, time); this.updateClocks(time); this.cropAt = time; }
    const meal = this.town.owlFeedAt === null ? -1 : (time - this.town.owlFeedAt) / TOWN_MEAL_MS;
    const feeding = meal >= 0 && meal < 1 && Boolean(this.perch);
    const feedAt = this.town.owlFeedAt === null ? null : this.town.owlFeedAt / 1000;
    const happy = feeding && meal >= .44 && meal < .79;
    this.hearts.visible = happy;
    this.owls.forEach((owl, index) => {
      const t = time / 1000, base = owl.base;
      const pose = owlFlightPose(owl.home, this.perch, index, t, feedAt), flying = pose.flying;
      owl.root.position.fromArray(pose.position);
      owl.root.rotation.set(reducedMotion ? 0 : pose.pitch, pose.heading, reducedMotion ? 0 : pose.bank);
      const native = animateAnimalRig(owl.root, { action: pose.action, time: t + index * 1.7, reduced: reducedMotion,
        stillAction: flying ? "glide" : "idle" });
      if (!native) {
        if (owl.head) {
          owl.head.rotation.y = reducedMotion ? 0 : Math.sin(t * .7 + index * 1.8) * (happy ? .25 : .16);
          owl.head.rotation.x = reducedMotion ? 0 : feeding && !flying ? .3 + Math.sin(t * 6 + index) * (happy ? .06 : .15) : Math.sin(t * .46 + index) * .035;
          owl.head.rotation.z = reducedMotion || !happy ? 0 : Math.sin(t * 3 + index) * .09;
        }
        if (owl.body) owl.body.position.set(base.x, base.y + (reducedMotion ? 0 : Math.sin(t * (happy ? 4 : 1.35) + index) * (happy ? .035 : .005)), base.z);
        const flap = .95 + Math.sin(t * Math.PI * 2 + index) * .40, glide = pose.action === "glide";
        owl.wings.forEach((wing, side) => { wing.rotation.z = reducedMotion ? 0 : (side ? -1 : 1) * (flying ? glide ? .84 : flap : happy ? .2 + Math.sin(t * 5 + index) * .12 : 0); });
      }
      const idleAge = (t + index * 11) % 43;
      const happyAge = meal * 12 - 5.28;
      const speaking = happy && index === Math.min(this.owls.length - 1, Math.floor(Math.max(0, happyAge) / 1.4));
      if (speaking && owl.heard !== feedAt && this.group.visible) {
        owl.heard = feedAt!;
        if (index === 0 && happyAge < .8) this.sound({ species: "owl", position: owl.root.position.toArray() as [number, number, number], happy: true });
      }
      owl.speech.visible = speaking || !feeding && idleAge < 2.4;
      owl.speech.text = speaking ? OWL_THANKS : OWL_HELLO;
      owl.speech.priority = speaking ? 3 : 1;
      (owl.head ?? owl.root).getWorldPosition(owl.speech.position);
      owl.speech.position.y += .25;
      for (let heart = 0; heart < 3; heart++) {
        const age = ((meal * 12 - 5.28 + heart * .55) % 2.1 + 2.1) % 2.1;
        this.dummy.position.copy(owl.root.position); this.dummy.position.y += .85 + (reducedMotion ? heart * .17 : age * .28);
        this.dummy.position.x += (heart - 1) * .22;
        this.dummy.quaternion.copy(cameraRotation ?? owl.root.quaternion);
        this.dummy.scale.setScalar(happy ? reducedMotion ? .16 : Math.sin(age / 2.1 * Math.PI) * .2 : 0);
        this.dummy.updateMatrix(); this.hearts.setMatrixAt(index * 3 + heart, this.dummy.matrix);
      }
    });
    this.hearts.instanceMatrix.needsUpdate = true;
    this.crumbs.visible = feeding;
  }

  private updateClocks(time: number) {
    for (const clock of this.clocks) {
      const bed = this.town!.beds.find(bed => bed.id === clock.row.id), left = bed?.growAt === null || bed?.growAt === undefined ? 0 : Math.ceil((bed.growAt - time) / 1000);
      clock.sprite.visible = left > 0;
      const text = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;
      if (!clock.sprite.visible || text === clock.text) continue;
      clock.text = text;
      drawGardenGrowthClock(clock.canvas, text, T.MathUtils.clamp(1 - (bed!.growAt! - time) / TOWN_GROW_MS, 0, 1));
      clock.texture.needsUpdate = true;
    }
  }

  prepareCrops(signal?: AbortSignal) { return this.cropRendering.prepare(signal); }
  updateCropDetail(camera: T.Camera) { this.cropRendering.updateDetail(camera); }

  dispose() {
    this.cropRendering.dispose(); this.crumbs.geometry.dispose(); (this.crumbs.material as T.Material).dispose(); this.crumbs.dispose();
    this.owls.forEach(owl => { disposeAnimalRig(owl.root); owl.speech.visible = false; });
    this.clocks.forEach(clock => { clock.texture.dispose(); clock.sprite.material.dispose(); });
    this.hearts.geometry.dispose(); (this.hearts.material as T.Material).dispose(); this.hearts.dispose();
    this.group.clear();
  }
}
