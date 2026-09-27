"""Original stylized garden/pond kit. Run in a separate background Blender process.
Blender Z up, -Y forward; GLB Y up, +Z forward. Named pivots animate at runtime.
"""
import bpy, math, json, hashlib
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
bpy.ops.wm.read_factory_settings(use_empty=True)
palette = {
    'cream': '#fff0cc', 'white': '#f8faf1', 'gold': '#ffcb48', 'petal': '#ffe777',
    'orange': '#eb903f', 'ink': '#263b3b', 'brown': '#805136', 'soil': '#503a2f',
    'leaf': '#549951', 'light': '#9acb60', 'mint': '#469d77', 'pink': '#e47d94',
    'herb': '#528447', 'herb_light': '#80b355', 'lilac': '#a690d7', 'teal': '#579aab', 'red': '#da604d', 'copper': '#c99865',
}
materials = {}
for name, color in palette.items():
    srgb = tuple(int(color[i:i+2],16)/255 for i in (1,3,5))
    rgb = tuple(v/12.92 if v <= .04045 else ((v+.055)/1.055)**2.4 for v in srgb)
    m = bpy.data.materials.new(name); m.diffuse_color = (*rgb,1); materials[name] = m
shared = bpy.data.materials.new('Painted garden colors'); shared.use_nodes = True
bs = shared.node_tree.nodes.get('Principled BSDF'); bs.inputs['Roughness'].default_value = .75
attr = shared.node_tree.nodes.new('ShaderNodeVertexColor'); attr.layer_name = 'Color'
shared.node_tree.links.new(attr.outputs['Color'], bs.inputs['Base Color'])
roots = []

def group(name, parent=None, pos=(0,0,0)):
    ob = bpy.data.objects.new(name, None); bpy.context.collection.objects.link(ob)
    ob.parent = parent; ob.location = pos
    if parent is None: roots.append(ob)
    return ob

def finish(ob, name, color, parent):
    ob.name = name; ob.parent = parent; ob.data.materials.append(materials[color])
    for face in ob.data.polygons: face.use_smooth = True
    return ob

def oval(parent, name, pos, scale, color, segments=16):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=10, location=pos)
    ob = bpy.context.object; ob.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish(ob,name,color,parent)

def tube(parent, name, points, radius, color):
    curve=bpy.data.curves.new(name,'CURVE'); curve.dimensions='3D'; curve.bevel_depth=radius; curve.bevel_resolution=2
    spline=curve.splines.new('BEZIER'); spline.bezier_points.add(len(points)-1)
    for p,co in zip(spline.bezier_points,points):
        p.co=co; p.handle_left_type='AUTO'; p.handle_right_type='AUTO'
    ob=bpy.data.objects.new(name,curve); bpy.context.collection.objects.link(ob)
    bpy.context.view_layer.objects.active=ob; ob.select_set(True); bpy.ops.object.convert(target='MESH'); ob.select_set(False)
    return finish(ob,name,color,parent)

def cone(parent, name, pos, radius1, radius2, depth, color):
    bpy.ops.mesh.primitive_cone_add(vertices=16, radius1=radius1, radius2=radius2, depth=depth, location=pos)
    return finish(bpy.context.object,name,color,parent)

def leaf(parent, pos, scale, color='leaf', angle=0):
    ob=oval(parent,'Leaf',pos,scale,color,12); ob.rotation_euler[1]=angle; return ob

def eyes(parent, y, z, spread, size=.032):
    for side in [-1,1]:
        oval(parent,'Eye',(side*spread,y,z),(size,size*.5,size*1.15),'ink',12)
        oval(parent,'Eye glint',(side*spread-.006,y-.014,z+.009),(size*.26,size*.2,size*.26),'white',8)

for species, size, body_color in [('Duck',1,'cream'),('Duckling',.7,'gold'),('Swan',1.65,'white')]:
    root=group(species)
    oval(root,'Body',(0,.04,.24),(.34,.49,.28),body_color)
    oval(root,'Tail',(0,.46,.31),(.18,.27,.16),body_color).rotation_euler.x=-.4
    for side in [-1,1]:
        wing=group(species+'Wing'+('L' if side<0 else 'R'),root,(side*.27,.12,.3))
        oval(wing,'Feathered wing',(side*.02,0,0),(.105,.31,.18),'cream' if species=='Swan' else 'petal')
        for i in range(3): oval(wing,'Feather',(side*.035,.07+i*.065,-.04),(.075,.14,.065),body_color)
    head=group(species+'Head',root)
    if species=='Swan':
        tube(head,'Graceful neck',[(0,-.23,.31),(0,-.5,.63),(0,-.37,1.01),(0,-.52,1.19)],.105,'white')
        oval(head,'Head',(0,-.53,1.18),(.15,.2,.155),'white')
        oval(head,'Black mask',(0,-.697,1.16),(.115,.045,.076),'ink')
        oval(head,'Beak',(0,-.79,1.14),(.085,.15,.041),'orange')
        eyes(head,-.66,1.225,.09,.022)
    else:
        oval(head,'Head',(0,-.3,.58),(.255,.265,.255),body_color)
        oval(head,'Bill',(0,-.55,.505),(.155,.18,.052),'orange')
        eyes(head,-.537,.65,.125,.038)
        oval(head,'Cheek',(-.193,-.475,.555),(.051,.022,.026),'pink')
        oval(head,'Cheek',(.193,-.475,.555),(.051,.022,.026),'pink')
    root.scale=(size,)*3

root=group('Fish')
oval(root,'Koi body',(0,0,0),(.16,.42,.19),'orange')
oval(root,'White belly',(0,-.07,-.02),(.163,.21,.14),'cream')
tail=group('FishTail',root,(0,.34,0))
for side in [-1,1]:
    fin=oval(tail,'Tail fan',(side*.09,.14,.02),(.13,.19,.035),'gold'); fin.rotation_euler.z=side*.45
    fin=oval(root,'Pectoral fin',(side*.17,0,-.025),(.15,.14,.025),'gold'); fin.rotation_euler.z=side*.6
oval(root,'Dorsal fin',(0,.05,.15),(.025,.21,.12),'orange')
eyes(root,-.31,.07,.106,.025)

for name in ['Sunflower','Daisy','Mint','Sprout','Carrot','Radish','Reeds','Iris','Lily']:
    root=group(name)
    if name in ['Sunflower','Daisy','Iris']:
        h={'Sunflower':1.55,'Daisy':.68,'Iris':1.0}[name]
        tube(root,'Stem',[(0,0,0),(.035,0,h*.5),(0,0,h)],.025,'leaf')
        for side in [-1,1]: leaf(root,(side*.12,0,h*.42),(.22,.085,.045),angle=side*-.4)
        if name=='Iris':
            for i in range(5):
                a=i*math.tau/5
                oval(root,'Iris petal',(math.cos(a)*.11,math.sin(a)*.11,h),(.11,.075,.2),'lilac').rotation_euler.y=math.cos(a)*.7
            oval(root,'Iris heart',(0,0,h),(.045,.045,.09),'gold')
        else:
            r=.28 if name=='Sunflower' else .14
            for i in range(14 if name=='Sunflower' else 9):
                a=i*math.tau/(14 if name=='Sunflower' else 9)
                ob=oval(root,'Petal',(math.cos(a)*r,-.005,h+math.sin(a)*r),(r*.28,.045,r*.63),'gold' if name=='Sunflower' else 'cream')
                ob.rotation_euler.y=math.pi/2-a
            oval(root,'Flower heart',(0,-.045,h),(r*.64,.075,r*.64),'brown' if name=='Sunflower' else 'gold')
            if name=='Sunflower':
                for i in range(24):
                    a=i*2.399;r2=.15*math.sqrt(i/24)
                    oval(root,'Sunflower seeds',(math.cos(a)*r2,-.112,h+math.sin(a)*r2),(.014,.008,.016),'gold',8)
    elif name == 'Mint':
        # Opposite pairs, pointed serrated blades and raised veins make mint legible at garden scale.
        for stem in range(3):
            x=(stem-1)*.16; y=(stem%2)*.12-.06; h=.68+(stem%2)*.1
            tube(root,'Mint stem',[(x,y,0),(x+.025,y,h)],.014,'herb')
            for level in range(3):
                height=.23+level*.18
                for side in [-1,1]:
                    blade=group('Mint leaf',root,(x+.025*height/h,y,height))
                    blade.rotation_euler.z=level*1.35+(math.pi if side<0 else 0)+stem*.24
                    length=.32-level*.035; width=.13-level*.012
                    vertices=[(length*.46,0,.065)]; outline=[]
                    for edge in [-1,1]:
                        indices=range(17) if edge<0 else range(16,-1,-1)
                        for i in indices:
                            t=i/16
                            serration=.87 if i%2 else 1.06
                            outline.append((length*t,edge*width*math.sin(math.pi*t)*serration,.04*t+.04*math.sin(math.pi*t)))
                    vertices+=outline
                    faces=[(0,i+1,(i+1)%len(outline)+1) for i in range(len(outline))]
                    mesh=bpy.data.meshes.new('Serrated mint blade');mesh.from_pydata(vertices,[],faces);mesh.update()
                    ob=bpy.data.objects.new('Serrated mint blade',mesh);bpy.context.collection.objects.link(ob)
                    finish(ob,'Serrated mint blade','herb_light' if level==2 else 'herb',blade)
                    tube(blade,'Mint midrib',[(0,0,.008),(length*.45,0,.074),(length,0,.046)],.005,'herb_light')
                    for branch in [.3,.5,.7]:
                        for edge in [-1,1]:
                            tube(blade,'Mint vein',[(length*branch,0,.075),(length*(branch+.13),edge*width*.64,.067)],.0025,'herb_light')
    elif name == 'Sprout':
        tube(root,'Stem',[(0,0,0),(.04,0,.27)],.018,'leaf')
        for side in [-1,1]: leaf(root,(side*.105,0,.15),(.15,.075,.03),'light',side*.25)
    elif name in ['Carrot','Radish']:
        if name=='Carrot': cone(root,'Carrot',(0,0,.03),.025,.17,.45,'orange')
        else:
            oval(root,'Radish',(0,0,.12),(.22,.2,.2),'red')
            cone(root,'White root',(0,0,-.045),.01,.075,.19,'cream')
        for i in range(5):
            a=i*math.tau/5
            ob=leaf(root,(math.cos(a)*.09,math.sin(a)*.09,.36),(.06,.06,.27),'light' if i%2 else 'leaf')
            ob.rotation_euler=(math.sin(a)*.45,math.cos(a)*.45,0)
    elif name=='Reeds':
        for i in range(5):
            x=(i-2)*.1;h=.65+(i%3)*.26
            tube(root,'Reed',[(x,0,0),(x+.09,.025,h)],.017,'leaf')
            if i%2==0: oval(root,'Cattail',(x+.09,.025,h),(.045,.045,.16),'brown')
            ob=leaf(root,(x-.08,0,h*.45),(.04,.025,h*.6),'light');ob.rotation_euler.y=-.26
    else:
        oval(root,'Lily pad',(0,0,0),(.48,.43,.016),'mint')
        for i in range(7):
            a=i*math.tau/7
            ob=oval(root,'Lily petal',(math.cos(a)*.08,math.sin(a)*.08,.065),(.075,.13,.035),'pink');ob.rotation_euler.z=a
        oval(root,'Lily heart',(0,0,.095),(.055,.055,.04),'gold')

root=group('WateringCan')
cone(root,'Can',(0,0,.24),.22,.2,.44,'teal')
tube(root,'Spout',[(.17,0,.14),(.34,0,.3),(.53,0,.38)],.046,'teal')
oval(root,'Sprinkler rose',(.56,0,.39),(.07,.1,.065),'copper')
tube(root,'Handle',[(-.12,0,.42),(-.34,0,.53),(-.4,0,.28),(-.17,0,.13)],.034,'copper')
root=group('Basket')
oval(root,'Woven basket',(0,0,.14),(.44,.32,.19),'copper')
for i in range(5):
    z=.04+i*.048
    points=[(.43*math.cos(a*math.tau/24),.31*math.sin(a*math.tau/24),z) for a in range(25)]
    tube(root,'Basket weave',points,.012,'brown')
tube(root,'Basket handle',[(-.4,0,.2),(-.27,0,.59),(.27,0,.59),(.4,0,.2)],.027,'brown')
root=group('BreadPouch')
oval(root,'Linen pouch',(0,0,.18),(.24,.17,.24),'cream')
for i in range(7): oval(root,'Bread crumb',((i%3-1)*.105,((i//3)%2-.5)*.1,.36+(i%2)*.035),(.065,.05,.055),'copper',8)
root=group('Teapot')
oval(root,'Pot',(0,0,.22),(.25,.23,.22),'teal')
cone(root,'Lid',(0,0,.43),.18,.05,.07,'cream')
oval(root,'Lid knob',(0,0,.485),(.047,.047,.03),'gold')
tube(root,'Tea spout',[(.2,0,.18),(.37,0,.22),(.42,0,.37)],.053,'teal')
tube(root,'Tea handle',[(-.2,0,.35),(-.4,0,.38),(-.4,0,.08),(-.2,0,.1)],.035,'cream')

# Vertex colors allow one material per moving part instead of a draw per petal/feather.
for ob in list(bpy.context.scene.objects):
    if ob.type!='MESH': continue
    color=ob.data.materials[0].diffuse_color
    colors=ob.data.color_attributes.new(name='Color',type='FLOAT_COLOR',domain='CORNER')
    for c in colors.data: c.color=color
    ob.data.materials.clear(); ob.data.materials.append(shared)
# Mint has no animated joints; bake its leaf groups into one draw for held harvests.
mint=next(root for root in roots if root.name=='Mint')
bpy.context.view_layer.update()
for ob in list(mint.children_recursive):
    if ob.type=='MESH':
        matrix=ob.matrix_world.copy();ob.parent=mint;ob.matrix_world=matrix
for parent in [o for o in list(bpy.context.scene.objects) if o.type=='EMPTY']:
    parts=[o for o in parent.children if o.type=='MESH']
    if not parts: continue
    bpy.ops.object.select_all(action='DESELECT')
    for ob in parts: ob.select_set(True)
    bpy.context.view_layer.objects.active=parts[0]; bpy.ops.object.join();parts[0].name=parent.name+'Mesh'

bpy.ops.object.select_all(action='SELECT')
bpy.context.preferences.filepaths.save_version=0
source=ROOT/'assets/village/garden-pond.blend'; output=ROOT/'public/village/models/garden-pond.glb'
bpy.ops.wm.save_as_mainfile(filepath=str(source))
bpy.ops.export_scene.gltf(filepath=str(output),export_format='GLB',export_yup=True,export_animations=False)
manifest={'id':'garden-pond-v2','creator':'Original project artwork, Blender '+bpy.app.version_string,
    'source':str(source.relative_to(ROOT)),'runtime':str(output.relative_to(ROOT)),
    'bytes':output.stat().st_size,'sha256':hashlib.sha256(output.read_bytes()).hexdigest(),
    'models':[r.name for r in roots], 'animation':'Named wing, head and tail pivots; swimming, jumps, feeding, wind, watering and tea animated by the runtime.',
    'license':'Original project artwork; no third-party models or textures.',
    'triangles':sum(len(p.vertices)-2 for o in bpy.context.scene.objects if o.type=='MESH' for p in o.data.polygons)}
(ROOT/'docs/village/garden-pond-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(json.dumps(manifest))
