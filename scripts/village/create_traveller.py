"""Author Cosy's traveller in an isolated Blender scene, including walk/idle clips."""
import bpy, math, random
from pathlib import Path
from mathutils import Vector
random.seed(45)
bpy.ops.wm.read_factory_settings(use_empty=True)
def material(name,col):
 m=bpy.data.materials.new(name);m.use_nodes=True
 bs=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED');bs.inputs['Base Color'].default_value=(*col,1);bs.inputs['Roughness'].default_value=.9
 return m
coat=material('Moss wool',(.065,.085,.028));seam=material('Coat seams',(.125,.158,.081));pants=material('Cream linen',(.59,.55,.43));leather=material('Worn leather',(.135,.081,.038));skin=material('Warm skin',(.32,.16,.082));hair=material('Chestnut hair',(.071,.035,.017));scarf=material('Rust wool scarf',(.25,.055,.018));brass=material('Brass details',(.5,.35,.13));eye=material('Eyes',(.02,.018,.015))
root=bpy.data.objects.new('Traveller',None);bpy.context.collection.objects.link(root)
def empty(name,pos,parent=root):
 o=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(o);o.location=pos;o.parent=parent;return o
def uv(name,pos,scale,mat,parent=root):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=16,ring_count=10,location=(0,0,0));o=bpy.context.object;o.name=name;o.parent=parent;o.location=pos;o.scale=scale;o.data.materials.append(mat)
 for p in o.data.polygons:p.use_smooth=True
 return o
def cyl(name,pos,top,bottom,height,mat,parent=root):
 bpy.ops.mesh.primitive_cone_add(vertices=24,radius1=bottom,radius2=top,depth=height);o=bpy.context.object;o.name=name;o.parent=parent;o.location=pos;o.data.materials.append(mat)
 for p in o.data.polygons:p.use_smooth=True
 bevel=o.modifiers.new('Soft tailored edges','BEVEL');bevel.width=.015;bevel.segments=2
 return o
def strap(name,a,b,r,mat,parent=root):
 a,b=Vector(a),Vector(b);o=cyl(name,(a+b)/2,r,r,(b-a).length,mat,parent);o.rotation_quaternion=(b-a).to_track_quat('Z','Y');o.rotation_mode='QUATERNION';return o
# Blender Z up; -Y is forward. Forward exports to +Z.
body=empty('Body',(0,0,0));
cyl('Coat skirt',(0,0,.88),.22,.29,.53,coat,body)
uv('Tailored torso',(0,0,1.19),(.235,.135,.31),coat,body)
# Narrow double front seams, belt, buttons, pockets, collar.
for x in [-.025,.025]:strap('Front coat seam',(x,-.133,.66),(x,-.14,1.42),.008,seam,body)
cyl('Belt',(0,0,1.015),.234,.237,.065,leather,body).scale.y=.65
for z in [1.09,1.23,1.34]:uv('Brass button',(.04,-.147,z),(.013,.008,.013),brass,body)
for s in [-1,1]:uv('Coat pocket',(s*.175,-.09,.89),(.085,.025,.095),seam,body)
cyl('Neck',(0,0,1.49),.058,.062,.14,skin,body)
uv('Head',(0,-.015,1.65),(.108,.092,.135),skin,body)
uv('Chin',(0,-.04,1.575),(.072,.065,.065),skin,body)
uv('Nose',(0,-.11,1.64),(.025,.034,.025),skin,body)
for s in [-1,1]:
 uv('Ear',(s*.11,-.007,1.646),(.018,.028,.034),skin,body)
 uv('Eye',(s*.039,-.098,1.678),(.013,.006,.009),eye,body)
uv('Hair cap',(0,.013,1.705),(.117,.1,.1),hair,body)
for i in range(38):
 a=i*2.4;z=1.69+random.random()*.065;r=.086+random.random()*.02
 o=uv('Layered hair',(math.cos(a)*r,math.sin(a)*r*.7+.02,z),(.037,.043,.065),hair,body);o.rotation_euler=(random.random()*.7,math.cos(a)*.55,a)
# Rolled scarf and trailing tails.
bpy.ops.mesh.primitive_torus_add(major_radius=.083,minor_radius=.027,major_segments=24,minor_segments=8);o=bpy.context.object;o.name='Rust scarf';o.parent=body;o.location=(0,0,1.495);o.scale=(1.45,1,1.2);o.data.materials.append(scarf)
for s in [-1,1]:
 tail=uv('Scarf tail',(s*.066,.155,1.25),(.048,.025,.22),scarf,body);tail.rotation_euler[1]=s*.15
# Limbs have articulated object pivots for smooth authored animation.
limbs=[]
for s in [-1,1]:
 leg=empty('Leg '+str(s),(s*.105,0,.85),body);limbs.append(leg)
 uv('Linen trouser thigh',(0,0,-.19),(.091,.1,.245),pants,leg)
 shin=empty('Shin '+str(s),(0,0,-.38),leg)
 uv('Linen trouser shin',(0,.005,-.145),(.07,.07,.18),pants,shin)
 cyl('Boot shaft',(0,.005,-.62),.067,.072,.22,leather,leg)
 uv('Leather boot',(0,-.051,-.765),(.078,.135,.058),leather,leg)
 arm=empty('Arm '+str(s),(s*.216,0,1.39),body);limbs.append(arm)
 uv('Coat sleeve upper',(s*.025,0,-.14),(.074,.08,.19),coat,arm)
 fore=empty('Forearm '+str(s),(s*.027,0,-.3),arm)
 uv('Coat sleeve lower',(0,-.025,-.11),(.06,.066,.145),coat,fore)
 cyl('Sleeve cuff',(0,-.045,-.23),.06,.056,.045,seam,fore)
 uv('Hand',(0,-.045,-.294),(.042,.041,.073),skin,fore)
 uv('Thumb',(-s*.03,-.07,-.275),(.022,.024,.037),skin,fore)
# Cross-body leather satchel and strap visible from the follow camera.
strap('Satchel strap',(-.19,.126,1.41),(.215,.13,.87),.026,leather,body)
uv('Satchel',(.255,.1,.87),(.11,.065,.16),leather,body)
uv('Satchel flap',(.262,.157,.89),(.105,.018,.12),leather,body)
uv('Satchel clasp',(.262,.178,.85),(.017,.007,.021),brass,body)
# Export separate named walk and idle actions using NLA.
for ob in limbs+[body]:
 ob.animation_data_create();action=bpy.data.actions.new('Walking_A');ob.animation_data.action=action
 for frame in [1,9,17,25,33]:
  phase=(frame-1)/32*math.pi*2
  if ob==body:ob.location.z=.015+abs(math.sin(phase))*.014;ob.keyframe_insert('location',frame=frame)
  else:
   side=1 if '1'==ob.name.split()[-1] else -1
   ob.rotation_euler.x=math.sin(phase)*(.38 if 'Leg' in ob.name else -.26)*side
   ob.keyframe_insert('rotation_euler',frame=frame)
 track=ob.animation_data.nla_tracks.new();track.name='Walking_A';track.strips.new('Walking_A',1,action);ob.animation_data.action=None
for ob in limbs+[body]:
 ob.animation_data.action=bpy.data.actions.new('Idle')
 for frame in [1,49]:
  if ob==body:ob.location.z=0;ob.keyframe_insert('location',frame=frame)
  else:ob.rotation_euler=(0,0,0);ob.keyframe_insert('rotation_euler',frame=frame)
 track=ob.animation_data.nla_tracks.new();track.name='Idle';track.strips.new('Idle',1,ob.animation_data.action);track.mute=True;ob.animation_data.action=None
for ob in limbs:ob.rotation_euler=(0,0,0)
body.location.z=0
bpy.context.scene.frame_set(1)
bpy.ops.export_scene.gltf(filepath=str(Path(__file__).resolve().parents[2]/'public/village/models/traveller-original.glb'),export_format='GLB',export_yup=True,export_animations=True,export_animation_mode='NLA_TRACKS')
