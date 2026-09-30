"""Original cottage cat. Run in an isolated Blender background process.

Blender Z up / -Y forward becomes glTF Y up / +Z forward. Named pivots are
the runtime animation contract; preserve them when revising the sculpture.
"""
import bpy
import math
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
bpy.ops.wm.read_factory_settings(use_empty=True)

def material(name, color, roughness=.8):
    rgb = [int(color[i:i+2], 16) / 255 for i in (1, 3, 5)]
    linear = [v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4 for v in rgb]
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*linear, 1)
    mat.use_nodes = True
    shader = next(n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    shader.inputs['Base Color'].default_value = (*linear, 1)
    shader.inputs['Roughness'].default_value = roughness
    return mat

cream = material('Vanilla cream fur', '#f5e4c6')
caramel = material('Warm caramel patches', '#b87a49')
white = material('Soft white muzzle and socks', '#fff6e5')
pink = material('Rose ears and toe beans', '#d99491')
dark = material('Espresso eyes', '#283532', .22)
iris = material('Olive gold iris', '#8c9b64', .32)
shine = material('Eye catchlight', '#ffffff', .18)
sage = material('Sage woven collar', '#678c80')
gold = material('Tiny brass moon', '#d5ae6a', .36)

def pivot(name, location, parent=None):
    obj = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(obj)
    obj.parent = parent
    obj.location = location
    return obj

root = pivot('CottageCat', (0, 0, 0))
body = pivot('CatBody', (0, 0, .34), root)
head = pivot('CatHead', (0, -.27, .23), body)

def oval(name, location, scale, mat, parent, segments=24, rings=16):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings)
    obj = bpy.context.object
    obj.name = name
    obj.parent = parent
    obj.location = location
    obj.scale = scale
    obj.data.materials.append(mat)
    for p in obj.data.polygons:
        p.use_smooth = True
    return obj

def tube(name, points, radius, mat, parent):
    curve = bpy.data.curves.new(name, 'CURVE')
    curve.dimensions = '3D'
    curve.resolution_u = 8
    curve.bevel_depth = radius
    curve.bevel_resolution = 2
    spline = curve.splines.new('BEZIER')
    spline.bezier_points.add(len(points)-1)
    for p, co in zip(spline.bezier_points, points):
        p.co = co
        p.handle_left_type = p.handle_right_type = 'AUTO'
    obj = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(obj)
    obj.parent = parent
    obj.data.materials.append(mat)
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.convert(target='MESH')
    for p in obj.data.polygons:
        p.use_smooth = True
    return obj

# Rounded silhouette with broad hindquarters and delicate shoulders.
oval('Plush pear body', (0, .06, 0), (.225, .36, .24), cream, body)
oval('Caramel saddle', (.012, .15, .128), (.198, .237, .128), caramel, body)
oval('Cream chest', (0, -.205, -.01), (.16, .16, .215), white, body)
for side in [-1, 1]:
    oval('Round haunch', (side*.15, .23, -.065), (.13, .155, .19), cream, body)
    for front in [True, False]:
        leg = pivot(('CatFront' if front else 'CatBack') + ('Left' if side < 0 else 'Right'),
                    (side*.155, -.205 if front else .245, .285), root)
        oval('Tapered leg', (0, 0, -.095), (.066, .077, .145), cream, leg, 16, 10)
        oval('White mitten paw', (0, -.018, -.235), (.088, .115, .051), white, leg, 20, 12)
        for toe in [-1, 0, 1]:
            oval('Tiny toe', (toe*.034, -.098, -.232), (.013, .027, .024), cream, leg, 10, 6)

oval('Kitten face', (0, 0, 0), (.25, .205, .215), cream, head)
oval('Forehead caramel cap', (.063, .045, .105), (.19, .153, .131), caramel, head)

def ear(side):
    # A beveled tapered wedge keeps the ears recognisably feline.
    verts = [(side*.115, -.035, .125), (side*.25, .035, .12), (side*.205, .025, .365),
             (side*.115, .08, .125), (side*.25, .1, .12), (side*.205, .085, .365)]
    mesh = bpy.data.meshes.new('Sculpted kitten ear')
    mesh.from_pydata(verts, [], [(0,1,2),(3,5,4),(0,3,4,1),(1,4,5,2),(2,5,3,0)])
    obj = bpy.data.objects.new('Velvet triangular ear', mesh)
    bpy.context.collection.objects.link(obj)
    obj.parent = head
    mesh.materials.append(caramel if side > 0 else cream)
    bevel = obj.modifiers.new('Soft ear edge', 'BEVEL')
    bevel.width = .025
    bevel.segments = 3
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=bevel.name)
    for p in mesh.polygons: p.use_smooth = True
    inset = bpy.data.meshes.new('Soft triangular inner ear')
    inset.from_pydata([(side*.15,-.051,.15),(side*.228,.005,.152),(side*.203,.01,.298)], [], [(0,1,2)])
    inner = bpy.data.objects.new('Rose ear inset', inset)
    bpy.context.collection.objects.link(inner); inner.parent = head; inset.materials.append(pink)
    solid = inner.modifiers.new('Soft inner ear', 'SOLIDIFY'); solid.thickness=.006
    bevel = inner.modifiers.new('Rounded inner ear', 'BEVEL'); bevel.width=.012; bevel.segments=3
    bpy.context.view_layer.objects.active = inner
    bpy.ops.object.modifier_apply(modifier=solid.name); bpy.ops.object.modifier_apply(modifier=bevel.name)

for side in [-1, 1]:
    ear(side)
    # Shallow eyes sit on the face surface; a cream rim blends them into fur.
    eye = pivot('CatEye' + ('Left' if side < 0 else 'Right'), (side*.112, -.202, .041), head)
    oval('Eye fur rim', (0, .029, -.006), (.085, .049, .094), white, eye)
    oval('Olive iris', (0, 0, 0), (.066, .029, .073), iris, eye)
    oval('Wide pupil', (0, -.023, .003), (.04, .015, .059), dark, eye)
    oval('Eye sparkle', (-.018, -.038, .028), (.014, .008, .017), shine, eye, 12, 8)
    oval('Little eye sparkle', (.016, -.038, -.014), (.006, .004, .007), shine, eye, 10, 6)
    oval('Puffy muzzle', (side*.062, -.185, -.064), (.084, .058, .059), white, head)
    oval('Peach cheek', (side*.176, -.149, -.044), (.035, .008, .019), pink, head, 16, 8)
    for i in range(3):
        tube('Fine whisker', [(side*.095,-.225,-.063),(side*.205,-.22,-.06+(i-1)*.022),
                              (side*.32,-.19,-.055+(i-1)*.045)], .0025, white, head)
oval('Rose nose', (0, -.243, -.046), (.028, .016, .019), pink, head, 16, 10)
for side in [-1, 1]:
    tube('Little smile', [(0,-.235,-.058),(0,-.239,-.079),(side*.032,-.237,-.089),
                           (side*.049,-.226,-.08)], .004, dark, head)

tail = pivot('CatTail', (0, .31, .34), root)
tube('Curled caramel tail', [(0,0,0),(.06,.16,.055),(.115,.29,.24),(.08,.29,.43),
                             (-.015,.25,.5),(-.075,.22,.44)], .065, caramel, tail)
oval('Cream tail tip', (-.071,.22,.445), (.072,.07,.075), cream, tail, 16, 10)
tube('Soft sage collar', [(.125,-.14,.17),(.14,-.245,.13),(0,-.3,.115),
                          (-.14,-.245,.13),(-.125,-.14,.17)], .018, sage, body)
oval('Moon charm', (0,-.3,.08), (.027,.013,.03), gold, body, 16, 10)

# Export only the reusable model; studio lighting stays in the .blend source.
bpy.ops.object.select_all(action='DESELECT')
for obj in [root, *root.children_recursive]: obj.select_set(True)
out = ROOT / 'public/village/models/cottage-cat.glb'
bpy.ops.export_scene.gltf(filepath=str(out), export_format='GLB', use_selection=True,
                         export_animations=False, export_yup=True)

world = bpy.data.worlds.new('Cream studio')
bpy.context.scene.world = world
world.use_nodes = True
next(n for n in world.node_tree.nodes if n.type == 'BACKGROUND').inputs[0].default_value = (.23,.28,.27,1)
oval('Preview pedestal', (0,0,-.09), (1.4,1.4,.08), material('Preview sage', '#758d7a'), None, 48, 16)
def aim(obj, target): obj.rotation_euler = (Vector(target)-obj.location).to_track_quat('-Z','Y').to_euler()
for name, loc, energy, size in [('Key', (2,-3,4),450,4), ('Fill',(-3,-1,2),250,3), ('Rim',(0,3,3),350,3)]:
    data = bpy.data.lights.new(name, 'AREA'); data.energy=energy; data.shape='DISK'; data.size=size
    obj = bpy.data.objects.new(name,data); bpy.context.collection.objects.link(obj); obj.location=loc; aim(obj,(0,0,.4))
data = bpy.data.cameras.new('Portrait'); cam=bpy.data.objects.new('Portrait',data)
bpy.context.collection.objects.link(cam); cam.location=(1.3,-2.3,1.05); aim(cam,(0,0,.43))
data.type='ORTHO'; data.ortho_scale=1.65
scene=bpy.context.scene; scene.camera=cam
try: scene.render.engine='CYCLES'
except TypeError: pass
scene.cycles.samples=32
scene.render.resolution_x=900; scene.render.resolution_y=900; scene.render.resolution_percentage=100
scene.render.filepath=str(ROOT / 'docs/village/evidence/cottage-cat-blender.png')
source=ROOT / 'assets/village/cottage-cat.blend'; source.parent.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=str(source))
bpy.ops.render.render(write_still=True)
print('COTTAGE_CAT_EXPORTED',out.stat().st_size)
