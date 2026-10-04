"""Original Blender town props. Coordinates below are game x/y/z, +Z forward.
Run: Blender --background --python scripts/village/create_town_kit.py
"""
import bpy, math, json, hashlib, random, sys
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.preferences.filepaths.save_version = 0
random.seed(104)
palette = {'wood':'#b39b73', 'dark':'#705643', 'soil':'#9c805d', 'roof':'#678276',
           'roof_light':'#819888', 'cream':'#eee1bd', 'green':'#52755d', 'gold':'#d0ad63',
           'straw':'#dbbf76', 'straw_dark':'#ad8d4f', 'stone':'#b5b69b'}
materials = {}
for name, color in palette.items():
    values = [int(color[i:i+2],16)/255 for i in (1,3,5)]
    linear = [v/12.92 if v <= .04045 else ((v+.055)/1.055)**2.4 for v in values]
    mat = bpy.data.materials.new('Painted town '+name); mat.use_nodes = True
    node = mat.node_tree.nodes.get('Principled BSDF'); node.inputs['Base Color'].default_value=(*linear,1)
    node.inputs['Roughness'].default_value=.94
    materials[name]=mat

def xyz(p): return (p[0], -p[2], p[1])
def root(name):
    ob=bpy.data.objects.new(name,None); bpy.context.collection.objects.link(ob); return ob
def finish(ob, parent, color):
    ob.parent=parent; ob.data.materials.append(materials[color]); return ob
def box(parent,p,size,color,angle=0,bevel=0):
    bpy.ops.mesh.primitive_cube_add(size=1,location=xyz(p)); ob=bpy.context.object
    ob.scale=(size[0],size[2],size[1]); ob.rotation_euler.y=-angle
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if bevel:
        mod=ob.modifiers.new('Soft handcrafted edges','BEVEL'); mod.width=bevel; mod.segments=2
        bpy.ops.object.modifier_apply(modifier=mod.name)
    return finish(ob,parent,color)
def oval(parent,p,size,color):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=12,ring_count=8,location=xyz(p)); ob=bpy.context.object
    ob.scale=(size[0],size[2],size[1]); bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    for poly in ob.data.polygons: poly.use_smooth=True
    return finish(ob,parent,color)
def rod(parent,a,b,r,color):
    start,end=Vector(xyz(a)),Vector(xyz(b)); delta=end-start
    bpy.ops.mesh.primitive_cylinder_add(vertices=8,radius=r,depth=delta.length,location=(start+end)/2)
    ob=bpy.context.object; ob.rotation_euler=delta.to_track_quat('Z','Y').to_euler()
    return finish(ob,parent,color)
def band(parent,ix,iz,ox,oz,y,color):
    n=144; verts=[]; faces=[]
    for i in range(n):
        a=i/n*math.tau
        verts.extend([xyz((math.cos(a)*ix,y,math.sin(a)*iz)),xyz((math.cos(a)*ox,y,math.sin(a)*oz))])
    for i in range(n):
        j=(i+1)%n; faces.append((i*2,i*2+1,j*2+1,j*2))
    mesh=bpy.data.meshes.new('Smooth earth circuit');mesh.from_pydata(verts,[],faces);mesh.update()
    ob=bpy.data.objects.new('Earth circuit',mesh);bpy.context.collection.objects.link(ob);return finish(ob,parent,color)
def flag(parent,p,color,flip=False):
    x,y,z=p; dx=-1 if flip else 1
    verts=[xyz((x,y,z)),xyz((x+dx*.94,y-.2,z)),xyz((x+dx*.78,y-.72,z)),xyz((x,y-.58,z))]
    mesh=bpy.data.meshes.new('Woven flag');mesh.from_pydata(verts,[],[(0,1,2,3)]);mesh.update()
    ob=bpy.data.objects.new('Woven flag',mesh);bpy.context.collection.objects.link(ob);finish(ob,parent,color)
    mod=ob.modifiers.new('Cloth thickness','SOLIDIFY');mod.thickness=.012
    bpy.context.view_layer.objects.active=ob;bpy.ops.object.modifier_apply(modifier=mod.name)
def batch(parent):
    for mat in materials.values():
        objects=[ob for ob in parent.children if ob.type=='MESH' and ob.data.materials and ob.data.materials[0]==mat]
        if not objects: continue
        bpy.ops.object.select_all(action='DESELECT')
        for ob in objects: ob.select_set(True)
        bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join()
        ob=bpy.context.object;ob.name=parent.name+'_'+mat.name.replace('Painted town ','')
        # Broad face tint provides painted variation without extra textures or draws.
        tint=ob.data.color_attributes.new(name='Color',type='FLOAT_COLOR',domain='CORNER')
        for poly in ob.data.polygons:
            variation=.94+random.random()*.12
            base=mat.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value
            for loop in poly.loop_indices:tint.data[loop].color=(base[0]*variation,base[1]*variation,base[2]*variation,1)
        shader=mat.node_tree.nodes.get('Principled BSDF')
        attr=mat.node_tree.nodes.get('Painted face tint')
        if not attr:
            attr=mat.node_tree.nodes.new('ShaderNodeVertexColor');attr.name='Painted face tint';attr.layer_name='Color'
            mat.node_tree.links.new(attr.outputs['Color'],shader.inputs['Base Color'])

track=root('HorseRacetrack')
band(track,21.4,11.4,26.6,16.6,.035,'soil')
for lane in [-1.2,1.2]:band(track,24+lane-.09,14+lane-.09,24+lane+.09,14+lane+.09,.04,'straw_dark')
for rx,rz,n in [(27.2,17.2,64),(20.8,10.8,48)]:
    def gate(a):return abs(math.sin(a))<.19 and math.cos(a)>0 or abs(math.cos(a))<.28 and math.sin(a)>0
    for i in range(n):
        a=i/n*math.tau;b=(i+1)/n*math.tau
        if not gate(a):
            x,z=math.cos(a)*rx,math.sin(a)*rz
            box(track,(x,.72,z),(.15,1.44,.15),'wood',bevel=.02)
            oval(track,(x,1.47,z),(.115,.075,.115),'cream')
        if gate(a) or gate(b):continue
        for y in [.52,1.05]:rod(track,(math.cos(a)*rx,y,math.sin(a)*rz),(math.cos(b)*rx,y,math.sin(b)*rz),.065,'wood')
for i in range(8):
    a=i/8*math.tau;x,z=math.cos(a)*27.1,math.sin(a)*17.1
    # Keep the south gate marker beside the approach, clear of the stable's center bay.
    if i == 2: x,z=6.4,16.8
    rod(track,(x,0,z),(x,2.45,z),.07,'dark');flag(track,(x,2.4,z),'gold' if i%2 else 'green')
for z in [11.55,16.45]:
    rod(track,(.75,0,z),(.75,3.25,z),.08,'dark');oval(track,(.75,3.34,z),(.12,.14,.12),'gold')
    flag(track,(.75,3.12,z),'green' if z<14 else 'gold',True)
for i in range(12):
    for row in range(2):box(track,((row-.5)*.23,.044,11.55+i*.405),(.23,.008,.405),'cream' if (i+row)%2 else 'green')
for side in [-1,1]:
    oval(track,(side*8.1,.18,16.3),(.7,.3,.6),'stone')
    for i in range(6):oval(track,(side*8.1+math.cos(i*2.4)*.35,.45+i%2*.12,16.3+math.sin(i*2.4)*.32),(.18,.3,.15),'green')
batch(track)

def make_hay(parent,ox=0,oy=0,oz=0):
    box(parent,(ox,oy+.35,oz),(1.05,.7,.68),'straw',bevel=.07)
    for x in [-.28,.28]:
        for z in [-.348,.348]:box(parent,(ox+x,oy+.353,oz+z),(.025,.53,.022),'dark')
        box(parent,(ox+x,oy+.703,oz),(.025,.018,.59),'dark')
    for i in range(15):
        x=-.46+i*.063;rod(parent,(ox+x,oy+.18,oz+.347),(ox+x+math.sin(i*1.7)*.035,oy+.61,oz+.347),.006,'straw_dark')
        rod(parent,(ox+x,oy+.704,oz-.28),(ox+x+.04,oy+.704,oz+.28),.006,'straw_dark')
hay=root('HayBale');make_hay(hay);batch(hay)
stable=root('HorseStable');box(stable,(0,.07,0),(8.8,.14,5.6),'stone')
for x in [-4.15,0,4.15]:
    for z in [-2.45,2.45]:box(stable,(x,1.72,z),(.24,3.44,.24),'wood',bevel=.04)
for x in [-4.15,4.15]:
    for i in range(8):box(stable,(x,.8,-2.1+i*.6),(.11,1.45,.53),'wood' if i%3 else 'dark')
    for y in [.3,1.48,3.05]:box(stable,(x,y,0),(.19,.14,5.1),'dark')
    rod(stable,(x,1.58,-2.3),(x,3.1,-.8),.075,'wood');rod(stable,(x,1.58,2.3),(x,3.1,.8),.075,'wood')
for i in range(14):box(stable,(-3.9+i*.6,.85,-2.45),(.54,1.6,.12),'wood' if i%4 else 'dark')
for y in [.3,1.56,3.1]:box(stable,(0,y,-2.45),(8.5,.14,.19),'dark')
for y in [.58,1.1]:box(stable,(0,y,-.3),(.12,.14,4.15),'wood')
box(stable,(0,3.16,2.45),(8.6,.3,.23),'wood')
slope=math.atan2(1.35,4.7)
for side in [-1,1]:
    box(stable,(side*2.35,4.025,0),(4.94,.12,6.2),'roof',angle=-side*slope)
    for row in range(7):
        for col in range(10):
            x=side*(.22+row*.67);y=4.7-abs(x)*math.tan(slope)+.085;z=-2.75+col*.6+row%2*.1
            box(stable,(x,y,z),(.76,.05,.56),'roof' if (row+col*2)%5 else 'roof_light',angle=-side*slope,bevel=.022)
for z in [-2.8,2.8]:
    rod(stable,(-4.7,3.35,z),(0,4.7,z),.1,'cream');rod(stable,(0,4.7,z),(4.7,3.35,z),.1,'cream')
rod(stable,(0,4.76,-3.13),(0,4.76,3.13),.115,'dark')
for x in [-2.1,2.1]:
    box(stable,(x,.71,-1.9),(2.7,.14,.74),'dark')
    for dx in [-1.1,1.1]:box(stable,(x+dx,.44,-1.9),(.1,.8,.65),'wood')
    for i in range(8):rod(stable,(x-1.14+i*.326,.76,-1.49),(x-1.14+i*.326,1.28,-1.68),.025,'wood')
    for i in range(18):rod(stable,(x-1.13+i*.126,.84,-1.97),(x-1.03+i*.126,1.04+i%4*.05,-1.65),.025,'straw' if i%3 else 'straw_dark')
    box(stable,(x,3.16,2.585),(.66,.38,.045),'green',bevel=.04)
    for i in range(12):
        a=.2+i/11*math.pi*1.65;oval(stable,(x+math.cos(a)*.105,3.18+math.sin(a)*.105,2.62),(.026,.026,.016),'cream')
make_hay(stable,3.35,.14,1.55);batch(stable)

farm=root('FarmRow');box(farm,(0,.09,0),(16,.18,1.2),'soil',bevel=.05)
for z in [-.52,.52]:rod(farm,(-8,.09,z),(8,.09,z),.055,'wood')
for x in [-8,8]:
    box(farm,(x,.16,0),(.16,.32,1.35),'wood',bevel=.03)
    for z in [-.51,.51]:oval(farm,(x,.31,z),(.085,.05,.085),'cream')
for x in [-7.6+i*.4 for i in range(39)]:
    box(farm,(x,.187,0),(.02,.012,1.04),'dark')
batch(farm)

models=[track,stable,farm,hay]
def collider(x,z,w,d,bottom=0,top=1.5):return {'x':x,'z':z,'w':w,'d':d,'bottom':bottom,'top':top}
track_colliders=[]
for rx,rz,n in [(27.2,17.2,64),(20.8,10.8,48)]:
    for i in range(n):
        a=i/n*math.tau;b=(i+1)/n*math.tau
        gate=lambda angle:abs(math.sin(angle))<.19 and math.cos(angle)>0 or abs(math.cos(angle))<.28 and math.sin(angle)>0
        x,z=math.cos(a)*rx,math.sin(a)*rz
        if not gate(a):track_colliders.append(collider(x,z,.18,.18,0,1.55))
        if gate(a) or gate(b):continue
        bx,bz=math.cos(b)*rx,math.sin(b)*rz
        track_colliders.append(collider((x+bx)/2,(z+bz)/2,abs(x-bx)+.13,abs(z-bz)+.13,.45,1.12))
for z in [11.55,16.45]:track_colliders.append(collider(.75,z,.16,.16,0,3.3))
stable_colliders=[]
for x in [-4.15,0,4.15]:
    for z in [-2.45,2.45]:stable_colliders.append(collider(x,z,.24,.24,0,3.44))
for x in [-4.15,4.15]:stable_colliders.append(collider(x,0,.22,5.1,.07,1.6))
stable_colliders.append(collider(0,-2.45,8.5,.22,.07,1.65))
stable_colliders.append(collider(0,-.3,.12,4.15,.5,1.2))
for x in [-2.1,2.1]:stable_colliders.append(collider(x,-1.9,2.7,.8,0,1.32))
stable_colliders.append(collider(3.35,1.55,1.05,.68,.14,.84))
for model,colliders in [(track,track_colliders),(stable,stable_colliders),(farm,[collider(0,0,16.16,1.35,0,.32)]),(hay,[collider(0,0,1.05,.68,0,.7)])]:
    model['townColliders']=json.dumps(colliders)
blend=ROOT/'assets/village/town-kit.blend';glb=ROOT/'public/village/models/town-kit.glb'
blend.parent.mkdir(parents=True,exist_ok=True);glb.parent.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=str(blend))
bpy.ops.object.select_all(action='DESELECT')
for ob in bpy.data.objects:
    if ob in models or ob.parent in models:ob.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(glb),export_format='GLB',use_selection=True,export_yup=True,export_apply=True,export_extras=True)
manifest={'creator':'Original Blender artwork','blender':bpy.app.version_string,'roots':[m.name for m in models],
          'sha256':hashlib.sha256(glb.read_bytes()).hexdigest(),'bytes':glb.stat().st_size,
          'meshes':sum(ob.type=='MESH' for ob in bpy.data.objects)}
(ROOT/'docs/village/town-kit-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
if '--assets-only' in sys.argv:
    print(json.dumps(manifest)); sys.exit(0)

# Inspect the source models under soft light before runtime placement.
evidence=ROOT/'docs/village/evidence/town-expansion-20261004';evidence.mkdir(parents=True,exist_ok=True)
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=24
scene.render.resolution_x=1100;scene.render.resolution_y=800;scene.render.resolution_percentage=100
scene.world=bpy.data.worlds.new('Town preview daylight');scene.world.color=(.35,.4,.36);scene.view_settings.view_transform='AgX'
bpy.ops.mesh.primitive_plane_add(size=200);ground=bpy.context.object
ground_mat=bpy.data.materials.new('Preview sage');ground_mat.diffuse_color=(.25,.34,.25,1);ground.data.materials.append(ground_mat)
for p,energy,size in [((5,-8,16),1800,9),((-8,2,10),1100,10)]:
    bpy.ops.object.light_add(type='AREA',location=p);light=bpy.context.object;light.data.energy=energy;light.data.shape='DISK';light.data.size=size
    light.rotation_euler=(Vector((0,0,0))-light.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add();camera=bpy.context.object;scene.camera=camera;camera.data.type='ORTHO'
for model,scale,pos,look in [(stable,13,(10,-13,10),(0,0,1.8)),(track,65,(45,-50,45),(0,0,0)),(farm,20,(13,-12,9),(0,0,0)),(hay,2.1,(2,-3,2),(0,0,.3))]:
    for ob in bpy.data.objects:
        if ob in models or ob.parent in models:ob.hide_render=not(ob==model or ob.parent==model)
    camera.location=pos;camera.data.ortho_scale=scale
    camera.rotation_euler=(Vector(look)-camera.location).to_track_quat('-Z','Y').to_euler()
    scene.render.filepath=str(evidence/('asset-'+model.name+'.png'));bpy.ops.render.render(write_still=True)
print(json.dumps(manifest))
