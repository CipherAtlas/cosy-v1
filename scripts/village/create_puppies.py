"""Original sculpted, skinned puppy kit and authored performance clips.

Run with an isolated Blender background process. Z up, -Y forward; glTF
converts to the village's Y up, +Z forward. Protected layouts are never touched.
"""
import bpy
import hashlib
import json
import math
from pathlib import Path
from mathutils import Matrix, Vector, Quaternion

ROOT = Path(__file__).resolve().parents[2]
bpy.ops.wm.read_factory_settings(use_empty=True)
FPS = 30
CLIPS = {"idle": 4, "walk": 1, "run": .6, "pet": 3, "sit": 7,
         "dance": 5.2, "spin": 3.2, "bow": 3.8, "wave": 4.2, "roll": 4.6}
PALETTE = {"corgi": "#ce8a4b", "corgi_dark": "#ac683b", "shiba": "#bf6c35",
           "shiba_dark": "#94512f", "beagle": "#b67a4e", "beagle_dark": "#343037",
           "samoyed": "#f1eee1", "samoyed_shade": "#d6d3c8", "collie": "#343a43", "collie_dark": "#202832",
           "shepherd": "#b9814a", "shepherd_dark": "#303038", "cream": "#fff0d6",
           "white": "#fffaf0", "pink": "#d99591", "tongue": "#df8490",
           "nose": "#28313b", "eye": "#19252d", "iris": "#5d3e2a", "shine": "#fffdf6",
           "teal": "#4f9590", "rose": "#bd7482", "blue": "#708eae", "gold": "#d6a656", "sage": "#759279", "plum": "#88779a"}

def linear(hex_color):
    rgb = [int(hex_color[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return tuple(v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4 for v in rgb) + (1,)

COLORS = {key: linear(value) for key, value in PALETTE.items()}

def painted_material(name, roughness, metallic=0):
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    shader = next(n for n in material.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    shader.inputs["Roughness"].default_value = roughness
    shader.inputs["Metallic"].default_value = metallic
    color = material.node_tree.nodes.new("ShaderNodeVertexColor")
    color.layer_name = "Color"
    material.node_tree.links.new(color.outputs["Color"], shader.inputs["Base Color"])
    return material

FUR = painted_material("Soft painted coat", .78)
EYES = painted_material("Glossy eyes and nose", .22)
TRIM = painted_material("Woven collars and brass tags", .4, .18)


def select(obj):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def oval(name, location, scale, segments=20, rings=12):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=True, rotation=False, scale=True)
    return obj


def sculpt(name, shapes, voxel=.026):
    pieces = [oval(name, *shape) for shape in shapes]
    bpy.ops.object.select_all(action="DESELECT")
    for obj in pieces:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = pieces[0]
    bpy.ops.object.join()
    obj = pieces[0]
    obj.name = name
    remesh = obj.modifiers.new("Continuous sculpt", "REMESH")
    remesh.mode = "VOXEL"
    remesh.voxel_size = voxel
    remesh.use_smooth_shade = True
    bpy.ops.object.modifier_apply(modifier=remesh.name)
    smooth = obj.modifiers.new("Soft sculpt finish", "SMOOTH")
    smooth.factor = 1.1
    smooth.iterations = 5
    bpy.ops.object.modifier_apply(modifier=smooth.name)
    decimate = obj.modifiers.new("Game topology", "DECIMATE")
    decimate.ratio = .28
    bpy.ops.object.modifier_apply(modifier=decimate.name)
    return obj


def tube(name, points, radius, sides=10):
    verts, faces = [], []
    for i, xyz in enumerate(points):
        center = Vector(xyz)
        tangent = Vector(points[min(i + 1, len(points) - 1)]) - Vector(points[max(0, i - 1)])
        axis = tangent.normalized().cross(Vector((1, 0, 0))).normalized()
        other = tangent.normalized().cross(axis).normalized()
        width = radius * (math.sin(math.pi * i / (len(points) - 1)) ** .4 * .9 + .1)
        for j in range(sides):
            angle = j * math.tau / sides
            verts.append(center + width * (axis * math.cos(angle) + other * math.sin(angle)))
    for i in range(len(points) - 1):
        for j in range(sides):
            a = i * sides + j
            b = i * sides + (j + 1) % sides
            faces.append((a, b, b + sides, a + sides))
    faces.extend([tuple(reversed(range(sides))), tuple(range(len(verts) - sides, len(verts)))])
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    return obj


def ear_mesh(name, side, anchor, height, width):
    verts, faces = [], []
    rings, sides = 12, 16
    for i in range(rings + 1):
        t = i / rings
        w = width * (1 - t) ** .65 * (.75 + .3 * math.sin(math.pi * t)) + .003
        for j in range(sides):
            angle = math.tau * j / sides
            verts.append((anchor[0] + side * .08 * t + w * math.cos(angle),
                          anchor[1] + .018 + .07 * t + w * .40 * math.sin(angle),
                          anchor[2] + height * t))
    for i in range(rings):
        for j in range(sides):
            a = i * sides + j
            b = i * sides + (j + 1) % sides
            faces.append((a, b, b + sides, a + sides))
    faces.extend([tuple(reversed(range(sides))), tuple(range(len(verts) - sides, len(verts)))])
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    select(obj)
    subdivision = obj.modifiers.new("Rounded ear rim", "SUBSURF")
    subdivision.levels = 1
    bpy.ops.object.modifier_apply(modifier=subdivision.name)
    return obj


def smoothstep(a, b, value):
    x = max(0, min(1, (value - a) / (b - a)))
    return x * x * (3 - 2 * x)


def coat_color(breed, region, point, h):
    x, y, z = point
    base = Vector(COLORS[breed][:3])
    cream = Vector(COLORS["white" if breed == "beagle" else "cream"][:3])
    if breed == "samoyed":
        cream = Vector(COLORS["white"][:3])
    if breed == "collie":
        cream = Vector(COLORS["white"][:3])
    if region == "body":
        bib = (1 - smoothstep(-.27, -.1, y)) * (1 - smoothstep(h + .08, h + .22, z))
        belly = 1 - smoothstep(h - .19, h - .10, z)
        light = max(bib, belly * .85)
        saddle = smoothstep(h + .04, h + .18, z) * smoothstep(-.22, -.06, y)
        base = base.lerp(Vector(COLORS[breed + ("_shade" if breed == "samoyed" else "_dark")][:3]), saddle * (.95 if breed in ("beagle", "shepherd") else .38))
        if breed == "shepherd":
            light *= .15
    else:
        hz = h + .31
        cheek = (1 - smoothstep(hz - .13, hz - .03, z)) * (1 - smoothstep(-.13, -.02, y + .44))
        blaze = (1 - smoothstep(.033, .09, abs(x))) * (1 - smoothstep(-.58, -.44, y))
        light = max(cheek, blaze * (1 if breed in ("corgi", "beagle", "collie") else 0))
        if breed == "shepherd":
            mask = (1 - smoothstep(-.59, -.40, y)) * (1 - smoothstep(hz + .09, hz + .18, z))
            base = base.lerp(Vector(COLORS["shepherd_dark"][:3]), mask * .92)
            light *= .1
    color = base.lerp(cream, light)
    # Small continuous tonal variations read as painted fur without extra patches.
    color *= .97 + .035 * math.sin(x * 17 + z * 12) * math.sin(y * 14)
    return tuple(color) + (1,)


def bind(obj, rig, weights, color, material=FUR):
    obj.parent = rig
    for face in obj.data.polygons:
        face.use_smooth = True
    attr = obj.data.color_attributes.new(name="Color", type="FLOAT_COLOR", domain="CORNER")
    for polygon in obj.data.polygons:
        for loop_index in polygon.loop_indices:
            point = obj.data.vertices[obj.data.loops[loop_index].vertex_index].co
            attr.data[loop_index].color = color(point) if callable(color) else COLORS[color]
    obj.data.materials.append(material)
    groups = {}
    for vertex in obj.data.vertices:
        influences = weights(vertex.co) if callable(weights) else {weights: 1}
        for name, weight in influences.items():
            if weight <= .001:
                continue
            if name not in groups:
                groups[name] = obj.vertex_groups.new(name=name)
            groups[name].add([vertex.index], weight, "REPLACE")
    modifier = obj.modifiers.new("Puppy skeleton", "ARMATURE")
    modifier.object = rig
    return obj


def make_rig(name, h, short, long_tail=False):
    data = bpy.data.armatures.new(name + "Skeleton")
    rig = bpy.data.objects.new(name + "Rig", data)
    bpy.context.collection.objects.link(rig)
    select(rig)
    bpy.ops.object.mode_set(mode="EDIT")
    def bone(label, head, tail=None, parent=None):
        result = data.edit_bones.new(name + label)
        result.head = head
        result.tail = tail or Vector(head) + Vector((0, 0, .12))
        if parent:
            result.parent = data.edit_bones[name + parent]
        return result
    bone("Motion", (0, 0, 0))
    bone("Body", (0, .28, h), parent="Motion")
    bone("Chest", (0, -.22, h + .02), parent="Body")
    bone("Head", (0, -.43, h + .31), parent="Chest")
    bone("Jaw", (0, -.67, h + .13), parent="Head")
    for side, suffix in [(-1, "Left"), (1, "Right")]:
        bone("Eye" + suffix, (side * .158, -.692, h + .375), parent="Head")
        bone("Ear" + suffix, (side * .235, -.39, h + .49), parent="Head")
        bone("EarTip" + suffix, (side * .255, -.39, h + .62), parent="Ear" + suffix)
    legs = []
    for front in [True, False]:
        for side, suffix in [(-1, "Left"), (1, "Right")]:
            label = ("Front" if front else "Back") + suffix
            hip = Vector((side * .235, -.26 if front else .32, h - .06))
            knee = hip.lerp(Vector((side * .235, hip.y, .095)), .53)
            knee.y += .045 if front else -.055
            ankle = Vector((side * .235, hip.y, .095))
            bone("Leg" + label, hip, knee, "Chest" if front else "Body")
            bone("Shin" + label, knee, ankle, "Leg" + label)
            bone("Paw" + label, ankle, parent="Shin" + label)
            legs.append((label, hip, knee, ankle, front))
    tail = (0, .54 if short else .48, h + .12)
    bone("Tail", tail, parent="Body")
    bone("TailMid", (0, tail[1] + (.25 if long_tail else .15), tail[2] + (-.08 if long_tail else .12)), parent="Tail")
    bone("TailTip", (0, tail[1] + (.5 if long_tail else .25), tail[2] + (-.02 if long_tail else .27)), parent="TailMid")
    bpy.ops.object.mode_set(mode="OBJECT")
    for pose in rig.pose.bones:
        pose.rotation_mode = "QUATERNION"
    return rig, legs


def puppy(name, breed, collar):
    short, fluffy, floppy = breed == "corgi", breed == "samoyed", breed == "beagle"
    long_tail = breed in ("collie", "shepherd")
    h = .46 if short else .61 if breed == "collie" else .65 if breed == "shepherd" else .57
    root = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(root)
    rig, legs = make_rig(name, h, short, long_tail)
    rig.parent = root
    objects = []
    def add(obj, bone, color, mat=FUR):
        objects.append(bind(obj, rig, (name + bone) if isinstance(bone, str) else bone, color, mat))
    body_shapes = [((0, .13, h), (.32 if short else .285, .49 if short else .40, .29)),
                   ((0, -.22, h + .045), (.29, .25, .30)),
                   ((0, -.32, h + .12), (.255, .22, .29))]
    if fluffy:
        body_shapes += [((side * .245, -.27, h + .01), (.15, .19, .20)) for side in [-1, 1]]
        body_shapes += [((side * (.26 + i * .023), -.20 + i * .11, h - .035), (.075, .11, .10)) for side in [-1, 1] for i in range(3)]
        body_shapes += [((side * .17, -.39, h - .12), (.16, .15, .19)) for side in [-1, 1]]
    if breed == "collie":
        body_shapes += [((side * .20, -.33, h -.02), (.13, .17, .21)) for side in [-1, 1]]
    body = sculpt(name + "Coat", body_shapes, .024)
    add(body, lambda p: {name + "Body": smoothstep(-.23, .16, p.y), name + "Chest": 1 - smoothstep(-.23, .16, p.y)},
        lambda p: coat_color(breed, "body", p, h))
    hz = h + .31
    head_shapes = [((0, -.46, hz), (.32, .29, .305)),
                   ((0, -.68, hz - .115), (.20, .155, .125)),
                   ((-.105, -.72, hz - .105), (.12, .10, .09)),
                   ((.105, -.72, hz - .105), (.12, .10, .09))]
    if fluffy:
        head_shapes += [((side * .25, -.47, hz - .105), (.13, .18, .13)) for side in [-1, 1]]
    head = sculpt(name + "Face", head_shapes, .019)
    add(head, "Head", lambda p: coat_color(breed, "head", p, h))
    add(oval("Rounded heart nose", (0, -.835, hz - .064), (.075, .037, .049)), "Head", "nose", EYES)
    add(oval("Nose highlight", (-.02, -.869, hz - .047), (.017, .003, .006), 12, 8), "Head", "samoyed_shade", EYES)
    add(oval("Soft lower muzzle", (0, -.717, hz - .205), (.142, .108, .061)), "Jaw", "cream" if not floppy else "white")
    smile = [(-.12, -.798, hz - .177), (-.07, -.821, hz - .198), (0, -.827, hz - .205), (.07, -.821, hz - .198), (.12, -.798, hz - .177)]
    add(tube("Smile", smile, .007, 8), "Jaw", "nose")
    add(oval("Little tongue", (0, -.82, hz - .223), (.037, .015, .047), 16, 10), "Jaw", "tongue")
    for side, suffix in [(-1, "Left"), (1, "Right")]:
        eye = (side * .158, -.692, hz + .065)
        add(oval("Eye socket", (eye[0], eye[1] + .015, eye[2]), (.077, .037, .084)), "Head", breed + ("_shade" if fluffy else "_dark"))
        add(oval("Warm glossy eye", eye, (.059, .036, .068)), "Eye" + suffix, "eye", EYES)
        add(oval("Eye warm lower edge", (eye[0], eye[1] - .027, eye[2] - .021), (.040, .009, .025), 16, 10), "Eye" + suffix, "iris", EYES)
        add(oval("Wide pupil", (eye[0], eye[1] - .031, eye[2] + .004), (.040, .011, .051), 16, 10), "Eye" + suffix, "eye", EYES)
        add(oval("Large eye glint", (eye[0] - .016, eye[1] - .042, eye[2] + .025), (.014, .006, .018), 12, 8), "Eye" + suffix, "shine", EYES)
        add(oval("Small eye glint", (eye[0] + .018, eye[1] - .037, eye[2] - .015), (.006, .003, .007), 10, 6), "Eye" + suffix, "shine", EYES)
        brow = [(side * .10, -.687, hz + .159), (side * .15, -.682, hz + .17), (side * .205, -.652, hz + .151)]
        add(tube("Soft eyebrow", brow, .013, 8), "Head", "cream" if breed != "samoyed" else "samoyed_shade")
        anchor = Vector((side * .235, -.39, h + .49))
        if floppy:
            ear = sculpt("Velvet folded ear", [((side * .295, -.385, hz + .035), (.106, .105, .22)),
                                                    ((side * .315, -.405, hz - .135), (.085, .089, .11))], .021)
            add(ear, lambda p, suffix=suffix: {name + "Ear" + suffix: smoothstep(hz - .11, hz + .13, p.z), name + "EarTip" + suffix: 1 - smoothstep(hz - .11, hz + .13, p.z)}, "beagle_dark")
        else:
            height = .32 if short else .36 if breed == "shepherd" else .245 if not fluffy else .205
            ear = ear_mesh("Rounded triangular ear", side, anchor, height, .135 if short else .115)
            if breed == "collie":
                for vertex in ear.data.vertices:
                    tip = smoothstep(anchor.z + .11, anchor.z + height, vertex.co.z)
                    vertex.co.y -= .095 * tip
                    vertex.co.z -= .055 * tip
            def ear_color(p, anchor=anchor, height=height):
                t = (p.z - anchor.z) / height
                inside = (1 - smoothstep(anchor.y + .008, anchor.y + .035, p.y)) * smoothstep(.09, .25, t) * (1 - smoothstep(.76, .93, t))
                outside = Vector(COLORS[breed][:3])
                if breed == "shepherd":
                    outside = outside.lerp(Vector(COLORS["shepherd_dark"][:3]), smoothstep(.45, .85, t))
                return tuple(outside.lerp(Vector(COLORS["pink"][:3]), inside * (.5 if breed == "shepherd" else 1))) + (1,)
            add(ear, lambda p, suffix=suffix, anchor=anchor: {name + "Ear" + suffix: 1 - smoothstep(anchor.z + .07, anchor.z + .22, p.z), name + "EarTip" + suffix: smoothstep(anchor.z + .07, anchor.z + .22, p.z)}, ear_color)
        for i in range(3 if fluffy else 2):
            # Rounded tapered cheek wisps stay part of the head silhouette.
            add(oval("Cheek fur", (side * (.26 + .026 * i), -.445 + .025 * i, hz - .12 - .028 * i), (.069, .095, .045), 12, 8), "Head", "white" if fluffy else "cream")
    for label, hip, knee, ankle, front in legs:
        side = -1 if "Left" in label else 1
        limb = sculpt("Soft articulated leg", [((hip.x, hip.y, hip.z - .06), (.105, .12, .14)),
                                                   (tuple(knee), (.079, .087, .13)),
                                                   ((ankle.x, ankle.y - .017, .13), (.076, .081, .11)),
                                                   ((ankle.x, ankle.y - .055, .055), (.107, .136, .059))], .019)
        def leg_weights(p, label=label, knee=knee):
            upper = smoothstep(knee.z - .025, knee.z + .075, p.z)
            paw = 1 - smoothstep(.085, .155, p.z)
            return {name + "Leg" + label: upper * (1 - paw), name + "Shin" + label: (1 - upper) * (1 - paw), name + "Paw" + label: paw}
        def leg_color(p, front=front):
            white = 1 - smoothstep(.10, .3 if floppy or breed == "collie" else .19, p.z)
            if breed == "shepherd":
                white *= .15
            return tuple(Vector(COLORS[breed][:3]).lerp(Vector(COLORS["white" if floppy or fluffy or breed == "collie" else "cream"][:3]), white)) + (1,)
        add(limb, leg_weights, leg_color)
        for offset in [-.035, .035]:
            add(tube("Paw crease", [(ankle.x + offset, ankle.y - .179, .049), (ankle.x + offset, ankle.y - .172, .068), (ankle.x + offset, ankle.y - .152, .083)], .003, 6), "Paw" + label, "samoyed_shade" if fluffy else "corgi_dark")
        for dx in [-.035, .035]:
            add(oval("Paw pads", (ankle.x + dx, ankle.y - .105, .005), (.024, .031, .007), 10, 6), "Paw" + label, "pink")
    tail_origin = rig.data.bones[name + "Tail"].head_local
    if short:
        points = [tail_origin + Vector((0, t * .19, .07 * math.sin(t * math.pi / 2))) for t in [i / 12 for i in range(13)]]
        radius = .09
    elif breed == "shiba" or fluffy:
        points = [tail_origin + Vector((0, .18 * math.sin(t * math.pi), .30 * t)) for t in [i / 18 for i in range(19)]]
        radius = .125 if fluffy else .088
    elif long_tail:
        points = [tail_origin + Vector((0, t * .55, -.14 * math.sin(t * math.pi) + .035 * t)) for t in [i / 18 for i in range(19)]]
        radius = .095 if breed == "collie" else .085
    else:
        points = [tail_origin + Vector((0, t * .25, t * .35)) for t in [i / 14 for i in range(15)]]
        radius = .061
    tail = tube("Flowing tail", points, radius, 14)
    def tail_weights(p):
        t = max(0, min(1, (p.y - tail_origin.y) / .55 if long_tail else (p.z - tail_origin.z) / .32))
        a, b = 1 - smoothstep(.05, .5, t), smoothstep(.5, .95, t)
        return {name + "Tail": a, name + "TailMid": 1 - a - b, name + "TailTip": b}
    add(tail, tail_weights, lambda p: tuple(Vector(COLORS["shepherd_dark" if breed == "shepherd" else breed][:3]).lerp(Vector(COLORS["white" if floppy or fluffy or breed == "collie" else "cream"][:3]), (smoothstep(tail_origin.y + .39, tail_origin.y + .52, p.y) if long_tail else smoothstep(tail_origin.z + .20, tail_origin.z + .30, p.z)) * (0 if breed == "shepherd" else 1))) + (1,))
    # A real band around the neck, rather than a flat sphere across the chest.
    bpy.ops.mesh.primitive_torus_add(major_segments=32, minor_segments=8, major_radius=.256, minor_radius=.025, location=(0, -.32, h + .18), rotation=(math.pi / 2, 0, 0))
    band = bpy.context.object
    band.scale.z = .80
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    add(band, "Chest", collar, TRIM)
    add(oval("Brass tag", (0, -.597, h + .09), (.041, .018, .053), 16, 10), "Chest", "gold", TRIM)
    add(oval("Tag paw stamp", (0, -.615, h + .095), (.012, .002, .014), 12, 8), "Chest", "nose", TRIM)
    # One skinned mesh per dog, three material primitives. All bones remain editable.
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.join()
    objects[0].name = name + "Skin"
    return root, rig, legs, h


def rotation(x=0, y=0, z=0):
    return Matrix.Rotation(z, 4, "Z") @ Matrix.Rotation(y, 4, "Y") @ Matrix.Rotation(x, 4, "X")


def transform_about(point, rot, offset=(0, 0, 0)):
    return Matrix.Translation(Vector(point) + Vector(offset)) @ rot @ Matrix.Translation(-Vector(point))


def pose_bone(rig, label, transform):
    bone = rig.pose.bones[rig.parent.name + label]
    bone.matrix = transform @ bone.bone.matrix_local
    bpy.context.view_layer.update()


def solve_leg(rig, leg, anchor_transform, foot, paw_rot=None, bow=0):
    label, hip_rest, knee_rest, ankle_rest, front = leg
    hip = anchor_transform @ hip_rest
    goal = Vector(foot)
    upper_length, lower_length = (knee_rest - hip_rest).length, (ankle_rest - knee_rest).length
    direction = goal - hip
    length = max(.03, min(direction.length, upper_length + lower_length - .001))
    direction.normalize()
    goal = hip + direction * length
    along = (upper_length ** 2 - lower_length ** 2 + length ** 2) / (2 * length)
    height = math.sqrt(max(0, upper_length ** 2 - along ** 2))
    bend = Vector(((-1 if "Left" in label else 1) * .35 * bow, 1 if front else -1, 2 * bow if front else 0))
    bend = (bend - direction * bend.dot(direction)).normalized()
    knee = hip + direction * along + bend * height
    def joint_matrix(label, origin, rest_vec, posed_vec):
        turn = rest_vec.rotation_difference(posed_vec).to_matrix().to_4x4()
        rest = rig.data.bones[rig.parent.name + label].matrix_local
        rig.pose.bones[rig.parent.name + label].matrix = Matrix.Translation(origin) @ turn @ rest.to_3x3().to_4x4()
        bpy.context.view_layer.update()
    joint_matrix("Leg" + label, hip, knee_rest - hip_rest, knee - hip)
    joint_matrix("Shin" + label, knee, ankle_rest - knee_rest, goal - knee)
    rest = rig.data.bones[rig.parent.name + "Paw" + label].matrix_local
    rig.pose.bones[rig.parent.name + "Paw" + label].matrix = Matrix.Translation(goal) @ (paw_rot or Matrix.Identity(4)) @ rest.to_3x3().to_4x4()
    bpy.context.view_layer.update()


def envelope(t, duration, enter=.55, leave=.55):
    return smoothstep(0, enter, t) * (1 - smoothstep(duration - leave, duration, t))


def performance(rig, legs, h, clip, t):
    name = rig.parent.name
    duration = CLIPS[clip]
    for bone in rig.pose.bones:
        bone.matrix_basis.identity()
    e = envelope(t, duration)
    body_point = (0, .28, h)
    body_rot, body_offset = rotation(), Vector((0, 0, 0))
    head_rot, head_offset = rotation(), Vector((0, 0, 0))
    motion = Matrix.Identity(4)
    gait, lift = 0, 0
    if clip in ("idle", "pet"):
        breath = math.sin(t * math.tau / (4 if clip == "idle" else 1.3))
        body_offset.z = .008 * breath
        head_rot = rotation(x=.035 * breath, y=.035 * math.sin(t * math.tau / duration), z=.04 * math.sin(t * math.tau / duration))
        if clip == "pet":
            body_offset.y = -.035 * e
            head_rot = rotation(x=-.13 * e, y=.17 * math.sin(t * 3) * e, z=.07 * math.sin(t * 4) * e)
    elif clip in ("walk", "run"):
        gait = t * math.tau / duration
        lift = .055 if clip == "walk" else .105
        body_offset.z = (.009 if clip == "walk" else .022) * math.sin(gait * 2)
        body_rot = rotation(x=.015 * math.sin(gait * 2), y=.014 * math.sin(gait))
        head_rot = rotation(x=-.018 * math.sin(gait * 2), z=.022 * math.sin(gait))
    elif clip in ("sit", "wave"):
        body_offset = Vector((0, .065 * e, -.18 * e))
        body_rot = rotation(x=-.36 * e)
        head_rot = rotation(x=.11 * e, y=.10 * math.sin(t * 1.8) * e)
    elif clip == "dance":
        beat = t * math.tau / .64
        body_rot = rotation(x=-.98 * e, y=.075 * math.sin(beat) * e, z=.11 * math.sin(beat * .5) * e)
        body_offset = Vector((.025 * math.sin(beat * .5) * e, .02 * e, .042 * (.5 + .5 * math.sin(beat * 2)) * e))
        head_rot = rotation(x=.69 * e, y=.12 * math.sin(beat * .5 + .6) * e, z=-.05 * math.sin(beat * .5) * e)
    elif clip == "spin":
        progress = smoothstep(.4, duration - .45, t)
        motion = rotation(z=-math.tau * 2 * progress)
        gait = t * math.tau / .55
        lift = .045 * e
        body_rot = rotation(y=.055 * math.sin(gait) * e)
        head_rot = rotation(z=.10 * e)
    elif clip == "bow":
        body_rot = rotation(x=.22 * e)
        body_offset.z = -.065 * e
        head_rot = rotation(x=-.09 * e, y=.10 * math.sin(t * 2) * e)
    elif clip == "roll":
        crouch = envelope(t, duration, .6, .7)
        turn = smoothstep(.9, 3.4, t) * math.tau
        body_rot = rotation(x=.10 * crouch, y=turn)
        body_offset.z = -.075 * crouch + .18 * math.sin(turn) ** 2
        head_rot = rotation(x=-.08 * crouch)
    body_transform = motion @ transform_about(body_point, body_rot, body_offset)
    chest_transform = body_transform
    if clip == "bow":
        chest_transform = body_transform @ transform_about((0, -.22, h + .02), rotation(x=.28 * e), (0, 0, -.055 * e))
    pose_bone(rig, "Motion", motion)
    pose_bone(rig, "Body", body_transform)
    pose_bone(rig, "Chest", chest_transform)
    head_point = (0, -.43, h + .31)
    head_transform = chest_transform @ transform_about(head_point, head_rot, head_offset)
    pose_bone(rig, "Head", head_transform)
    for i, leg in enumerate(legs):
        label, hip, knee, ankle, front = leg
        anchor = chest_transform if front else body_transform
        foot = ankle.copy()
        if clip in ("walk", "run", "spin"):
            phase = (t / (duration if clip != "spin" else .55) + ([0, .5, .75, .25][i] if clip == "walk" else [0, .5, .5, 0][i])) % 1
            stride = .2852 if clip == "walk" else .4712 if clip == "run" else .11 * e
            # Stance occupies 62% of the cycle; swing has a zero-slope lift and landing.
            if phase < .62:
                foot.y += -stride / 2 + stride * phase / .62
            else:
                swing = (phase - .62) / .38
                foot.y += stride / 2 - stride * smoothstep(0, 1, swing)
                foot.z += lift * math.sin(math.pi * swing) ** 2
            foot = motion @ foot
        elif clip in ("sit", "wave"):
            if not front:
                foot.y -= .05 * e
                foot.x += (-1 if i == 2 else 1) * .055 * e
            else:
                foot.y -= .07 * e
            if clip == "wave" and i == 0:
                foot.z += (.20 + .055 * math.sin(t * 8)) * e
                foot.y -= .07 * e
                foot.x -= .065 * math.sin(t * 8) * e
        elif clip == "dance":
            if front:
                foot = anchor @ ankle
                foot.z += .055 * math.sin(t * math.tau / .64 + i * math.pi) * e
                foot.y -= .10 * e
                foot.x += (-1 if i == 0 else 1) * .05 * e
            else:
                foot.x += .035 * math.sin(t * math.tau / .64) * e
        elif clip == "bow" and front:
            foot.y -= .13 * e
        elif clip == "roll":
            # Tuck the paws before rolling, then extend them for the recovery.
            foot = body_transform @ ankle
            toward_hip = (body_transform @ hip) - foot
            foot += toward_hip * .38 * e
        paw_rotation = body_rot if clip == "roll" else rotation(x=.30 * e) if clip == "dance" and front else rotation(z=.14 * math.sin(t * 8) * e) if clip == "wave" and i == 0 else rotation()
        solve_leg(rig, leg, anchor, foot, paw_rotation, e if clip == "bow" else 0)
    happy = clip not in ("idle", "walk", "run")
    secondary_time = t if happy else t * math.tau / duration
    wag = math.sin(secondary_time * (16 if happy else 2)) * (.32 if happy else .12)
    for j, label in enumerate(["Tail", "TailMid", "TailTip"]):
        point = rig.data.bones[name + label].head_local
        parent = body_transform if j == 0 else tail_transform
        tail_transform = parent @ transform_about(point, rotation(x=.06 * math.sin(secondary_time * (9 if happy else 2) - j * .55), z=wag * (1 if j == 0 else .55)))
        pose_bone(rig, label, tail_transform)
    for side, suffix in [(-1, "Left"), (1, "Right")]:
        point = rig.data.bones[name + "Ear" + suffix].head_local
        ear_rot = rotation(x=.055 * math.sin(secondary_time * (8 if happy else 2) - side * .5), y=side * .045 * math.sin(secondary_time * (5 if happy else 2)))
        ear_transform = head_transform @ transform_about(point, ear_rot)
        pose_bone(rig, "Ear" + suffix, ear_transform)
        tip = rig.data.bones[name + "EarTip" + suffix].head_local
        pose_bone(rig, "EarTip" + suffix, ear_transform @ transform_about(tip, rotation(x=.085 * math.sin(secondary_time * (8 if happy else 2) - .7))))
        eye_point = rig.data.bones[name + "Eye" + suffix].head_local
        blink_center = 2.25 if clip == "idle" else duration * .68
        blink = max(0, 1 - abs(t - blink_center) / .105)
        scale = Matrix.Diagonal((1, 1, max(.08, 1 - blink * .92), 1))
        pose_bone(rig, "Eye" + suffix, head_transform @ transform_about(eye_point, scale))
    jaw_point = rig.data.bones[name + "Jaw"].head_local
    pose_bone(rig, "Jaw", head_transform @ transform_about(jaw_point, rotation(x=-.055 - (.08 if happy else .022) * (.5 + .5 * math.sin(secondary_time * (7 if happy else 2))))))
    if clip == "roll":
        bpy.context.view_layer.update()
        skin = next(child for child in rig.children if child.type == "MESH")
        evaluated = skin.evaluated_get(bpy.context.evaluated_depsgraph_get())
        lowest = min(point[2] for point in evaluated.bound_box)
        if lowest < .002:
            # Lift the complete pose by its evaluated skin bound, including floppy ears.
            lift_matrix = Matrix.Translation((0, 0, .002 - lowest))
            matrices = [(bone, lift_matrix @ bone.matrix) for bone in rig.pose.bones]
            for bone, matrix in matrices:
                bone.matrix = matrix
                bpy.context.view_layer.update()



def animate(rig, legs, h):
    rig.animation_data_create()
    for clip, duration in CLIPS.items():
        action = bpy.data.actions.new(rig.parent.name + "_" + clip)
        rig.animation_data.action = action
        # Bake the IK-authored pose. Runtime needs no Blender constraints or IK solver.
        frames = round(duration * FPS)
        for frame in range(0, frames + 1, 2):
            bpy.context.scene.frame_set(frame)
            performance(rig, legs, h, clip, frame / FPS)
            for bone in rig.pose.bones:
                bone.keyframe_insert("location", frame=frame, group=bone.name)
                bone.keyframe_insert("rotation_quaternion", frame=frame, group=bone.name)
                bone.keyframe_insert("scale", frame=frame, group=bone.name)
        if frames % 2:
            performance(rig, legs, h, clip, duration)
            for bone in rig.pose.bones:
                for property_name in ["location", "rotation_quaternion", "scale"]:
                    bone.keyframe_insert(property_name, frame=frames, group=bone.name)
        action.use_fake_user = True
        track = rig.animation_data.nla_tracks.new()
        track.name = action.name
        strip = track.strips.new(action.name, 0, action)
        strip.action_frame_start = 0
        strip.action_frame_end = frames
        track.mute = True
    rig.animation_data.action = None
    for bone in rig.pose.bones:
        bone.matrix_basis.identity()


specs = [("Mochi", "corgi", "teal"), ("Kiko", "shiba", "rose"),
         ("Biscuit", "beagle", "blue"), ("Cloud", "samoyed", "gold"),
         ("Fern", "collie", "sage"), ("Atlas", "shepherd", "plum")]
puppies = [puppy(*spec) for spec in specs]
scene = bpy.context.scene
scene.render.fps = FPS
for root, rig, legs, h in puppies:
    print("Authoring performances for " + root.name, flush=True)
    animate(rig, legs, h)
scene.frame_set(0)
source = ROOT / "assets/village/puppies.blend"
output = ROOT / "public/village/models/puppies.glb"
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=str(source))
bpy.ops.export_scene.gltf(filepath=str(output), export_format="GLB", export_yup=True,
                          export_animations=True, export_animation_mode="NLA_TRACKS",
                          export_force_sampling=True, export_frame_step=2,
                          export_optimize_animation_size=True)
manifest = {
    "id": "puppies-v4", "breeds": [spec[1] for spec in specs],
    "source": str(source.relative_to(ROOT)), "runtime": str(output.relative_to(ROOT)),
    "creator": "Original project artwork, Blender " + bpy.app.version_string,
    "license": "Original project artwork; no third-party character assets or textures.",
    "bytes": output.stat().st_size, "sha256": hashlib.sha256(output.read_bytes()).hexdigest(),
    "triangles": sum(len(face.vertices) - 2 for obj in scene.objects if obj.type == "MESH" for face in obj.data.polygons),
    "textures": 0, "bonesPerDog": len(puppies[0][1].data.bones), "materials": 3,
    "clipsPerDog": CLIPS, "rig": "Skinned continuous sculpts, baked two-link leg IK, jaw, eyes, two-part ears and three-part tail",
    "locomotion": {"walkMetersPerCycle": .46, "runMetersPerCycle": .76},
}
(ROOT / "docs/village/puppies-manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
print(json.dumps(manifest), flush=True)
# Lighting and staging are evidence only; they never enter the runtime model.
for (root, rig, legs, h), x in zip(puppies, [-2.9, -1.74, -.58, .58, 1.74, 2.9]):
    root.location.x = x
scene.render.engine = "CYCLES"
scene.cycles.samples = 32
scene.world = bpy.data.worlds.new("Warm studio")
scene.world.use_nodes = True
background = next(n for n in scene.world.node_tree.nodes if n.type == "BACKGROUND")
background.inputs["Color"].default_value = (.64, .67, .62, 1)
background.inputs["Strength"].default_value = .6
bpy.ops.mesh.primitive_plane_add(size=200, location=(0, 0, -.025))
floor = bpy.context.object
floor_material = bpy.data.materials.new("Warm stone")
floor_material.use_nodes = True
next(n for n in floor_material.node_tree.nodes if n.type == "BSDF_PRINCIPLED").inputs["Base Color"].default_value = (.59, .55, .46, 1)
floor.data.materials.append(floor_material)
for location, power, size in [((1, -3, 5), 500, 4), ((-4, -1, 3), 240, 3), ((1, 3, 4), 400, 3)]:
    bpy.ops.object.light_add(type="AREA", location=location)
    lamp = bpy.context.object
    lamp.data.energy, lamp.data.size = power, size
    lamp.rotation_euler = (Vector((0, 0, .5)) - lamp.location).to_track_quat("-Z", "Y").to_euler()
bpy.ops.object.camera_add(location=(3, -12, 4))
camera = bpy.context.object
camera.rotation_euler = (Vector((0, 0, .62)) - camera.location).to_track_quat("-Z", "Y").to_euler()
camera.data.type, camera.data.ortho_scale = "ORTHO", 8.2
scene.camera = camera
scene.render.resolution_x, scene.render.resolution_y = 1600, 720
scene.render.resolution_percentage = 100
scene.render.filepath = str(ROOT / "docs/village/evidence/puppies-blender.png")
bpy.ops.render.render(write_still=True)
