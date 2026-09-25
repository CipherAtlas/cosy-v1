"""Original candidate traveller: metre-scale skinned mesh, fabric atlas, eight in-place clips.
Run in a fresh background Blender process. Does not use the user's open scene.
"""
import bpy, math, random, json, hashlib
from pathlib import Path
from mathutils import Vector
ROOT = Path(__file__).resolve().parents[2]
bpy.ops.wm.read_factory_settings(use_empty=True)
random.seed(45)
# A small original woven-fabric texture; no downloaded/generated third-party character.
image = bpy.data.images.new('Original woven cloth', width=256, height=256)
pixels=[]
for y in range(256):
 for x in range(256):
  value=.79+random.random()*.12+(.065 if (x+y)%3==0 else 0)
  pixels.extend((value,value,value,1))
image.pixels=pixels
image.pack()
def material(name,col,cloth=False,rough=.88):
 m=bpy.data.materials.new(name);m.use_nodes=True
 n=m.node_tree.nodes;bs=n.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*col,1);bs.inputs['Roughness'].default_value=rough
 if cloth:
  colored=bpy.data.images.new(name+' woven color',width=256,height=256)
  colored.pixels=[value*(1.055*col[i%4]**(1/2.4)-.055) if i%4<3 else 1 for i,value in enumerate(pixels)]
  colored.pack();tex=n.new('ShaderNodeTexImage');tex.image=colored
  m.node_tree.links.new(tex.outputs['Color'],bs.inputs['Base Color'])
 return m
coat=material('Moss woven wool',(.12,.15,.065),True);pants=material('Oat linen',(.56,.5,.36),True)
leather=material('Worn umber leather',(.1,.052,.026),False,.76);skin=material('Warm skin',(.38,.21,.12),False,.72)
hair=material('Chestnut hair',(.035,.018,.01));scarf=material('Terracotta woven scarf',(.31,.083,.027),True)
seam=material('Olive seams',(.18,.2,.096),True);metal=material('Aged brass',(.4,.25,.072),False,.45);eyes=material('Eyes',(.016,.012,.008))
# +Z up / -Y forward in Blender. GLB exports +Y up / +Z forward.
bones={
 'Root':((0,0,0),None),'Hips':((0,0,.88),'Root'),'Spine':((0,0,1.03),'Hips'),
 'Chest':((0,0,1.3),'Spine'),'Neck':((0,0,1.5),'Chest'),'Head':((0,0,1.57),'Neck'),
 'Scarf':((.08,.11,1.49),'Chest'),'Coat.L':((-.11,0,.99),'Hips'),'Coat.R':((.11,0,.99),'Hips')}
for side,s in [('L',-1),('R',1)]:
 bones.update({f'Thigh.{side}':((s*.105,0,.87),'Hips'),f'Shin.{side}':((s*.108,0,.48),f'Thigh.{side}'),f'Foot.{side}':((s*.108,0,.12),f'Shin.{side}'),f'UpperArm.{side}':((s*.206,0,1.415),'Chest'),f'Forearm.{side}':((s*.255,0,1.14),f'UpperArm.{side}'),f'Hand.{side}':((s*.268,-.022,.93),f'Forearm.{side}')})
arm_data=bpy.data.armatures.new('Traveller skeleton');rig=bpy.data.objects.new('TravellerRig',arm_data);bpy.context.collection.objects.link(rig)
bpy.context.view_layer.objects.active=rig;rig.select_set(True);bpy.ops.object.mode_set(mode='EDIT')
for name,(head,parent) in bones.items():
 b=arm_data.edit_bones.new(name);b.head=head;b.tail=Vector(head)+Vector((0,.1,0))
 if parent:b.parent=arm_data.edit_bones[parent]
bpy.ops.object.mode_set(mode='OBJECT');rig.select_set(False)
meshes=[]
def attach(ob,mat,weights):
 ob.data.materials.append(mat)
 bpy.context.view_layer.objects.active=ob;ob.select_set(True);bpy.ops.object.transform_apply(location=True,rotation=True,scale=True);ob.select_set(False)
 for p in ob.data.polygons:p.use_smooth=True
 groups={name:ob.vertex_groups.new(name=name) for name in bones}
 for v in ob.data.vertices:
  ws=weights(v.co) if callable(weights) else {weights:1}
  for name,value in ws.items():
   if value>0:groups[name].add([v.index],value,'REPLACE')
 mod=ob.modifiers.new('Skin','ARMATURE');mod.object=rig;ob.parent=rig;meshes.append(ob);return ob

def loft(name,rings,mat,weights,n=24,fold=0):
 verts=[];faces=[]
 for row,(x,y,z,rx,ry) in enumerate(rings):
  for j in range(n):
   a=j/n*2*math.pi;f=1+fold*(math.sin(a*7+z*15)+.4*math.sin(a*11-z*5))
   verts.append((x+math.cos(a)*rx*f,y+math.sin(a)*ry*f,z))
 for row in range(len(rings)-1):
  for j in range(n):
   a=row*n+j;b=row*n+(j+1)%n;faces.append((a,b,b+n,a+n))
 faces.append(tuple(range(n-1,-1,-1)));faces.append(tuple((len(rings)-1)*n+j for j in range(n)))
 mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update();ob=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(ob)
 uv=mesh.uv_layers.new(name='UVMap')
 for poly in mesh.polygons:
  for li in poly.loop_indices:
   vi=mesh.loops[li].vertex_index;uv.data[li].uv=((vi%n)/n,(vi//n)/(len(rings)-1))
 return attach(ob,mat,weights)
def ellipsoid(name,pos,scale,mat,bone,segments=20,rings=12):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=segments,ring_count=rings,location=pos);ob=bpy.context.object;ob.name=name;ob.scale=scale;return attach(ob,mat,bone)
def tube(name,a,b,width,mat,bone):
 a,b=Vector(a),Vector(b);bpy.ops.mesh.primitive_cone_add(vertices=12,radius1=width,radius2=width*.9,depth=(b-a).length,location=(a+b)/2)
 ob=bpy.context.object;ob.name=name;ob.rotation_mode='QUATERNION';ob.rotation_quaternion=(b-a).to_track_quat('Z','Y');return attach(ob,mat,bone)
def torso_weights(v):
 z=v.z
 if z<.96:return {'Hips':.25, 'Coat.L' if v.x<0 else 'Coat.R':.75}
 if z<1.14:
  t=(z-.96)/.18;return {'Hips':1-t,'Spine':t}
 t=min(1,(z-1.14)/.24);return {'Spine':1-t,'Chest':t}
loft('Tailored coat',[(0,0,z,rx,ry) for z,rx,ry in [(.61,.25,.143),(.69,.246,.14),(.83,.225,.14),(.97,.18,.13),(1.06,.174,.128),(1.16,.195,.14),(1.29,.213,.144),(1.39,.216,.126),(1.44,.165,.104),(1.47,.073,.07)]],coat,torso_weights,40,.024)
# Front lapels and continuous neckline.
for s in [-1,1]:
 tube('Coat lapel',(s*.055,-.094,1.43),(s*.075,-.145,1.16),.022,seam,'Chest')
 tube('Tailored front seam',(s*.02,-.145,1.16),(s*.018,-.151,.67),.005,seam,torso_weights)
 ellipsoid('Pocket flap',(s*.154,-.126,.88),(.071,.01,.043),seam,'Hips')
for z in [1.08,1.19,1.31]:ellipsoid('Brass fastening',(.025,-.15,z),(.008,.005,.008),metal,'Spine',12,8)
loft('Neck',[(0,0,1.46,.053,.052),(0,0,1.56,.049,.048),(0,-.005,1.59,.053,.05)],skin,'Neck')
loft('Sculpted head',[(0,y,z,rx,ry) for y,z,rx,ry in [(-.024,1.555,.033,.04),(-.023,1.58,.061,.056),(-.005,1.615,.087,.072),(0,1.66,.098,.088),(.003,1.705,.095,.087),(.008,1.745,.08,.077),(.01,1.77,.045,.05),(.01,1.781,.008,.009)]],skin,'Head',32)
ellipsoid('Nose',(0,-.09,1.651),(.016,.024,.026),skin,'Head')
for s in [-1,1]:
 ellipsoid('Ear',(s*.094,.006,1.65),(.018,.027,.03),skin,'Head')
 ellipsoid('Eye',(s*.036,-.081,1.686),(.013,.005,.007),eyes,'Head')
 tube('Brow',(s*.02,-.088,1.7),(s*.055,-.081,1.698),.006,hair,'Head')
ellipsoid('Hair mass',(0,.02,1.737),(.101,.086,.055),hair,'Head',28,16)
for i in range(52):
 a=i*2.399;z=1.66+random.random()*.096;r=.087+random.random()*.012
 ellipsoid('Hair lock',(math.cos(a)*r,math.sin(a)*r*.82+.022,z),(.017,.021,.045+random.random()*.02),hair,'Head',10,8)
for side,s in [('L',-1),('R',1)]:
 def leg_weights(v,side=side):
  t=max(0,min(1,(v.z-.43)/.11));return {f'Thigh.{side}':t,f'Shin.{side}':1-t}
 loft('Linen leg '+side,[(s*.106,0,z,rx,ry) for z,rx,ry in [(.16,.052,.058),(.24,.058,.062),(.34,.065,.072),(.43,.068,.071),(.49,.071,.069),(.58,.082,.081),(.72,.091,.09),(.86,.096,.098)]],pants,leg_weights,24,.035)
 loft('Boot '+side,[(s*.108,0,z,rx,ry) for z,rx,ry in [(.08,.065,.079),(.13,.068,.073),(.22,.065,.071),(.27,.063,.073)]],leather,f'Shin.{side}',24,.015)
 ellipsoid('Boot toe',(s*.108,-.057,.069),(.072,.13,.052),leather,f'Foot.{side}',24,12)
 ellipsoid('Boot sole',(s*.108,-.054,.025),(.075,.132,.021),leather,f'Foot.{side}',24,8)
 for z in [.14,.19,.24]:tube('Boot seam',(s*.108-.04,-.073,z),(s*.108+.04,-.073,z+.004),.005,seam,f'Shin.{side}')
 def arm_weights(v,side=side):
  t=max(0,min(1,(v.z-1.10)/.1));return {f'UpperArm.{side}':t,f'Forearm.{side}':1-t}
 loft('Tailored sleeve '+side,[(s*x,y,z,rx,ry) for x,y,z,rx,ry in [(.267,-.02,.945,.044,.046),(.266,-.018,1.01,.052,.055),(.258,-.005,1.115,.058,.06),(.247,0,1.18,.065,.068),(.23,0,1.29,.073,.078),(.205,0,1.405,.067,.072),(.19,0,1.435,.04,.04)]],coat,arm_weights,24,.018)
 ellipsoid('Palm',(s*.27,-.026,.9),(.036,.024,.056),skin,f'Hand.{side}')
 for j in range(4):
  xx=s*(.244+j*.016);ellipsoid('Finger',(xx,-.029,.855-abs(j-1.5)*.006),(.009,.014,.035),skin,f'Hand.{side}',10,8)
 ellipsoid('Thumb',(s*.239,-.041,.899),(.012,.017,.031),skin,f'Hand.{side}',12,8)
# Scarf with a flat folded tail instead of cylindrical lobes.
loft('Wrapped scarf',[(0,0,1.47,.091,.086),(0,0,1.49,.1,.091),(0,0,1.51,.088,.08),(0,0,1.527,.075,.072)],scarf,'Chest',32,.06)
loft('Trailing scarf',[(.11,.165,.96,.045,.014),(.13,.177,1.10,.052,.015),(.08,.144,1.25,.051,.016),(.07,.12,1.45,.044,.017)],scarf,'Scarf',16,.06)
# Flat shoulder strap; satchel broad enough to read from the follow camera.
tube('Satchel strap',(-.17,.13,1.42),(.232,.155,.91),.013,leather,'Chest')
ellipsoid('Satchel',(.24,.07,.88),(.12,.067,.135),leather,'Hips',24,16)
ellipsoid('Satchel flap',(.242,.128,.916),(.115,.014,.094),leather,'Hips')
ellipsoid('Buckle',(.244,.142,.875),(.016,.008,.024),metal,'Hips',12,8)
# Join to one skinned mesh; per-material primitives preserve a small draw-call budget.
bpy.ops.object.select_all(action='DESELECT')
for ob in meshes:ob.select_set(True)
bpy.context.view_layer.objects.active=meshes[0];bpy.ops.object.join();mesh=bpy.context.object;mesh.name='Traveller skinned clothing and body'
# Retain a single armature modifier after join.
for mod in list(mesh.modifiers)[1:]:mesh.modifiers.remove(mod)
clips={'Idle':2.8,'Walk':.635,'Run':.622,'Sprint':.583,'JumpStart':.13,'AirLoop':.6,'LandSoft':.24,'LandMoving':.16}
rig.animation_data_create()
for name,duration in clips.items():
 action=bpy.data.actions.new(name);rig.animation_data.action=action
 count=40 if name in ['Walk','Run','Sprint'] else 16
 for f in range(count+1):
  phase=f/count*math.pi*2;t=f/count
  for pb in rig.pose.bones:pb.rotation_mode='XYZ';pb.rotation_euler=(0,0,0);pb.location=(0,0,0)
  if name in ['Walk','Run','Sprint']:
   run=name!='Walk';sprint=name=='Sprint';amplitude=.48 if not run else .78 if sprint else .65
   rig.pose.bones['Hips'].location.z=(.013 if not run else .035)*(1-math.cos(phase*2))
   rig.pose.bones['Spine'].rotation_euler.x=.12 if sprint else .075 if run else 0
   rig.pose.bones['Chest'].rotation_euler.z=math.sin(phase)*(.055 if run else .025)
   for side,offset in [('L',0),('R',math.pi)]:
    a=phase+offset
    rig.pose.bones[f'Thigh.{side}'].rotation_euler.x=-math.cos(a)*amplitude
    rig.pose.bones[f'Shin.{side}'].rotation_euler.x=max(0,math.sin(a))*(1.3 if run else .64)
    rig.pose.bones[f'Foot.{side}'].rotation_euler.x=math.cos(a)*amplitude*.55-max(0,math.sin(a))*.2
    rig.pose.bones[f'UpperArm.{side}'].rotation_euler.x=math.cos(a)*(.55 if run else .32)
    rig.pose.bones[f'Forearm.{side}'].rotation_euler.x=-.9 if run else -.15
    rig.pose.bones[f'Coat.{side}'].rotation_euler.x=-math.cos(a)*amplitude*.38
   rig.pose.bones['Scarf'].rotation_euler.x=-.13 if run else -.035
   rig.pose.bones['Scarf'].rotation_euler.y=math.sin(phase)*.1
  elif name=='Idle':
   rig.pose.bones['Chest'].rotation_euler.x=math.sin(phase)*.008
   rig.pose.bones['Scarf'].rotation_euler.y=math.sin(phase)*.025
  elif name in ['JumpStart','AirLoop']:
   for side,s in [('L',1),('R',-1)]:
    rig.pose.bones[f'Thigh.{side}'].rotation_euler.x=-.38 if name=='AirLoop' else -.22*(1-t)
    rig.pose.bones[f'Shin.{side}'].rotation_euler.x=.8 if name=='AirLoop' else .4*(1-t)
    rig.pose.bones[f'UpperArm.{side}'].rotation_euler.x=-.45
    rig.pose.bones[f'UpperArm.{side}'].rotation_euler.y=s*.16
    rig.pose.bones[f'Forearm.{side}'].rotation_euler.x=-.45
   rig.pose.bones['Scarf'].rotation_euler.x=-.2
  else:
   crouch=math.sin(t*math.pi)*(.26 if name=='LandMoving' else .38)
   rig.pose.bones['Hips'].location.z=-crouch*.18
   for side in ['L','R']:
    rig.pose.bones[f'Thigh.{side}'].rotation_euler.x=-crouch
    rig.pose.bones[f'Shin.{side}'].rotation_euler.x=crouch*2
    rig.pose.bones[f'Foot.{side}'].rotation_euler.x=-crouch
  frame=1+t*duration*30
  for pb in rig.pose.bones:
   pb.keyframe_insert('rotation_euler',frame=frame,group=pb.name);pb.keyframe_insert('location',frame=frame,group=pb.name)
 track=rig.animation_data.nla_tracks.new();track.name=name;track.strips.new(name,1,action);track.mute=True;rig.animation_data.action=None
for pb in rig.pose.bones:pb.rotation_euler=(0,0,0);pb.location=(0,0,0)
bpy.context.scene.render.fps=30;bpy.context.scene.frame_set(1)
source=ROOT/'assets/village/traveller.blend';source.parent.mkdir(parents=True,exist_ok=True)
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(source))
output=ROOT/'public/village/models/traveller.glb'
bpy.ops.export_scene.gltf(filepath=str(output),export_format='GLB',export_yup=True,export_animations=True,export_animation_mode='NLA_TRACKS',export_force_sampling=True)
manifest={'id':'traveller-rig-v1','status':'candidate','runtimeFile':str(output.relative_to(ROOT)),'sourceFile':str(source.relative_to(ROOT)),'creatorOrTool':'Original scripted modeling and rigging, Blender '+bpy.app.version_string,'license':'Original project artwork; no third-party character assets','sha256':hashlib.sha256(output.read_bytes()).hexdigest(),'units':'metres','upAxis':'+Y','forwardAxis':'+Z','animationClips':clips,'contactPhases':[0,.5],'strideMetres':{'Walk':1.65,'Run':2.8,'Sprint':3.5},'triangles':sum(len(p.vertices)-2 for p in mesh.data.polygons),'bones':len(bones),'limitations':['Candidate procedural anatomy and cloth; needs close-view art and gait review.','Single LOD. Cloth uses secondary bones, not physical simulation.']}
(ROOT/'docs/village/traveller-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(json.dumps(manifest))
