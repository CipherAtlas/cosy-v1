"""Original Cosy flying spirit. Run with Blender --background --python (isolated scene).
Metres, Blender -Y forward / Z up. GLB +Z forward / Y up. Runtime handles hovering.
"""
import bpy, math, json, hashlib
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
bpy.ops.wm.read_factory_settings(use_empty=True)
def material(name,color,roughness=.6,emission=0):
 m=bpy.data.materials.new(name);m.use_nodes=True
 bs=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
 bs.inputs['Base Color'].default_value=(*color,1);bs.inputs['Roughness'].default_value=roughness
 bs.inputs['Emission Color'].default_value=(*color,1);bs.inputs['Emission Strength'].default_value=emission
 return m
cloud=material('Pearl white spirit',(.82,.88,.94),.47,.12)
ink=material('Warm ink smile',(.018,.024,.037),.8)
blush=material('Peach cheeks',(.96,.34,.32),.8,.12)
meshes=[]
def finish(ob,mat):
 ob.data.materials.append(mat)
 for poly in ob.data.polygons:poly.use_smooth=True
 meshes.append(ob);return ob
# Continuous soft silhouette with a little swept wisp at the crown.
rings=[(.025,.04,.032,0),(.065,.19,.14,0),(.15,.32,.25,0),(.29,.405,.31,0),(.46,.435,.335,0),(.62,.405,.31,0),(.76,.33,.26,.006),(.85,.235,.195,.015),(.91,.145,.13,.038),(.975,.085,.07,.08),(1.015,.035,.026,.13),(1.018,.005,.005,.155)]
verts=[];faces=[];segments=48
for z,rx,ry,shift in rings:
 for i in range(segments):
  a=i/segments*math.tau;verts.append((shift+rx*math.cos(a),ry*math.sin(a),z))
for r in range(len(rings)-1):
 for i in range(segments):
  a=r*segments+i;b=r*segments+(i+1)%segments;faces.append((a,b,b+segments,a+segments))
faces.append(tuple(range(segments-1,-1,-1)));faces.append(tuple((len(rings)-1)*segments+i for i in range(segments)))
me=bpy.data.meshes.new('Soft continuous cloud');me.from_pydata(verts,[],faces);me.update()
body=bpy.data.objects.new('SpiritBody',me);bpy.context.collection.objects.link(body);finish(body,cloud)
bpy.context.view_layer.objects.active=body;body.select_set(True)
sub=body.modifiers.new('Soft silhouette','SUBSURF');sub.levels=2;bpy.ops.object.modifier_apply(modifier=sub.name);body.select_set(False)
def oval(name,pos,scale,mat):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=24,ring_count=16,location=pos);ob=bpy.context.object;ob.name=name;ob.scale=scale
 bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 return finish(ob,mat)
for side in [-1,1]:
 fin=oval('SpiritFinL' if side<0 else 'SpiritFinR',(side*.426,.015,.405),(.135,.125,.08),cloud)
 fin.rotation_euler.y=side*-.28
 oval('Kind eye', (side*.128,-.318,.546),(.031,.014,.046),ink)
 oval('Soft rosy cheek',(side*.227,-.279,.435),(.065,.009,.027),blush)
# Smile follows the curved surface, so it remains attached in side views.
curve=bpy.data.curves.new('Cartoon smile curve','CURVE');curve.dimensions='3D';curve.resolution_u=16;curve.bevel_depth=.013;curve.bevel_resolution=3
spline=curve.splines.new('POLY');spline.points.add(24)
for i in range(25):
 t=i/24;x=(t-.5)*.155;z=.425-.051*math.sin(t*math.pi)
 y=-.334*math.sqrt(max(.01,1-(x/.438)**2-((z-.46)/.46)**2))-.005
 spline.points[i].co=(x,y,z,1)
smile=bpy.data.objects.new('Gentle smile',curve);bpy.context.collection.objects.link(smile);smile.data.materials.append(ink)
bpy.context.view_layer.objects.active=smile;smile.select_set(True);bpy.ops.object.convert(target='MESH');smile=bpy.context.object;meshes.append(smile)
# Join facial pieces per material; keep named fins separate for subtle runtime motion.
for mat in [ink,blush]:
 bpy.ops.object.select_all(action='DESELECT');parts=[o for o in bpy.context.scene.objects if o.type=='MESH' and o.data.materials and o.data.materials[0]==mat]
 for o in parts:o.select_set(True)
 bpy.context.view_layer.objects.active=parts[0];bpy.ops.object.join();parts[0].name='SpiritFace' if mat==ink else 'SpiritCheeks'
bpy.ops.object.select_all(action='SELECT')
bpy.context.preferences.filepaths.save_version=0
source=ROOT/'assets/village/spirit.blend';output=ROOT/'public/village/models/spirit.glb'
bpy.ops.wm.save_as_mainfile(filepath=str(source))
bpy.ops.export_scene.gltf(filepath=str(output),export_format='GLB',export_yup=True,export_animations=False)
manifest={'id':'cosy-spirit-v1','status':'original stylized player','runtimeFile':str(output.relative_to(ROOT)),'sourceFile':str(source.relative_to(ROOT)),'creatorOrTool':'Original scripted modeling, Blender '+bpy.app.version_string,'license':'Original project artwork; no third-party character assets','sha256':hashlib.sha256(output.read_bytes()).hexdigest(),'bytes':output.stat().st_size,'units':'metres','upAxis':'+Y','forwardAxis':'+Z','triangles':sum(len(p.vertices)-2 for o in bpy.context.scene.objects if o.type=='MESH' for p in o.data.polygons),'materials':3,'textures':0,'animation':'Runtime hover, lean, fin flutter and jump squash; collision follows existing ground traversal. No free vertical flight.'}
(ROOT/'docs/village/spirit-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n');print(json.dumps(manifest))
