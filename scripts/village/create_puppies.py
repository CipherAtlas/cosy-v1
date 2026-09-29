"""Build four original village puppies in an isolated Blender process.

Blender uses Z up and -Y forward; the exported GLB uses Y up and +Z forward.
Named body, head, ears, legs and tail pivots are animated by the village.
"""
import bpy
import hashlib
import json
import math
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
bpy.ops.wm.read_factory_settings(use_empty=True)

palette = {
    "corgi": "#d7904d", "corgi_dark": "#a9653d", "shiba": "#c87940",
    "shiba_dark": "#9c563b", "beagle": "#ae704b", "beagle_dark": "#3d3537",
    "samoyed": "#f5f2e5", "samoyed_shade": "#dedcd3", "cream": "#fff1d9",
    "white": "#fffaf0", "pink": "#e4a4a5", "tongue": "#e67f8d",
    "nose": "#34404a", "eye": "#24343b", "shine": "#ffffff",
    "teal": "#5a9c9a", "blue": "#788fbb", "rose": "#c77d87", "gold": "#dca951",
}
colors = {}
for name, value in palette.items():
    rgb = [int(value[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    colors[name] = tuple(v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4 for v in rgb) + (1,)
material = bpy.data.materials.new("Painted puppy fur")
material.use_nodes = True
shader = next(n for n in material.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
shader.inputs["Roughness"].default_value = .83
attribute = material.node_tree.nodes.new("ShaderNodeVertexColor")
attribute.layer_name = "Color"
material.node_tree.links.new(attribute.outputs["Color"], shader.inputs["Base Color"])


def group(name, parent=None, location=(0, 0, 0)):
    obj = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(obj)
    obj.parent = parent
    obj.location = location
    return obj


def finish(obj, name, parent, color):
    obj.name = name
    obj.parent = parent
    for face in obj.data.polygons:
        face.use_smooth = True
    attr = obj.data.color_attributes.new(name="Color", type="FLOAT_COLOR", domain="CORNER")
    for corner in attr.data:
        corner.color = colors[color]
    obj.data.materials.append(material)
    return obj


def oval(parent, name, location, scale, color, segments=20):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=12, location=location)
    obj = bpy.context.object
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish(obj, name, parent, color)


def cone(parent, name, location, radius, depth, color, vertices=16):
    bpy.ops.mesh.primitive_cone_add(vertices=vertices, radius1=radius, radius2=.004, depth=depth, location=location)
    return finish(bpy.context.object, name, parent, color)


def curve(parent, name, points, radius, color):
    data = bpy.data.curves.new(name, "CURVE")
    data.dimensions = "3D"
    data.bevel_depth = radius
    data.bevel_resolution = 2
    spline = data.splines.new("BEZIER")
    spline.bezier_points.add(len(points) - 1)
    for point, xyz in zip(spline.bezier_points, points):
        point.co = xyz
        point.handle_left_type = point.handle_right_type = "AUTO"
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.convert(target="MESH")
    return finish(obj, name, parent, color)


def join_part(part):
    meshes = [child for child in part.children if child.type == "MESH"]
    if not meshes:
        return
    bpy.ops.object.select_all(action="DESELECT")
    for obj in meshes:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    bpy.ops.object.join()
    meshes[0].name = part.name + "Mesh"
    bpy.context.scene.cursor.location = part.matrix_world.translation
    bpy.ops.object.origin_set(type="ORIGIN_CURSOR")


def puppy(name, breed, coat, shade, collar):
    root = group(name)
    short = breed == "corgi"
    fluffy = breed == "samoyed"
    floppy = breed == "beagle"
    body = group(name + "Body", root, (0, 0, .43 if short else .53))
    oval(body, "Soft round body", (0, .12, 0), (.38 if short else .34, .54 if short else .43, .32 if short else .35), coat)
    oval(body, "Cream bib", (0, -.22, -.035), (.31, .19, .275), "cream" if breed != "beagle" else "white")
    if floppy:
        oval(body, "Saddle marking", (0, .11, .20), (.315, .37, .14), shade)
        oval(body, "White chest point", (0, -.32, -.13), (.19, .09, .21), "white")
    if fluffy:
        for side in [-1, 1]:
            for i in range(4):
                tuft = cone(body, "Cloud fur ruff", (side * (.23 + i * .02), -.22 + i * .11, -.08 + i * .03), .095, .23, "samoyed")
                tuft.rotation_euler.y = side * 1.1
        for i in range(5):
            tuft = cone(body, "Soft chest tuft", ((i - 2) * .09, -.39, -.15), .073, .18, "white")
            tuft.rotation_euler.x = -.55
    oval(body, "Little collar", (0, -.265, .16), (.322, .18, .055), collar)
    oval(body, "Heart tag", (0, -.43, .085), (.068, .028, .078), "gold")

    head = group(name + "Head", root, (0, -.42, .70 if short else .83))
    head_scale = (.35, .32, .33) if short else (.34, .31, .35)
    oval(head, "Big puppy head", (0, -.04, 0), head_scale, coat)
    if breed == "shiba":
        oval(head, "Shiba cheek left", (-.245, -.17, -.13), (.14, .14, .13), "cream")
        oval(head, "Shiba cheek right", (.245, -.17, -.13), (.14, .14, .13), "cream")
    if fluffy:
        for side in [-1, 1]:
            oval(head, "Samoyed cheek fluff", (side * .27, -.09, -.14), (.15, .19, .16), "samoyed")
    oval(head, "Soft white muzzle", (0, -.305, -.145), (.23, .135, .16), "cream" if breed != "beagle" else "white")
    oval(head, "Button nose", (0, -.428, -.076), (.072, .047, .055), "nose", 16)
    for side in [-1, 1]:
        oval(head, "Bright eye", (side * .16, -.306, .083), (.061, .035, .073), "eye", 16)
        oval(head, "Eye glint", (side * .142, -.338, .11), (.018, .009, .022), "shine", 12)
        oval(head, "Rosy cheek", (side * .243, -.277, -.11), (.07, .023, .035), "pink", 12)
    curve(head, "Upturned smile", [(-.12, -.43, -.183), (-.055, -.449, -.225), (0, -.452, -.235), (.055, -.449, -.225), (.12, -.43, -.183)], .009, "nose")
    oval(head, "Happy tongue", (0, -.452, -.244), (.047, .012, .065), "tongue", 12)
    if floppy:
        oval(head, "Beagle blaze", (0, -.26, .19), (.075, .055, .15), "white")
        oval(head, "Beagle brow", (0, -.035, .31), (.21, .17, .06), shade)
    elif breed == "corgi":
        oval(head, "Corgi blaze", (0, -.30, .12), (.077, .048, .2), "cream")

    ears = []
    for side in [-1, 1]:
        ear = group(name + ("EarLeft" if side < 0 else "EarRight"), head, (side * .255, -.03, .25))
        ears.append(ear)
        if floppy:
            outer = oval(ear, "Velvet floppy ear", (side * .065, .025, -.16), (.115, .13, .24), shade)
            outer.rotation_euler.y = side * .24
        else:
            height = .30 if short else .235 if breed == "shiba" else .205
            outer = cone(ear, "Pointed puppy ear", (side * .035, .02, height * .48), .17 if short else .14, height, coat)
            outer.rotation_euler.y = -side * .13
            inner = cone(ear, "Warm ear inside", (side * .035, -.092, height * .45), .08, height * .57, "pink")
            inner.rotation_euler.y = -side * .13

    legs = []
    for front in [True, False]:
        for side in [-1, 1]:
            label = ("Front" if front else "Back") + ("Left" if side < 0 else "Right")
            pivot = group(name + "Leg" + label, root, (side * .245, -.20 if front else .42, .33 if short else .43))
            legs.append(pivot)
            length = .23 if short else .32
            oval(pivot, "Puppy leg", (0, 0, -length * .53), (.107, .12, length * .63), coat if not floppy else ("white" if front else coat))
            oval(pivot, "Little paw", (0, -.075, -length), (.125, .16, .063), "cream" if breed != "beagle" else "white")
            for toe in [-1, 0, 1]:
                oval(pivot, "Paw toe", (toe * .061, -.185, -length - .006), (.035, .024, .025), "cream" if breed != "beagle" else "white", 10)

    tail = group(name + "Tail", root, (0, .52, .55 if short else .65))
    if short:
        oval(tail, "Corgi pom tail", (0, .12, .05), (.115, .19, .14), coat)
    elif breed == "shiba":
        for i, pos in enumerate([(0, .12, .06), (0, .27, .18), (0, .28, .32)]):
            oval(tail, "Curled Shiba tail", pos, (.115 - i * .01, .16, .12), coat if i < 2 else "cream")
    elif floppy:
        tuft = oval(tail, "Wagging Beagle tail", (0, .18, .19), (.085, .12, .27), coat)
        tuft.rotation_euler.x = -.48
        oval(tail, "White tail tip", (0, .29, .38), (.085, .09, .105), "white")
    else:
        for i, pos in enumerate([(0, .10, .04), (0, .21, .14), (0, .30, .23), (0, .35, .3)]):
            oval(tail, "Plumed Samoyed tail", pos, (.16, .16, .14), "white" if i % 2 else "samoyed")

    bpy.context.view_layer.update()
    for part in [body, head, *ears, *legs, tail]:
        join_part(part)
    return root


specs = [
    ("Mochi", "corgi", "corgi", "corgi_dark", "teal"),
    ("Kiko", "shiba", "shiba", "shiba_dark", "rose"),
    ("Biscuit", "beagle", "beagle", "beagle_dark", "blue"),
    ("Cloud", "samoyed", "samoyed", "samoyed_shade", "gold"),
]
roots = [puppy(*spec) for spec in specs]
source = ROOT / "assets/village/puppies.blend"
output = ROOT / "public/village/models/puppies.glb"
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=str(source))
bpy.ops.export_scene.gltf(filepath=str(output), export_format="GLB", export_yup=True, export_animations=False)
manifest = {
    "id": "puppies-v1", "breeds": [spec[1] for spec in specs],
    "source": str(source.relative_to(ROOT)), "runtime": str(output.relative_to(ROOT)),
    "creator": "Original project artwork, Blender " + bpy.app.version_string,
    "license": "Original project artwork; no third-party character assets or textures.",
    "bytes": output.stat().st_size, "sha256": hashlib.sha256(output.read_bytes()).hexdigest(),
    "triangles": sum(len(face.vertices) - 2 for obj in bpy.context.scene.objects if obj.type == "MESH" for face in obj.data.polygons),
    "textures": 0, "animatedPartsPerDog": 9,
}
(ROOT / "docs/village/puppies-manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
print(json.dumps(manifest))

# The lineup render is visual evidence; staging stays out of the saved source/GLB.
for root, x in zip(roots, [-1.75, -.58, .58, 1.75]):
    root.location.x = x
scene = bpy.context.scene
scene.render.engine = "CYCLES"
scene.cycles.samples = 24
scene.render.film_transparent = False
scene.world = bpy.data.worlds.new("Warm puppy preview")
scene.world.use_nodes = True
scene.world.node_tree.nodes.get("Background").inputs["Color"].default_value = (.77, .69, .59, 1)
scene.world.node_tree.nodes.get("Background").inputs["Strength"].default_value = .8
bpy.ops.mesh.primitive_plane_add(size=200, location=(0, 0, -.035))
ground = bpy.context.object
ground.name = "Preview floor"
ground_material = bpy.data.materials.new("Warm paper floor")
ground_material.diffuse_color = (.79, .71, .58, 1)
ground.data.materials.append(ground_material)
for location, power, size in [((2, -3, 5), 500, 4), ((-3, -1, 3), 280, 3)]:
    bpy.ops.object.light_add(type="AREA", location=location)
    lamp = bpy.context.object
    lamp.data.energy = power
    lamp.data.shape = "DISK"
    lamp.data.size = size
    lamp.rotation_euler = (Vector((0, 0, .5)) - lamp.location).to_track_quat("-Z", "Y").to_euler()
bpy.ops.object.camera_add(location=(4, -9, 4.3))
camera = bpy.context.object
camera.rotation_euler = (Vector((0, 0, .55)) - camera.location).to_track_quat("-Z", "Y").to_euler()
camera.data.type = "ORTHO"
camera.data.ortho_scale = 5.9
scene.camera = camera
scene.render.resolution_x = 1500
scene.render.resolution_y = 650
scene.render.resolution_percentage = 100
preview = ROOT / "docs/village/evidence/puppies-blender.png"
scene.render.filepath = str(preview)
bpy.ops.render.render(write_still=True)
