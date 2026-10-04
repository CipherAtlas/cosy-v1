"""Original soft town animals, generated in an isolated background Blender process.

Blender Z up / -Y forward becomes glTF Y up / +Z forward. Every model has a
floor pivot, named head/leg joints and baked opaque fleece rather than GPU hair.
"""
import bpy
import math
import random
import json
import hashlib
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.preferences.filepaths.save_version = 0
random.seed(10426)

def material(name, color, roughness=.94):
    srgb = [int(color[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    linear = [v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4 for v in srgb]
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*linear, 1)
    m.use_nodes = True
    shader = m.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (*linear, 1)
    shader.inputs['Roughness'].default_value = roughness
    return m

palette = {
    'ginger': '#b87b49', 'copper': '#d29a62', 'blonde': '#e8bd82',
    'shadow': '#8b603f', 'cream': '#f1e3bd', 'wool': '#e9dec7',
    'woollight': '#f8edda', 'woolshade': '#d7c6a8', 'face': '#ac9479',
    'nose': '#79624e', 'hoof': '#544e43', 'pink': '#d79e92',
    'ink': '#26342e', 'shine': '#fff9e7', 'spine': '#957956',
    'spinetip': '#d1b994', 'belly': '#dec3a1', 'sage': '#6f8d73',
    'wood': '#b39b73', 'darkwood': '#705643', 'stone': '#b5b69b',
    'owl': '#96734f', 'owldark': '#5f4d39', 'owlcream': '#e7d5a9', 'gold': '#d7aa4e',
    'apple': '#d96b56', 'appleblush': '#e69b77', 'appleleaf': '#64885d',
    'mushroom': '#b97c5c', 'mushroomcream': '#ead8ac', 'flower': '#ddaab8',
}
M = {name: material(name, color, .28 if name == 'ink' else .94) for name, color in palette.items()}

def pivot(name, position=(0, 0, 0), parent=None):
    ob = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(ob)
    ob.parent = parent
    ob.location = position
    return ob

def mesh(name, vertices, faces, mat, parent):
    data = bpy.data.meshes.new(name)
    data.from_pydata(vertices, [], faces)
    data.update()
    ob = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(ob)
    ob.parent = parent
    data.materials.append(M[mat])
    for face in data.polygons:
        face.use_smooth = True
    return ob

def oval(name, position, size, mat, parent, segments=16, rings=10, rotation=(0, 0, 0)):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings)
    ob = bpy.context.object
    ob.name = name
    ob.parent = parent
    ob.location = position
    ob.scale = size
    ob.rotation_euler = rotation
    ob.data.materials.append(M[mat])
    for face in ob.data.polygons:
        face.use_smooth = True
    return ob

def curl(name, position, size, mat, parent):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1)
    ob = bpy.context.object
    ob.name = name
    ob.parent = parent
    ob.location = position
    ob.scale = size
    ob.data.materials.append(M[mat])
    for face in ob.data.polygons:
        face.use_smooth = True
    return ob

def tube(name, points, radius, mat, parent, resolution=2, taper=False):
    curve = bpy.data.curves.new(name, 'CURVE')
    curve.dimensions = '3D'
    curve.resolution_u = 6
    curve.bevel_depth = radius
    curve.bevel_resolution = resolution
    curve.use_fill_caps = True
    spline = curve.splines.new('BEZIER')
    spline.bezier_points.add(len(points) - 1)
    for i, (p, co) in enumerate(zip(spline.bezier_points, points)):
        p.co = co
        p.handle_left_type = p.handle_right_type = 'AUTO'
        if taper: p.radius = max(.06, 1.3 * (1 - i / max(1, len(points) - 1)) ** .65)
    ob = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(ob)
    ob.parent = parent
    curve.materials.append(M[mat])
    bpy.ops.object.select_all(action='DESELECT')
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.convert(target='MESH')
    return bpy.context.object

def lock(name, start, length, radius, mat, parent, lean=(0, -.08, 0)):
    # Broad rounded roots taper into soft, slightly curled hanging locks.
    sections = [(-.13, .03), (-.08, .7), (0, 1), (.32, .94), (.63, .63), (.86, .29), (1, .018)]
    vertices = []
    for section, (t, width) in enumerate(sections):
        for side in range(7):
            a = side * math.tau / 7
            vertices.append((start[0] + math.cos(a) * radius * width + lean[0] * t * t + math.sin(t * math.pi) * radius * .18,
                             start[1] + math.sin(a) * radius * .62 * width + lean[1] * t * t,
                             start[2] - length * t + lean[2] * t * t))
    faces = []
    for section in range(len(sections) - 1):
        for side in range(7):
            n = section * 7 + side
            nxt = section * 7 + (side + 1) % 7
            faces.append((n, nxt, nxt + 7, n + 7))
    faces.append(tuple(range(6, -1, -1)))
    faces.append(tuple(range((len(sections) - 1) * 7, len(sections) * 7)))
    return mesh(name, vertices, faces, mat, parent)

def eyes(parent, spread, y, z, size):
    for side in [-1, 1]:
        oval('Soft eye socket', (side * spread, y + .012, z), (size * 1.3, size * .48, size * 1.2), 'nose', parent, 12, 8)
        oval('Kind glossy eye', (side * spread, y - .015, z), (size, size * .4, size * 1.03), 'ink', parent, 16, 10)
        oval('Large eye glint', (side * spread - size * .24, y - size * .46, z + size * .36), (size * .24, size * .09, size * .25), 'shine', parent, 10, 6)
        oval('Small eye glint', (side * spread + size * .27, y - size * .43, z - size * .2), (size * .10, size * .065, size * .11), 'shine', parent, 8, 6)

def legs(root, prefix, spread, front, back, height, width, mat='face'):
    for forward in [True, False]:
        for side in [-1, 1]:
            name = prefix + 'Leg' + ('Front' if forward else 'Back') + ('Left' if side < 0 else 'Right')
            leg = pivot(name, (side * spread, front if forward else back, height), root)
            oval('Soft short leg', (0, 0, -height * .42), (width, width, height * .5), mat, leg, 12, 8)
            oval('Rounded hoof', (0, -.012, -.88 * height), (width * 1.1, width * 1.13, height * .12), 'hoof', leg, 12, 8)

roots = []

# Shaggy Highland cow: wide serene face, cascading fringe and curled ivory horns.
root = pivot('CowHighland'); roots.append(root)
body = pivot('CowHighlandBody', (0, .08, 1.0), root)
oval('Plush copper body', (0, .02, 0), (.58, .94, .55), 'ginger', body)
oval('Warm chest', (0, -.66, -.02), (.49, .44, .54), 'copper', body)
for i in range(150):
    a = i * 2.399963
    z = -.16 + (i % 9) * .079
    r = math.sqrt(max(.15, 1 - (z / .64) ** 2))
    x = math.cos(a) * .56 * r
    y = math.sin(a) * .91 * r
    lock('Baked cascading shag', (x, y, z + .012 * math.sin(i * 1.7)), .21 + (i % 5) * .034 + random.random() * .06, .065 + random.random() * .016, 'copper' if i % 4 else 'blonde', body, (math.cos(a) * .09 + math.sin(i) * .06, math.sin(a) * .1, .02))
for i in range(22):
    x = -.32 + (i % 7) * .104
    z = .08 - (i // 7) * .12
    lock('Soft shaggy chest bib', (x, -.77 + abs(x) * .18, z), .24 + .065 * math.sin(i * 1.3), .068, 'copper' if i % 3 else 'blonde', body, (x * .14, -.085, .01))
head = pivot('CowHighlandHead', (0, -.83, .32), body)
oval('Broad gentle head', (0, -.09, .04), (.4, .36, .38), 'copper', head)
oval('Soft muzzle', (0, -.365, -.13), (.305, .215, .16), 'cream', head)
oval('Warm velvet nose', (0, -.5, -.1), (.205, .073, .094), 'nose', head)
for side in [-1, 1]:
    oval('Tiny nostril', (side * .102, -.56, -.08), (.029, .012, .025), 'shadow', head, 10, 6)
    oval('Rosy muzzle cheek', (side * .222, -.497, -.12), (.035, .007, .018), 'pink', head, 10, 6)
    oval('Fluffy broad ear', (side * .445, .01, .155), (.23, .15, .105), 'ginger', head, 16, 10, (0, side * .2, side * .2))
    oval('Velvet inner ear', (side * .455, -.044, .188), (.145, .058, .034), 'pink', head, 12, 8)
    tube('Ivory upturned horn', [(side * .31, .05, .28), (side * .5, .08, .37), (side * .69, .07, .5), (side * .72, .005, .66)], .045, 'cream', head, taper=True)
    for i in range(9):
        # Leave an eye-height opening at the front of the side fringe.
        start_z = .025 if i // 3 == 2 else .18
        lock('Shaggy cheek', (side * (.34 + (i % 3) * .03), -.11 - (i // 3) * .085, start_z), .25 + i % 3 * .04, .055, 'ginger' if i % 3 else 'blonde', head, (side * .035, -.025, 0))
    # Rounded eyes wrap onto the cheek so they read in the side pet camera as well.
    oval('Soft Highland eye socket', (side * .282, -.36, .12), (.06, .035, .06), 'nose', head, 12, 8)
    oval('Kind Highland eye', (side * .286, -.391, .12), (.048, .041, .051), 'ink', head, 16, 10)
    oval('Highland eye glint', (side * .286 - .009, -.423, .139), (.012, .009, .013), 'shine', head, 10, 6)
    oval('Small Highland eye glint', (side * .286 + .013, -.422, .112), (.005, .004, .006), 'shine', head, 8, 6)
for row in range(3):
    for i in range(9):
        x = (i - 4) * .073
        # The centre fringe is long; outer eyes remain just visible below it.
        length = .08 + .30 * (1 - abs(i - 4) / 4) ** 2 + row * .012 + .014 * math.sin(i * 1.3 + row)
        lock('Silky forehead fringe', (x, -.29 - row * .045, .32 - row * .016), length, .059, 'blonde' if (i + row) % 4 else 'copper', head, (.055 * math.sin(i + row), -.085, .008))
for side in [-1, 1]:
    tube('Small friendly mouth', [(0, -.552, -.16), (side * .035, -.548, -.175), (side * .082, -.532, -.16)], .005, 'shadow', head)
legs(root, 'CowHighland', .37, -.58, .72, .59, .105, 'ginger')
tail = pivot('CowHighlandTail', (0, .9, 1.1), root)
tube('Easy hanging tail', [(0, 0, 0), (.1, .16, -.2), (.11, .18, -.58)], .034, 'ginger', tail)
for i in range(7):
    lock('Fluffy tail tassel', (.09 + math.cos(i) * .05, .18 + math.sin(i) * .045, -.45), .28, .043, 'copper', tail)

# A separate, editable girl-cow sculpture shares the same silhouette and joints.
def copy_model(original, parent=None):
    ob = original.copy()
    if original.data: ob.data = original.data.copy()
    bpy.context.collection.objects.link(ob)
    ob.parent = parent
    ob.name = original.name.replace('CowHighland', 'CowHighlandGirl')
    for child in original.children: copy_model(child, ob)
    return ob

girl = copy_model(root); roots.append(girl)
girl_head = next(ob for ob in girl.children_recursive if ob.name == 'CowHighlandGirlHead')
flower_center = Vector((.54, .025, .33))
for i in range(7):
    a = i * math.tau / 7
    oval('Soft pink flower petal', tuple(flower_center + Vector((math.cos(a) * .095, -.025, math.sin(a) * .095))), (.07, .025, .065), 'flower', girl_head, 12, 8, (0, 0, a))
oval('Warm flower centre', tuple(flower_center + Vector((0, -.052, 0))), (.057, .025, .057), 'gold', girl_head, 12, 8)
oval('Little flower leaf', (.58, .04, .215), (.075, .023, .035), 'sage', girl_head, 12, 8, (0, -.35, 0))

def sheep(prefix, scale=1, lamb=False):
    root = pivot(prefix); roots.append(root)
    body = pivot(prefix + 'Body', (0, .06, .68), root)
    oval('Cloud-soft wool body', (0, .07, .03), (.35, .59, .37), 'wool', body)
    for i in range(115 if not lamb else 94):
        a = i * 2.399963
        zz = -.24 + (i % 9) * .064
        ring = math.sqrt(max(.12, 1 - (zz / .4) ** 2))
        x = math.cos(a) * .337 * ring
        y = .07 + math.sin(a) * .59 * ring
        curl('Rounded wool curl', (x, y, zz + .07), (.084, .1, .09), 'woollight' if i % 4 else 'woolshade', body)
    head = pivot(prefix + 'Head', (0, -.48, .15), body)
    oval('Sweet woolly forehead', (0, -.065, .095), (.23, .25, .22), 'wool', head)
    oval('Warm soft face', (0, -.19, -.08), (.18, .22, .205), 'face', head)
    oval('Cream rounded muzzle', (0, -.34, -.15), (.151, .095, .09), 'cream', head)
    oval('Button nose', (0, -.41, -.138), (.036, .017, .024), 'nose', head, 12, 8)
    eyes(head, .11, -.329, .005, .034 if not lamb else .039)
    for side in [-1, 1]:
        oval('Drooping soft ear', (side * .266, -.09, .06), (.19, .075, .095), 'face', head, 16, 10, (0, side * .25, side * .18))
        oval('Rose inner ear', (side * .278, -.136, .075), (.12, .025, .051), 'pink', head, 12, 8)
        oval('Peach cheek', (side * .139, -.335, -.077), (.028, .008, .018), 'pink', head, 10, 6)
        tube('Little mouth', [(0, -.41, -.158), (side * .024, -.407, -.177), (side * .041, -.393, -.164)], .0038, 'nose', head)
    for i in range(14):
        curl('Forehead fleece curl', (math.cos(i * 2.4) * .18, -.04 + math.sin(i * 2.4) * .15, .21 + (i % 2) * .03), (.072, .077, .073), 'woollight', head)
    legs(root, prefix, .225, -.36, .42, .43, .065)
    tail = pivot(prefix + 'Tail', (0, .62, .71), root)
    oval('Small wool tail', (0, .07, -.035), (.09, .12, .13), 'wool', tail)
    for i in range(5):
        curl('Tail fleece', (math.cos(i) * .055, .08 + math.sin(i) * .06, -.02), (.05, .06, .05), 'woollight', tail)
    # The exported lamb is a distinct small sculpture with larger eyes and a rounder face.
    root.scale = (scale, scale, scale)
    return root

sheep('Sheep')
sheep('Lamb', .63, True)

# A tiny garden hedgehog with a soft face and rounded, cream-tipped baked spines.
root = pivot('Hedgehog'); roots.append(root)
body = pivot('HedgehogBody', (0, .035, .19), root)
oval('Round woodland body', (0, .065, .015), (.215, .285, .19), 'spine', body)
oval('Velvet cream belly', (0, -.025, -.08), (.181, .24, .095), 'belly', body)
for i in range(235):
    a = i * 2.399963
    elevation = .17 + (i % 12) / 12 * math.pi * .46
    x = math.cos(a) * math.cos(elevation) * .208
    y = .06 + math.sin(a) * math.cos(elevation) * .275
    z = math.sin(elevation) * .176 + .015
    if y < -.125: continue
    direction = Vector((x, y - .025, z * 1.35)).normalized()
    end = Vector((x, y, z)) + direction * (.068 + i % 4 * .008)
    # Tapered closed quills avoid hollow pipe tips in the tiny close-up silhouette.
    axis = direction.cross(Vector((0, 0, 1)))
    if axis.length < .001: axis = Vector((1, 0, 0))
    axis.normalize(); across = direction.cross(axis).normalized()
    vertices = []
    rings = [(0, .009), (.24, .012), (.63, .009), (.91, .0045), (1, .001)]
    for t, radius in rings:
        center = Vector((x, y, z)).lerp(end, t)
        for side in range(7):
            a = side * math.tau / 7
            vertices.append(tuple(center + axis * math.cos(a) * radius + across * math.sin(a) * radius))
    faces = [(r * 7 + k, r * 7 + (k + 1) % 7, (r + 1) * 7 + (k + 1) % 7, (r + 1) * 7 + k) for r in range(4) for k in range(7)]
    faces += [tuple(range(6, -1, -1)), tuple(range(28, 35))]
    mesh('Soft tapered hedgehog quill', vertices, faces, 'spinetip' if i % 3 else 'spine', body)
head = pivot('HedgehogHead', (0, -.206, .03), body)
oval('Round cream face', (0, -.049, .016), (.153, .153, .13), 'belly', head)
oval('Tapered soft snout', (0, -.174, -.029), (.073, .13, .062), 'cream', head)
oval('Tiny shiny nose', (0, -.282, -.012), (.039, .023, .031), 'ink', head, 16, 10)
oval('Nose sparkle', (-.01, -.303, .001), (.008, .005, .007), 'shine', head, 10, 6)
eyes(head, .095, -.165, .045, .032)
for side in [-1, 1]:
    oval('Little rounded ear', (side * .122, -.003, .11), (.051, .023, .054), 'face', head, 16, 10)
    oval('Pink ear inset', (side * .122, -.024, .11), (.032, .008, .034), 'pink', head, 12, 8)
    oval('Rosy woodland cheek', (side * .114, -.167, -.012), (.026, .008, .015), 'pink', head, 12, 8)
    tube('Tiny curved smile', [(0, -.248, -.051), (side * .03, -.226, -.068), (side * .051, -.198, -.054)], .003, 'nose', head)
for forward in [True, False]:
    for side in [-1, 1]:
        leg = pivot('HedgehogLeg' + ('Front' if forward else 'Back') + ('Left' if side < 0 else 'Right'), (side * .129, -.15 if forward else .2, .09), root)
        oval('Little velvet paw', (0, -.012, -.046), (.041, .063, .044), 'face', leg, 12, 8)
        for i in [-1, 0, 1]:
            oval('Tiny paw toe', (i * .017, -.057, -.054), (.012, .018, .013), 'cream', leg, 8, 6)
tail = pivot('HedgehogTail', (0, .29, .12), root)
oval('Tiny tail', (0, .035, 0), (.024, .055, .027), 'face', tail, 10, 6)

# Three instances of this expressive tawny owl share the accepted roost meal clock.
root = pivot('OwlBrown'); roots.append(root)
body = pivot('OwlBody', (0, 0, .34), root)
oval('Plump feathered body', (0, 0, 0), (.235, .205, .29), 'owl', body)
oval('Cream speckled bib', (0, -.145, -.015), (.181, .062, .235), 'owlcream', body)
for row in range(4):
    for col in range(3):
        oval('Soft chest feather mark', ((col - 1) * .085, -.207 + abs(col - 1) * .008, -.16 + row * .083), (.013, .006, .024), 'owldark', body, 8, 6)
head = pivot('OwlHead', (0, -.02, .22), body)
oval('Round tawny owl head', (0, 0, .015), (.255, .22, .205), 'owl', head)
for side in [-1, 1]:
    oval('Dark facial disc', (side * .113, -.145, .026), (.133, .077, .142), 'owldark', head)
    oval('Cream heart facial disc', (side * .113, -.198, .027), (.112, .026, .118), 'owlcream', head)
    oval('Amber round eye', (side * .109, -.221, .04), (.052, .022, .055), 'gold', head, 16, 10)
    oval('Large owl pupil', (side * .109, -.241, .043), (.029, .008, .04), 'ink', head, 14, 8)
    oval('Owl eye sparkle', (side * .109 - .009, -.248, .061), (.01, .004, .012), 'shine', head, 10, 6)
    # The little feathery tufts curve inward rather than sharp straight horns.
    lock('Soft ear tuft', (side * .17, .025, .315), .19, .078, 'owl', head, (-side * .045, -.008, .02))
    tube('Expressive brow', [(side * .054, -.209, .125), (side * .125, -.208, .148), (side * .196, -.176, .123)], .019, 'owldark', head, 1)
    wing = pivot('OwlWingLeft' if side < 0 else 'OwlWingRight', (side * .192, .01, .1), body)
    oval('Dark folded wing', (side * .026, .014, -.126), (.084, .159, .216), 'owldark', wing, 16, 10)
    for i in range(4):
        oval('Layered round wing feather', (side * .07, -.042 + i * .032, -.033 - i * .068), (.032, .083, .082), 'owl', wing, 12, 8, (0, side * .17, 0))
    for toe in [-1, 0, 1]:
        tube('Little golden talon', [(side * .09 + toe * .021, 0, -.27), (side * .09 + toe * .024, -.054, -.312), (side * .09 + toe * .027, -.09, -.314)], .0105, 'gold', body, 1)
oval('Small golden beak', (0, -.226, -.065), (.031, .043, .052), 'gold', head, 12, 8)
for x in [-.04, .04]:
    oval('Short owl tail feather', (x, .192, -.13), (.044, .059, .145), 'owldark', body, 12, 8, (-.3, 0, 0))

root = pivot('OwlFeedingPerch'); roots.append(root)
perch_colliders = []
def perch_rod(name, a, b, radius, mat='wood', solid=True):
    ob = tube(name, [a, b], radius, mat, root, 1)
    if solid:
        lo = [min(a[i], b[i]) - radius for i in range(3)]
        hi = [max(a[i], b[i]) + radius for i in range(3)]
        perch_colliders.append({'x': (lo[0] + hi[0]) / 2, 'z': -(lo[1] + hi[1]) / 2, 'w': hi[0] - lo[0], 'd': hi[1] - lo[1], 'bottom': max(0, lo[2]), 'top': hi[2]})
    return ob
def board(name, pos, size, mat, solid=False):
    bpy.ops.mesh.primitive_cube_add()
    ob = bpy.context.object; ob.name = name; ob.parent = root; ob.location = pos; ob.scale = tuple(n / 2 for n in size); ob.data.materials.append(M[mat])
    bevel = ob.modifiers.new('Soft carved edge', 'BEVEL'); bevel.width = .08; bevel.segments = 2
    bpy.context.view_layer.objects.active = ob; bpy.ops.object.modifier_apply(modifier=bevel.name)
    if solid: perch_colliders.append({'x': pos[0], 'z': -pos[1], 'w': size[0], 'd': size[1], 'bottom': pos[2] - size[2] / 2, 'top': pos[2] + size[2] / 2})
    return ob
for x in [-1.65, 1.65]:
    perch_rod('Natural timber roost upright', (x, 0, .08), (x + .09, 0, 2.14), .12, 'darkwood')
    perch_rod('Braced branch', (x, 0, 1.25), (x * .6, 0, 2.05), .075)
    oval('Mossy post footing', (x, 0, .07), (.25, .24, .12), 'stone', root)
perch_rod('Wide carved roost crossbar', (-2.15, 0, 2.15), (2.15, 0, 2.15), .13)
board('Open log feeding tray', (0, -1.25, .5), (2.35, .58, .14), 'darkwood', True)
for y in [-.96, -1.54]: perch_rod('Tray long lip', (-1.22, y, .65), (1.22, y, .65), .07)
for x in [-1.23, 1.23]: perch_rod('Tray short lip', (x, -.96, .65), (x, -1.54, .65), .07)
for x in [-.86, .86]: perch_rod('Little tray leg', (x, -1.25, .03), (x, -1.25, .45), .07, 'darkwood')
board('Sage owl plaque', (2.05, -.15, 1.05), (.74, .064, .48), 'sage')
perch_rod('Plaque timber stake', (2.05, -.15, .04), (2.05, -.15, 1.04), .04, 'darkwood', False)
oval('Little cream owl plaque symbol', (2.05, -.191, 1.04), (.12, .012, .15), 'owlcream', root, 12, 8)
for side in [-1, 1]:
    oval('Plaque owl eyes', (2.05 + side * .044, -.206, 1.08), (.023, .006, .024), 'darkwood', root, 8, 6)
root['townColliders'] = json.dumps(perch_colliders)

# Tiny forage gifts use their real dimensions rather than editor-only oversized copies.
root = pivot('ForageApple'); roots.append(root)
vertices = []
for ring in range(13):
    t = ring * math.pi / 12
    for i in range(24):
        a = i * math.tau / 24
        radius = .116 * math.sin(t) * (1 + .055 * math.cos(a * 5))
        z = .112 + .112 * math.cos(t) - .024 * math.exp(-(t / .38) ** 2) + .013 * math.exp(-((math.pi - t) / .3) ** 2)
        vertices.append((math.cos(a) * radius, math.sin(a) * radius, z))
floor_z = min(v[2] for v in vertices)
vertices = [(x, y, z - floor_z) for x, y, z in vertices]
faces = [(ring * 24 + i, ring * 24 + (i + 1) % 24, (ring + 1) * 24 + (i + 1) % 24, (ring + 1) * 24 + i) for ring in range(12) for i in range(24)]
mesh('Soft five-lobed rosy apple', vertices, faces, 'apple', root)
tube('Little brown apple stem', [(0, 0, .185), (.003, .001, .224), (.015, .002, .246)], .006, 'darkwood', root, 1)
oval('Curved green apple leaf', (.041, .003, .226), (.053, .018, .006), 'appleleaf', root, 12, 8, (0, .3, -.22))
tube('Apple leaf vein', [(.007, .003, .237), (.046, .001, .225), (.08, -.005, .216)], .0016, 'sage', root, 1)

root = pivot('ForageMushroom'); roots.append(root)
oval('Plump cream mushroom stem', (0, 0, .075), (.039, .038, .075), 'mushroomcream', root, 14, 10)
profile = [(0, .236), (.042, .229), (.082, .213), (.115, .191), (.126, .167), (.119, .153), (.078, .157), (0, .163)]
vertices = [(math.cos(i * math.tau / 24) * radius, math.sin(i * math.tau / 24) * radius, z) for radius, z in profile for i in range(24)]
faces = [(row * 24 + i, row * 24 + (i + 1) % 24, (row + 1) * 24 + (i + 1) % 24, (row + 1) * 24 + i) for row in range(len(profile) - 1) for i in range(24)]
mesh('Round chestnut mushroom cap', vertices, faces, 'mushroom', root)
for i in range(7):
    a = i * 2.399963
    radius = .028 + (i % 3) * .025
    for (r0, z0), (r1, z1) in zip(profile[:4], profile[1:5]):
        if r0 <= radius <= r1:
            slope = (z1 - z0) / (r1 - r0)
            z = z0 + (radius - r0) * slope
            tilt = math.atan(-slope)
            oval('Tiny cream cap fleck', (math.cos(a) * radius, math.sin(a) * radius, z + .0006), (.012 + i % 2 * .004, .009, .0015), 'mushroomcream', root, 8, 6, (-tilt * math.sin(a), tilt * math.cos(a), a))
            break

painted = bpy.data.materials.new('Painted soft town colors'); painted.use_nodes = True
painted_shader = painted.node_tree.nodes.get('Principled BSDF'); painted_shader.inputs['Roughness'].default_value = .94
color_node = painted.node_tree.nodes.new('ShaderNodeVertexColor'); color_node.layer_name = 'Color'
painted.node_tree.links.new(color_node.outputs['Color'], painted_shader.inputs['Base Color'])

def batch_model(root):
    # Bake the palette and batch each articulated joint, keeping glossy eyes distinct.
    for parent in [root, *[ob for ob in root.children_recursive if ob.type == 'EMPTY']]:
        by_material = {}
        for child in list(parent.children):
            if child.type != 'MESH': continue
            original = child.data.materials[0]
            glossy = original == M['ink']
            if not glossy:
                color = child.data.color_attributes.new(name='Color', type='FLOAT_COLOR', domain='CORNER')
                for value in color.data: value.color = original.diffuse_color
                child.data.materials.clear(); child.data.materials.append(painted)
            by_material.setdefault('glossy-eyes' if glossy else 'painted-coat', []).append(child)
        for name, objects in by_material.items():
            bpy.ops.object.select_all(action='DESELECT')
            for ob in objects: ob.select_set(True)
            bpy.context.view_layer.objects.active = objects[0]
            if len(objects) > 1: bpy.ops.object.join()
            bpy.context.object.name = parent.name + '-' + name
    bpy.context.view_layer.update()

for root in roots: batch_model(root)
out = ROOT / 'public/village/models/farm-animals.glb'
out.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action='DESELECT')
for root in roots:
    root.select_set(True)
    for ob in root.children_recursive: ob.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(out), export_format='GLB', use_selection=True, export_animations=False, export_yup=True, export_extras=True)

manifest = {'file': 'farm-animals.glb', 'sha256': hashlib.sha256(out.read_bytes()).hexdigest(), 'bytes': out.stat().st_size, 'forward': '+Z', 'pivot': 'floor', 'models': []}
for root in roots:
    vertices = []
    meshes = [ob for ob in root.children_recursive if ob.type == 'MESH']
    triangles = sum(sum(len(face.vertices) - 2 for face in ob.data.polygons) for ob in meshes)
    for ob in meshes:
        vertices.extend(root.matrix_world.inverted() @ ob.matrix_world @ Vector(corner) for corner in ob.bound_box)
    bounds = [[min(v[i] for v in vertices) for i in range(3)], [max(v[i] for v in vertices) for i in range(3)]]
    manifest['models'].append({'root': root.name, 'meshes': len(meshes), 'triangles': triangles, 'blenderBounds': bounds, 'rootScale': list(root.scale), 'dimensions': [(bounds[1][i] - bounds[0][i]) * root.scale[i] for i in range(3)], 'joints': [ob.name for ob in root.children_recursive if ob.type == 'EMPTY']})
(ROOT / 'docs/village/farm-animals-manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')

# Save the editable source and a lit authoring sheet after exporting clean pivots.
sheet_x = {'CowHighland': -4, 'CowHighlandGirl': -1.8, 'Sheep': .35, 'Lamb': 1.7, 'Hedgehog': 2.65, 'OwlBrown': 4, 'OwlFeedingPerch': 4, 'ForageApple': 3.15, 'ForageMushroom': 3.55}
for root in roots:
    root.location.x = sheet_x[root.name]
    if root.name == 'OwlBrown': root.location.z = 2.28
world = bpy.data.worlds.new('Soft meadow studio'); bpy.context.scene.world = world; world.use_nodes = True
world.node_tree.nodes.get('Background').inputs[0].default_value = (.26, .32, .28, 1)
M['studio'] = material('Sage studio floor', '#7d9380')
bpy.ops.mesh.primitive_plane_add(size=200, location=(0, 0, -.03)); floor = bpy.context.object; floor.data.materials.append(M['studio'])
def aim(ob, target): ob.rotation_euler = (Vector(target) - ob.location).to_track_quat('-Z', 'Y').to_euler()
for name, position, energy, size in [('Key', (-3, -4, 6), 900, 5), ('Fill', (4, -2, 4), 550, 4), ('Rim', (0, 4, 5), 1000, 4)]:
    data = bpy.data.lights.new(name, 'AREA'); data.energy = energy; data.shape = 'DISK'; data.size = size
    ob = bpy.data.objects.new(name, data); bpy.context.collection.objects.link(ob); ob.location = position; aim(ob, (0, 0, .7))
data = bpy.data.cameras.new('Town animal sheet'); camera = bpy.data.objects.new('Town animal sheet', data); bpy.context.collection.objects.link(camera)
camera.location = (3.1, -8, 4.1); aim(camera, (0, 0, 1.05)); data.type = 'ORTHO'; data.ortho_scale = 13.0
scene = bpy.context.scene; scene.camera = camera; scene.render.engine = 'CYCLES'; scene.cycles.samples = 24
scene.render.resolution_x = 1600; scene.render.resolution_y = 800; scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'; scene.render.filepath = str(ROOT / 'docs/village/evidence/farm-animals-blender.png')
source = ROOT / 'assets/village/farm-animals.blend'; source.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=str(source)); bpy.ops.render.render(write_still=True)
# Close portraits make tiny expressions and silhouettes reviewable before integration.
scene.render.resolution_x = scene.render.resolution_y = 800
for active in roots:
    if active.name not in ('CowHighland', 'CowHighlandGirl', 'ForageApple', 'ForageMushroom'): continue
    for other in roots:
        other.hide_render = other != active
        for child in other.children_recursive: child.hide_render = other != active
    active.location = (0, 0, 0)
    bpy.context.view_layer.update()
    height = max((ob.matrix_world @ Vector(corner)).z for ob in active.children_recursive if ob.type == 'MESH' for corner in ob.bound_box)
    size = {'CowHighland': 3.5, 'CowHighlandGirl': 3.5, 'ForageApple': .38, 'ForageMushroom': .38}[active.name]
    camera.location = (size * .56, -size, size * .5); aim(camera, (0, 0, height * .42)); data.ortho_scale = size
    scene.render.filepath = str(ROOT / 'docs/village/evidence' / (active.name.lower() + '-blender.png'))
    bpy.ops.render.render(write_still=True)
    if active.name.startswith('CowHighland'):
        for view, position in [('front', (0, -size, size * .42)), ('side', (size, -size * .08, size * .42))]:
            camera.location = position; aim(camera, (0, 0, height * .43)); data.ortho_scale = size
            scene.render.filepath = str(ROOT / 'docs/village/evidence' / (active.name.lower() + '-' + view + '-blender.png'))
            bpy.ops.render.render(write_still=True)
print('FARM_ANIMALS_EXPORTED', json.dumps(manifest))
