"""Original white dove; run only in a separate background Blender process.
Z up / -Y forward exports to Y up / +Z forward. Four named parts are instanced in Three.js.
"""
import bpy, math, json, hashlib
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
bpy.ops.wm.read_factory_settings(use_empty=True)
palette = {'white': '#fffdf8', 'feather': '#e4e9ee', 'blush': '#f6b3b9',
           'beak': '#edba86', 'feet': '#dba397', 'eye': '#253c44', 'shine': '#ffffff'}
colors = {}
for name, hex_color in palette.items():
    rgb = [int(hex_color[i:i+2], 16) / 255 for i in (1, 3, 5)]
    colors[name] = tuple(v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4 for v in rgb) + (1,)
material = bpy.data.materials.new('Porcelain white dove colors'); material.use_nodes = True
shader = next(n for n in material.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
shader.inputs['Roughness'].default_value = .65
attribute = material.node_tree.nodes.new('ShaderNodeVertexColor'); attribute.layer_name = 'Color'
material.node_tree.links.new(attribute.outputs['Color'], shader.inputs['Base Color'])

def group(name, parent=None, location=(0, 0, 0)):
    ob = bpy.data.objects.new(name, None); bpy.context.collection.objects.link(ob)
    ob.parent = parent; ob.location = location
    return ob

def finish(ob, name, parent, color):
    ob.name = name; ob.parent = parent
    for p in ob.data.polygons: p.use_smooth = True
    attr = ob.data.color_attributes.new(name='Color', type='FLOAT_COLOR', domain='CORNER')
    for c in attr.data: c.color = colors[color]
    ob.data.materials.append(material)
    return ob

def oval(parent, name, location, scale, color, segments=20, rings=12):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, location=location)
    ob = bpy.context.object; ob.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish(ob, name, parent, color)

root = group('Dove')
body = group('DoveBody', root)
ob = oval(body, 'Pear-shaped snowy body', (0, .035, .36), (.27, .35, .3), 'white')
for v in ob.data.vertices:
    v.co.x *= 1 - .2 * v.co.z / .3
for i in range(3):
    tail = oval(body, 'Rounded tail feather', ((i-1)*.09, .36, .29), (.075, .22, .035), 'white')
    tail.rotation_euler.z = (i-1)*-.18; tail.rotation_euler.x = -.22
for side in [-1, 1]:
    oval(body, 'Tiny peach foot', (side*.11, -.09, .04), (.062, .1, .034), 'feet', 12, 8)
    for toe in [-1, 0, 1]:
        oval(body, 'Toe', (side*.11+toe*.028, -.15, .033), (.016, .055, .016), 'feet', 10, 6)
head = group('DoveHead', root, (0, -.19, .56))
oval(head, 'Round little head', (0, 0, 0), (.225, .22, .23), 'white')
for side in [-1, 1]:
    oval(head, 'Kind black eye', (side*.115, -.189, .025), (.034, .022, .046), 'eye', 16, 10)
    oval(head, 'Eye sparkle', (side*.115-.009, -.209, .042), (.011, .005, .014), 'shine', 10, 6)
    oval(head, 'Soft rose cheek', (side*.157, -.155, -.06), (.048, .013, .025), 'blush', 12, 8)
bpy.ops.mesh.primitive_cone_add(vertices=16, radius1=.047, radius2=.006, depth=.12, location=(0, -.249, -.037))
beak = finish(bpy.context.object, 'Little peach beak', head, 'beak'); beak.rotation_euler.x = math.pi / 2
for side, name in [(-1, 'DoveWingLeft'), (1, 'DoveWingRight')]:
    wing = group(name, root, (side*.21, .005, .43))
    oval(wing, 'Soft wing shoulder', (side*.105, .025, -.015), (.15, .235, .061), 'white')
    for feather in range(4):
        tip = oval(wing, 'Scalloped flight feather', (side*(.16+feather*.075), .08+feather*.018, -.02), (.13, .2-feather*.018, .026), 'white' if feather%2 else 'feather', 16, 8)
        tip.rotation_euler.z = side*-.22

# Join each rigid part, keeping its authored hinge as the mesh origin.
bpy.context.view_layer.update()
for parent in [body, head, root.children[-2], root.children[-1]]:
    parts = [o for o in parent.children if o.type == 'MESH']
    bpy.ops.object.select_all(action='DESELECT')
    for ob in parts: ob.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]; bpy.ops.object.join()
    mesh = parts[0]; mesh.name = parent.name + 'Mesh'
    bpy.context.scene.cursor.location = parent.matrix_world.translation
    bpy.ops.object.origin_set(type='ORIGIN_CURSOR')

source = ROOT / 'assets/village/dove.blend'; output = ROOT / 'public/village/models/dove.glb'
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=str(source))
bpy.ops.export_scene.gltf(filepath=str(output), export_format='GLB', export_yup=True, export_animations=False)
manifest = {'id': 'dove-v1', 'creator': 'Original project artwork, Blender ' + bpy.app.version_string,
    'source': str(source.relative_to(ROOT)), 'runtime': str(output.relative_to(ROOT)),
    'bytes': output.stat().st_size, 'sha256': hashlib.sha256(output.read_bytes()).hexdigest(),
    'triangles': sum(len(p.vertices)-2 for o in bpy.context.scene.objects if o.type == 'MESH' for p in o.data.polygons),
    'parts': ['DoveBody', 'DoveHead', 'DoveWingLeft', 'DoveWingRight'],
    'license': 'Original project artwork; no third-party models, textures or generators.'}
(ROOT / 'docs/village/dove-manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
print(json.dumps(manifest))

# A separate rendered preview leaves the saved source asset free of staging objects.
scene = bpy.context.scene
try: scene.render.engine = 'CYCLES'
except TypeError: pass
scene.cycles.samples = 24
scene.world = bpy.data.worlds.new('Dove preview world')
scene.world.color = (.3, .3, .3)
for location, power, size in [((2, -3, 5), 350, 4), ((-3, -1, 2), 170, 3)]:
    bpy.ops.object.light_add(type='AREA', location=location)
    light = bpy.context.object; light.data.energy = power; light.data.shape = 'DISK'; light.data.size = size
    light.rotation_euler = (Vector((0, 0, .4)) - light.location).to_track_quat('-Z', 'Y').to_euler()
bpy.ops.object.camera_add(location=(1.35, -2.4, 1.18))
camera = bpy.context.object; camera.rotation_euler = (Vector((0, 0, .36)) - camera.location).to_track_quat('-Z', 'Y').to_euler()
camera.data.type = 'ORTHO'; camera.data.ortho_scale = 1.7; scene.camera = camera
scene.render.resolution_x = 900; scene.render.resolution_y = 900; scene.render.resolution_percentage = 100
scene.render.film_transparent = True
preview = ROOT / 'docs/village/evidence/bird-clearing'; preview.mkdir(parents=True, exist_ok=True)
scene.render.filepath = str(preview / 'dove-blender.png')
bpy.ops.render.render(write_still=True)
