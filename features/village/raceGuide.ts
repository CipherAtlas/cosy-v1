import * as T from "three";
import { floorHeight } from "./environment";
import type { AuthoredWorld } from "./worldLayout";
import { TOWN_CHECKPOINTS, TOWN_TRACK_START_ANGLE, townItems, trackPoint, type SharedTown } from "./townShared";

/** A transient next-gate marker follows only the visitor's accepted race. */
export class RaceGuide {
  readonly group = new T.Group();
  private material = new T.MeshBasicMaterial({ color: "#f8edb5", transparent: true, opacity: .66, depthWrite: false });
  private geometry = new T.BoxGeometry(1, 1, 1);

  constructor(private world: AuthoredWorld) {
    this.group.name = "Next accepted race checkpoint"; this.group.visible = false;
    for (const side of [-1, 1]) {
      const post = new T.Mesh(this.geometry, this.material); post.position.set(side * 4.2, 1.45, 0); post.scale.set(.08, 2.9, .08);
      this.group.add(post);
    }
    const ribbon = new T.Mesh(this.geometry, this.material); ribbon.position.y = 2.9; ribbon.scale.set(8.4, .08, .08); this.group.add(ribbon);
    for (const side of [-1, 1]) {
      const arrow = new T.Mesh(this.geometry, this.material); arrow.position.set(side * .33, .04, .25); arrow.rotation.y = -side * Math.PI / 4;
      arrow.scale.set(.09, .035, .9); this.group.add(arrow);
    }
  }

  applyShared(town: SharedTown | undefined, selfId: string) {
    const race = town?.race, track = race ? townItems(this.world, "horse-racetrack").find(item => item.id === race.trackId) : null;
    this.group.visible = !!track && race?.owner === selfId && (race.phase === "countdown" || race.phase === "racing");
    if (!this.group.visible || !track || !race) return;
    const angle = TOWN_TRACK_START_ANGLE + race.nextCheckpoint * Math.PI * 2 / TOWN_CHECKPOINTS;
    const [x, z] = trackPoint(track, angle), next = trackPoint(track, angle + .01);
    this.group.position.set(x, floorHeight(x, z) + .025, z);
    this.group.rotation.y = Math.atan2(next[0] - x, next[1] - z);
    this.group.scale.setScalar(Math.min(track.scale[0], track.scale[2]));
  }

  dispose() { this.geometry.dispose(); this.material.dispose(); this.group.clear(); }
}
