// Inspect the actual exported binary, including stray scenes, UVs and orientation.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { Matrix4, Quaternion, Vector3 } = require('three');
const root = path.resolve(__dirname, '../../..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'docs/village/animals-v2-manifest.json')));
let checks = 0;
function check(condition, label) { assert(condition, label); checks++; }
check(manifest.animals.length === 17, 'The eight species retain all seventeen requested/existing variants');
for (const asset of manifest.animals) {
  const bytes = fs.readFileSync(path.join(root, `public/village/models/animals-v2/${asset.id}.glb`));
  check(bytes.readUInt32LE(0) === 0x46546c67 && bytes.readUInt32LE(4) === 2 && bytes.readUInt32LE(8) === bytes.length, `${asset.id}: valid GLB header`);
  const jsonSize = bytes.readUInt32LE(12), doc = JSON.parse(bytes.subarray(20, 20 + jsonSize));
  const bin = bytes.subarray(28 + jsonSize);
  check(doc.scenes.length === 1 && doc.scenes[0].nodes.length === 1, `${asset.id}: one animal scene`);
  check(doc.nodes[doc.scenes[0].nodes[0]].name === asset.root, `${asset.id}: named individual root`);
  check(doc.skins?.length === 1 && doc.animations?.length >= 3 && !doc.cameras && !doc.images, `${asset.id}: one real skin with native clips and no studio/texture dependencies`);
  check(doc.meshes.length === 2 && doc.materials.length === 2, `${asset.id}: two mesh/material draws`);
  check(createHash('sha256').update(bytes).digest('hex') === asset.sha256 && bytes.length === asset.bytes, `${asset.id}: manifest matches actual bytes`);
  const read = index => {
    const a = doc.accessors[index], view = doc.bufferViews[a.bufferView];
    const counts = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 }, sizes = { 5126: 4, 5125: 4, 5123: 2, 5121: 1 };
    const n = counts[a.type], size = sizes[a.componentType], stride = view.byteStride || n * size;
    const base = (view.byteOffset || 0) + (a.byteOffset || 0);
    const get = a.componentType === 5126 ? 'readFloatLE' : a.componentType === 5125 ? 'readUInt32LE' : a.componentType === 5123 ? 'readUInt16LE' : 'readUInt8';
    return Array.from({ length: a.count }, (_, i) => Array.from({ length: n }, (_, j) => bin[get](base + i * stride + j * size)));
  };
  let triangles = 0, minimum = Infinity;
  const centres = [];
  const usedJoints = new Set(), joints = doc.skins[0].joints;
  const boneNames = joints.map(index => doc.nodes[index].name);
  check(new Set(boneNames).size === boneNames.length && ['Body', 'Neck', 'Head', 'Tail'].every(name => boneNames.includes(name)), `${asset.id}: stable unique semantic bones`);
  const inverseBinds = read(doc.skins[0].inverseBindMatrices).map(values => new Matrix4().fromArray(values));
  check(inverseBinds.length === joints.length && inverseBinds.every(matrix => matrix.elements.every(Number.isFinite)), `${asset.id}: finite inverse bind matrices for every joint`);
  const parents = new Map();
  doc.nodes.forEach((node, index) => node.children?.forEach(child => parents.set(child, index)));
  const nodeWorld = overrides => {
    const cache = new Map();
    const world = index => {
      if (cache.has(index)) return cache.get(index);
      const node = { ...doc.nodes[index], ...overrides.get(index) };
      const matrix = node.matrix ? new Matrix4().fromArray(node.matrix) : new Matrix4().compose(new Vector3().fromArray(node.translation || [0, 0, 0]), new Quaternion().fromArray(node.rotation || [0, 0, 0, 1]), new Vector3().fromArray(node.scale || [1, 1, 1]));
      if (parents.has(index)) matrix.premultiply(world(parents.get(index)));
      cache.set(index, matrix); return matrix;
    };
    return joints.map((joint, i) => world(joint).clone().multiply(inverseBinds[i]));
  };
  const restBind = nodeWorld(new Map()), identity = new Matrix4().elements;
  check(restBind.every(matrix => matrix.elements.every((value, i) => Math.abs(value - identity[i]) < .00001)), `${asset.id}: exported bind pose reproduces the approved rest mesh`);
  const nativePose = (clip, seconds) => {
    const overrides = new Map();
    for (const channel of clip.channels) {
      const sampler = clip.samplers[channel.sampler], times = read(sampler.input).flat(), values = read(sampler.output);
      let low = Math.max(0, times.findLastIndex(time => time <= seconds)), high = Math.min(low + 1, times.length - 1);
      const phase = low === high ? 0 : (seconds - times[low]) / (times[high] - times[low]);
      const value = channel.target.path === 'rotation' ? new Quaternion().fromArray(values[low]).slerp(new Quaternion().fromArray(values[high]), phase).toArray() : values[low].map((n, i) => n + (values[high][i] - n) * phase);
      overrides.set(channel.target.node, { ...overrides.get(channel.target.node), [channel.target.path]: value });
    }
    return nodeWorld(overrides);
  };
  const coat = doc.meshes.find(mesh => !mesh.name.includes('eyes')).primitives[0];
  const coatPositions = read(coat.attributes.POSITION), coatWeights = read(coat.attributes.WEIGHTS_0), coatJoints = read(coat.attributes.JOINTS_0);
  const deform = (index, matrices) => {
    const result = new Vector3();
    for (let j = 0; j < 4; j++) if (coatWeights[index][j]) result.addScaledVector(new Vector3().fromArray(coatPositions[index]).applyMatrix4(matrices[coatJoints[index][j]]), coatWeights[index][j]);
    return result;
  };
  check(doc.nodes.filter(node => node.mesh !== undefined).every(node => node.skin === 0), `${asset.id}: both authored draws use the real skin`);
  for (const mesh of doc.meshes) {
    check(mesh.primitives.length === 1 && (mesh.primitives[0].mode ?? 4) === 4, `${asset.id}: triangle primitive`);
    const p = mesh.primitives[0], positions = read(p.attributes.POSITION), normals = read(p.attributes.NORMAL), uv = read(p.attributes.TEXCOORD_0);
    const indices = read(p.indices).flat(); triangles += indices.length / 3;
    minimum = Math.min(minimum, ...positions.map(v => v[1]));
    centres.push({ eye: mesh.name.includes('eyes'), z: positions.reduce((sum, v) => sum + v[2], 0) / positions.length });
    check(positions.every(v => v.every(Number.isFinite)) && indices.every(i => i >= 0 && i < positions.length), `${asset.id}: finite geometry and valid indices`);
    check(normals.every(v => Math.abs(Math.hypot(...v) - 1) < .002), `${asset.id}: unit normals`);
    check(uv.every(v => v.every(n => Number.isFinite(n) && n >= -.0001 && n <= 1.0001)), `${asset.id}: finite packed UV range`);
    check(p.attributes.COLOR_0 !== undefined, `${asset.id}: authored colors survive export`);
    const weights = read(p.attributes.WEIGHTS_0), jointIds = read(p.attributes.JOINTS_0);
    check(weights.length === positions.length && weights.every(row => row.every(n => n >= 0 && Number.isFinite(n)) && Math.abs(row.reduce((sum, n) => sum + n, 0) - 1) < .0001), `${asset.id}: every exported vertex has normalized skin weights`);
    check(jointIds.every(row => row.every(joint => Number.isInteger(joint) && joint >= 0 && joint < joints.length)), `${asset.id}: skin joint indices stay within the skeleton`);
    for (let i = 0; i < weights.length; i++) for (let j = 0; j < 4; j++) if (weights[i][j] > .001) usedJoints.add(boneNames[jointIds[i][j]]);
    const colors = read(p.attributes.COLOR_0);
    const rows = positions.map((position, i) => [...position, ...uv[i], ...colors[i]].map(n => Math.floor(n * 100000 + .5)).join(',')).sort().join('\n');
    check(createHash('sha256').update(rows).digest('hex') === asset.restAttributeFingerprints[mesh.name], `${asset.id}: rest positions, UVs and colors preserve the approved static artwork`);
  }
  check(triangles === asset.triangles && triangles <= (/^horse-|^highland-/.test(asset.id) ? 15000 : ['cat', 'lamb', 'swan', 'owl', 'duck', 'duckling'].includes(asset.id) ? 6000 : 10000), `${asset.id}: measured triangle budget`);
  check(Math.abs(minimum) < .001, `${asset.id}: Y-up ground pivot`);
  check(centres.find(c => c.eye).z > centres.find(c => !c.eye).z, `${asset.id}: face points +Z`);
  check(doc.nodes.filter((n, i) => !joints.includes(i)).every(n => (!n.scale || n.scale.every(v => v === 1)) && (!n.rotation || n.rotation.every((v, i) => Math.abs(v - (i === 3 ? 1 : 0)) < 1e-6)) && (!n.translation || n.translation.every(v => Math.abs(v) < 1e-6))), `${asset.id}: applied model wrappers preserve ground/+Z placement`);
  check(doc.materials.every(m => m.pbrMetallicRoughness.metallicFactor === 0 && ['OPAQUE', undefined].includes(m.alphaMode)), `${asset.id}: simple opaque dielectric PBR`);
  const bird = ['owl', 'swan', 'duck', 'duckling'].includes(asset.id);
  check((bird ? ['WingLeft', 'WingRight'] : ['LegFrontLeft', 'LegFrontRight', 'LegBackLeft', 'LegBackRight']).every(name => usedJoints.has(name)), `${asset.id}: anatomical motion bones genuinely deform vertices`);
  check(Object.values(asset.skinning).some(stats => stats.blendedVertices > 0), `${asset.id}: continuous surfaces have blended skin transitions`);
  const required = ['idle', 'walk', 'pet', ...(bird ? ['fly', 'swim'] : []), ...(asset.id.startsWith('horse-') ? ['trot', 'canter'] : []), ...(asset.id.startsWith('dog-') ? ['run', 'sit', 'dance', 'spin', 'bow', 'wave', 'roll'] : [])];
  check(required.every(name => doc.animations.some(clip => clip.name === name)), `${asset.id}: all supported gameplay motions have native clips`);
  for (const clip of doc.animations) {
    check(clip.channels.every(channel => joints.includes(channel.target.node)), `${asset.id}/${clip.name}: only bones animate; the shared world wrapper stays stationary`);
    let varying = false;
    for (const channel of clip.channels) {
      const sampler = clip.samplers[channel.sampler], times = read(sampler.input).flat(), values = read(sampler.output);
      check(Math.abs(times[0]) < .0001 && Math.abs(times.at(-1) - asset.clips[clip.name]) < .0001 && times.every((t, i) => !i || t > times[i - 1]), `${asset.id}/${clip.name}: native seconds match the action clock`);
      const first = values[0], last = values.at(-1);
      const seam = channel.target.path === 'rotation' ? 1 - Math.abs(first.reduce((sum, n, i) => sum + n * last[i], 0)) : Math.max(...first.map((n, i) => Math.abs(n - last[i])));
      check(seam < .0001 && values.every(row => row.every(Number.isFinite)), `${asset.id}/${clip.name}: finite native keys close the loop`);
      varying ||= values.some(row => row.some((n, i) => Math.abs(n - first[i]) > .0001));
    }
    check(varying && asset.deformation[clip.name].maxDeformation > .0005 && asset.deformation[clip.name].loopSeam < .0001, `${asset.id}/${clip.name}: evaluated Blender skin moves and returns cleanly`);
    const start = nativePose(clip, 0), moving = nativePose(clip, asset.clips[clip.name] * .25);
    const maximum = coatPositions.reduce((max, _, i) => Math.max(max, deform(i, start).distanceTo(deform(i, moving))), 0);
    check(maximum > .0005, `${asset.id}/${clip.name}: actual exported joint tracks deform the actual exported vertices`);
  }
  check(doc.nodes[doc.scenes[0].nodes[0]].extras?.animalRigVersion === 1, `${asset.id}: runtime-identifiable rig version`);
}
console.log(`${checks} actual animal GLB checks passed.`);
