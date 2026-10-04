"""Original animal art, authored in staged passes through the live Blender MCP.

Run helpers, then build one species and review it before calling finish().
Units are metres, Blender Z up and -Y forward; glTF exports Y up, +Z forward.
The curved cages use deliberately placed anatomical cross sections. Voxel unions
are confined to continuous skin; hair, feathers and horns retain designed cages.
"""
import bpy
import math
import json
import hashlib
from pathlib import Path
from mathutils import Vector, Quaternion

ROOT = Path('/Users/sabar/Documents/cosy-v1')
OUT = ROOT / 'public/village/models/animals-v2'
SOURCE = ROOT / 'assets/village/animals-v2'
EVIDENCE = ROOT / 'docs/village/evidence/animals-v2'
for directory in (OUT, SOURCE, EVIDENCE):
    directory.mkdir(parents=True, exist_ok=True)

PALETTE = {
    'bay': '#a96543', 'baylight': '#c48a59', 'hair': '#352c2b',
    'grey': '#aab7b5', 'greylight': '#d9dfd6', 'cream': '#f2e6cc',
    'ink': '#252e2b', 'hoof': '#494440', 'nose': '#66524b',
    'ginger': '#bd804b', 'gold': '#dba467', 'wool': '#e6ddc9',
    'woolshade': '#b8ab92', 'face': '#a7957c', 'pink': '#be8d84',
    'owl': '#917456', 'owldark': '#5c4e42', 'owlface': '#e1ceac',
    'duck': '#e6bb57', 'bill': '#c78538', 'swan': '#eee9d8',
    'sage': '#658679', 'leather': '#655045', 'brass': '#bda16a',
}

def rgba(color):
    color = PALETTE.get(color, color)
    rgb = [int(color[i:i+2],16)/255 for i in (1,3,5)]
    return tuple(v/12.92 if v <= .04045 else ((v+.055)/1.055)**2.4 for v in rgb)+(1,)

def smoothstep(a,b,t):
    u=max(0,min(1,(t-a)/(b-a)))
    return u*u*(3-2*u)

def art_material(name, roughness):
    old = bpy.data.materials.get(name)
    if old:
        return old
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    shader = next(n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    shader.inputs['Roughness'].default_value = roughness
    shader.inputs['Metallic'].default_value = 0
    colors = mat.node_tree.nodes.new('ShaderNodeVertexColor')
    colors.layer_name = 'ArtColor'
    mat.node_tree.links.new(colors.outputs['Color'], shader.inputs['Base Color'])
    return mat

MATTE = art_material('AnimalArt_Matte', .82)
GLOSS = art_material('AnimalArt_Eye', .27)

def select(ob):
    bpy.ops.object.select_all(action='DESELECT')
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob

def pivot(name, pos=(0,0,0), parent=None):
    ob = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(ob)
    ob.location = pos
    ob.parent = parent
    return ob

def paint(ob, color, material=MATTE):
    ob.data.materials.clear()
    ob.data.materials.append(material)
    old = ob.data.color_attributes.get('ArtColor')
    if old:
        ob.data.color_attributes.remove(old)
    attr = ob.data.color_attributes.new(name='ArtColor', type='FLOAT_COLOR', domain='POINT')
    for v in ob.data.vertices:
        attr.data[v.index].color = color(v.co) if callable(color) else rgba(color)
    for poly in ob.data.polygons:
        poly.use_smooth = True
    return ob

def mesh(name, vertices, faces, color, parent=None, material=MATTE):
    data = bpy.data.meshes.new(name+'_Mesh')
    data.from_pydata(vertices, [], faces)
    data.update()
    ob = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(ob)
    ob.parent = parent
    return paint(ob,color,material)

def catmull(values, t):
    i = min(int(t),len(values)-2)
    f = t-i
    a,b,c,d = [values[max(0,min(len(values)-1,k))] for k in (i-1,i,i+1,i+2)]
    return .5*((2*b)+(-a+c)*f+(2*a-5*b+4*c-d)*f*f+(-a+3*b-3*c+d)*f*f*f)

def sweep(name, sections, color, parent=None, sides=16, steps=3, plane='path', flute=0, power=1):
    """Closed cross-section cage. Each section is (x,y,z,width,depth)."""
    values = [Vector(s) for s in sections]
    rings = [catmull(values,i/steps) for i in range((len(values)-1)*steps+1)]
    verts, faces = [], []
    for i,ring in enumerate(rings):
        center = Vector(ring[:3])
        tangent = (Vector(rings[min(i+1,len(rings)-1)][:3])-Vector(rings[max(0,i-1)][:3])).normalized()
        across = Vector((1,0,0))
        if abs(tangent.dot(across)) > .9:
            across = Vector((0,1,0))
        u = (across-tangent*tangent.dot(across)).normalized()
        v = tangent.cross(u).normalized()
        if plane == 'body':
            u,v = Vector((1,0,0)),Vector((0,0,1))
        elif plane == 'vertical':
            u,v = Vector((1,0,0)),Vector((0,1,0))
        for j in range(sides):
            angle = math.tau*j/sides
            cs,sn = math.cos(angle), math.sin(angle)
            cs = math.copysign(abs(cs)**power,cs)
            sn = math.copysign(abs(sn)**power,sn)
            ridge = 1+flute*math.cos(angle*5)
            verts.append(center+u*cs*max(.001,ring[3])*ridge+v*sn*max(.001,ring[4])*ridge)
    for i in range(len(rings)-1):
        for j in range(sides):
            a=i*sides+j; b=i*sides+(j+1)%sides
            faces.append((a,b,b+sides,a+sides))
    verts += [Vector(rings[0][:3]),Vector(rings[-1][:3])]
    first,last=len(verts)-2,len(verts)-1
    for j in range(sides):
        faces.append((first,(j+1)%sides,j))
        a=(len(rings)-1)*sides+j; b=(len(rings)-1)*sides+(j+1)%sides
        faces.append((last,a,b))
    ob=mesh(name,verts,faces,color,parent)
    select(ob)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.normals_make_consistent(inside=False)
    bpy.ops.object.mode_set(mode='OBJECT')
    return ob

def form(name,pos,size,color,parent=None,tilt=0,sides=20,rings=12,material=MATTE):
    """A reshaped closed cage for compact details, with flat poles avoided."""
    x,y,z=pos; rx,ry,rz=size
    sections=[]
    for i in range(rings+1):
        a=math.pi*i/rings
        sections.append((x,y-ry*math.cos(a),z, max(.002,rx*math.sin(a)),max(.002,rz*math.sin(a))))
    ob=sweep(name,sections,color,parent,sides=sides,steps=1,plane='body')
    if tilt:
        from mathutils import Matrix
        turn=Matrix.Translation(Vector(pos)) @ Matrix.Rotation(tilt,4,'X') @ Matrix.Translation(-Vector(pos))
        ob.data.transform(turn)
    if material != MATTE:
        paint(ob,color,material)
    return ob

def union(name,objects,color,parent=None,voxel=.025,target=4500):
    bpy.ops.object.select_all(action='DESELECT')
    for ob in objects:
        ob.select_set(True)
    bpy.context.view_layer.objects.active=objects[0]
    bpy.ops.object.join()
    ob=objects[0];ob.name=name
    mod=ob.modifiers.new('Continuous anatomical surface','REMESH')
    mod.mode='VOXEL';mod.voxel_size=voxel;mod.use_smooth_shade=True
    bpy.ops.object.modifier_apply(modifier=mod.name)
    mod=ob.modifiers.new('Sculpt relaxation','SMOOTH');mod.factor=.85;mod.iterations=4
    bpy.ops.object.modifier_apply(modifier=mod.name)
    ob.data.calc_loop_triangles()
    triangles=len(ob.data.loop_triangles)
    if triangles>target:
        mod=ob.modifiers.new('Silhouette-aware game reduction','DECIMATE');mod.ratio=target/triangles
        bpy.ops.object.modifier_apply(modifier=mod.name)
    ob.parent=parent
    return paint(ob,color)

def eye(name,pos,size,parent,color='ink'):
    return form(name,pos,size,color,parent,sides=16,rings=8,material=GLOSS)

def attach(ob,parent):
    ob.parent=parent
    ob.location=-parent.location
    return ob

def descendants(root):
    return [root]+list(root.children_recursive)

def scene_start():
    scene=bpy.data.scenes.get('Animal Art Studio') or bpy.data.scenes.new('Animal Art Studio')
    bpy.context.window.scene=scene
    scene.world=bpy.data.worlds.new('Animal Art Soft World') if not scene.world else scene.world
    scene.world.use_nodes=True
    bg=next(n for n in scene.world.node_tree.nodes if n.type=='BACKGROUND')
    bg.inputs['Color'].default_value=(.32,.38,.40,1);bg.inputs['Strength'].default_value=.45
    scene.render.engine='BLENDER_EEVEE'
    scene.render.resolution_x=1200;scene.render.resolution_y=900;scene.render.resolution_percentage=100
    scene.render.image_settings.file_format='PNG'
    scene.view_settings.view_transform='AgX'
    scene.view_settings.look='AgX - Medium High Contrast'
    bpy.ops.mesh.primitive_plane_add(size=200)
    ground=bpy.context.object;ground.name='StudioFloor'
    paint(ground,'#a3ada5');ground.location.z=-.012
    for name,pos,power,size in [('Key',(3,-4,7),1100,5),('Fill',(-4,-2,4),800,5),('Rim',(2,4,5),1300,4)]:
        data=bpy.data.lights.new('Studio'+name,'AREA');data.energy=power;data.shape='DISK';data.size=size
        ob=bpy.data.objects.new('Studio'+name,data);scene.collection.objects.link(ob);ob.location=pos
        ob.rotation_euler=(Vector((0,0,1))-ob.location).to_track_quat('-Z','Y').to_euler()
    data=bpy.data.cameras.new('ArtReviewCamera');cam=bpy.data.objects.new('ArtReviewCamera',data)
    scene.collection.objects.link(cam);scene.camera=cam;data.type='ORTHO'
    for area in bpy.context.screen.areas:
        if area.type=='VIEW_3D':
            area.spaces.active.overlay.show_overlays=False
            area.spaces.active.shading.type='MATERIAL'
            area.spaces.active.shading.studiolight_rotate_z=.4
    return scene

def review(root,view='three-quarter',stage='review',distance=4.2):
    for ob in bpy.context.scene.objects:
        if ob.name.startswith('Animal_') and ob.parent is None:
            ob.hide_set(ob!=root)
            ob.hide_render=ob!=root
            for child in ob.children_recursive:
                child.hide_set(ob!=root)
                child.hide_render=ob!=root
    bpy.context.view_layer.update()
    points=[ob.matrix_world@Vector(p) for ob in root.children_recursive if ob.type=='MESH' for p in ob.bound_box]
    target=Vector(tuple((min(p[i] for p in points)+max(p[i] for p in points))*.5 for i in range(3)))
    offset=Vector({'side':(1,0,.08),'front':(0,-1,.07),'three-quarter':(1,-1.65,.6),'back':(1,1,.3)}[view])
    cam=bpy.context.scene.camera;cam.location=target+offset.normalized()*8
    cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.ortho_scale=distance
    for area in bpy.context.screen.areas:
        if area.type=='VIEW_3D':
            space=area.spaces.active
            space.region_3d.view_location=target
            space.region_3d.view_distance=distance
            space.region_3d.view_rotation=cam.rotation_euler.to_quaternion()
            space.region_3d.view_perspective='ORTHO'
    select(root)
    bpy.context.scene.render.filepath=str(EVIDENCE/(stage+'.png'))
    print('REVIEW',root.name,view,stage)

def portrait(stage):
    bpy.context.scene.render.filepath=str(EVIDENCE/(stage+'.png'))
    bpy.ops.render.render(write_still=True)

def horse(stage='blockout',coat='bay'):
    root=pivot('Animal_Horse_'+coat)
    body=pivot('HorseBody',parent=root)
    coatcol=coat
    cage=sweep('Horse_Barrel',[(0,-.82,1.26,.05,.08),(0,-.68,1.26,.30,.36),(0,-.42,1.27,.36,.40),(0,-.06,1.24,.38,.35),(0,.33,1.29,.37,.35),(0,.64,1.30,.38,.38),(0,.89,1.31,.27,.29),(0,.99,1.31,.03,.07)],coatcol,body,plane='body')
    neck=pivot('HorseNeck',(0,-.57,1.43),body)
    neckskin=sweep('Horse_Neck',[(0,-.44,1.20,.19,.23),(0,-.53,1.40,.255,.32),(0,-.69,1.63,.23,.32),(0,-.83,1.88,.18,.25),(0,-.92,2.10,.15,.18),(0,-.96,2.25,.115,.12)],coatcol,body,steps=5,plane='vertical')
    shoulder=form('Horse_Shoulder',(0,-.56,1.23),(.335,.29,.43),coatcol,body)
    union('Horse_Torso',[cage,shoulder],coatcol,body,target=3100)
    attach(neckskin,neck)
    head=pivot('HorseHead',(0,-1.01,2.18),neck)
    head.location=Vector((0,-1.01,2.18))-neck.location
    headskin=sweep('Horse_Head',[(0,-.96,2.22,.10,.13),(0,-1.10,2.15,.16,.20),(0,-1.28,2.01,.13,.15),(0,-1.46,1.88,.12,.11),(0,-1.63,1.79,.135,.10),(0,-1.71,1.78,.08,.075)],coatcol,body,sides=20)
    jaw=form('Horse_Jaw',(0,-1.11,2.03),(.156,.19,.17),coatcol,body)
    headmesh=union('Horse_Face',[headskin,jaw],coatcol,body,voxel=.012,target=1850)
    headmesh.parent=head;headmesh.location=Vector((0,1.01,-2.18))
    for rear in (False,True):
        for side in (-1,1):
            label=('Back' if rear else 'Front')+('Left' if side<0 else 'Right')
            y=.65 if rear else -.57
            joint=pivot('HorseUpper'+label,(side*.26,y,1.19),body)
            if rear:
                sections=[(side*.24,.63,1.48,.055,.08),(side*.28,.59,1.21,.15,.21),(side*.28,.45,.91,.105,.13),(side*.27,.57,.65,.065,.09),(side*.27,.65,.60,.060,.07)]
            else:
                sections=[(side*.23,-.54,1.48,.055,.07),(side*.27,-.60,1.18,.12,.15),(side*.27,-.60,1.01,.09,.105),(side*.27,-.57,.82,.069,.078),(side*.27,-.57,.61,.065,.073)]
            limb=sweep('Horse_'+label+'_Upper',sections,coatcol,body,sides=14,steps=3,plane='vertical')
            attach(limb,joint)
            lower=pivot('HorseLower'+label,(0,0,-.58),joint)
            low=sweep('Horse_'+label+'_Cannon',[(side*.27,y,.65,.063,.072),(side*.27,y,.51,.052,.06),(side*.27,y-.025,.28,.045,.052),(side*.27,y-.06,.16,.064,.08)],'hair',body,sides=12,steps=2,plane='vertical')
            low.parent=lower;low.location=Vector((-side*.26,-y,-.61))
            hoof=sweep('Horse_'+label+'_Hoof',[(side*.27,y-.075,.17,.069,.087),(side*.27,y-.08,.12,.084,.104),(side*.27,y-.105,.035,.091,.118)],'hoof',body,sides=16,steps=2,plane='vertical',power=.8)
            hoof.parent=lower;hoof.location=low.location
    for side in (-1,1):
        ear=pivot('HorseEar'+('Left' if side<0 else 'Right'),(side*.115,-.95,2.24),body)
        shell=sweep('Horse_Ear',[(side*.115,-.95,2.23,.055,.045),(side*.135,-.93,2.39,.067,.034),(side*.16,-.94,2.50,.034,.02),(side*.165,-.95,2.55,.003,.003)],coatcol,body,sides=12,plane='vertical')
        attach(shell,ear)
    if stage=='blockout':
        return root
    # Mane follows one broad crest, with a scalloped edge and five shallow ridges.
    haircolor='greylight' if coat=='grey' else 'hair'
    mane=sweep('Horse_Mane',[(.015,-.84,2.28,.085,.045),(.03,-.76,2.14,.10,.085),(.055,-.66,1.92,.12,.115),(.08,-.46,1.70,.13,.13),(.10,-.33,1.52,.10,.11),(.12,-.22,1.46,.01,.015)],haircolor,body,sides=16,flute=.055)
    attach(mane,neck)
    forelock=sweep('Horse_Forelock',[(0,-.97,2.30,.095,.035),(.02,-1.08,2.23,.11,.04),(.045,-1.20,2.17,.065,.025),(.07,-1.23,2.12,.003,.003)],haircolor,body,sides=12)
    forelock.parent=head;forelock.location=headmesh.location
    tail=pivot('HorseTail',(0,.92,1.43),body)
    hair=sweep('Horse_Tail',[(0,.91,1.43,.07,.07),(0,1.10,1.19,.11,.09),(.025,1.17,.84,.145,.105),(.055,1.18,.47,.13,.085),(.09,1.12,.28,.09,.05),(.12,1.08,.22,.008,.006)],haircolor,body,sides=20,flute=.08)
    attach(hair,tail)
    if stage=='secondary':
        return root
    for side in (-1,1):
        rim=form('Horse_Eyelid',(side*.151,-1.135,2.135),(.018,.067,.054),coatcol,body,sides=16,rings=8)
        pupil=eye('Horse_Eye',(side*.166,-1.15,2.138),(.018,.043,.035),body)
        nostril=form('Horse_Nostril',(side*.117,-1.61,1.827),(.014,.044,.023),'nose',body,sides=12,rings=6)
        for ob in (rim,pupil,nostril):
            ob.parent=head;ob.location=headmesh.location
    pivot('HorseSeat',(0,.08,1.64),body)
    coatparts=[ob for ob in root.children_recursive if ob.type=='MESH' and (ob.name.startswith(('Horse_Torso','Horse_Neck','Horse_Face','Horse_Ear')) or ob.name.endswith('_Upper'))]
    skin=union('Horse_ContinuousSkin',coatparts,coatcol,body,voxel=.015,target=6500)
    def skin_color(p):
        base=Vector(rgba(coatcol));light=Vector(rgba('greylight' if coat=='grey' else 'baylight'))
        shade=max(0,min(.40,(p.z-.7)*.22))
        result=base.lerp(light,shade)
        if p.y < -1.52 and p.z < 1.97:
            result=result.lerp(Vector(rgba('nose')),max(0,min(1,(-p.y-1.52)/.10)))
        front=-1.13+(p.z-2.18)*1.25
        width=.026+.012*math.sin((p.z-1.86)*8)
        blaze=(1-smoothstep(width-.012,width+.022,abs(p.x)))*(1-smoothstep(front-.025,front+.01,p.y))*smoothstep(1.85,1.92,p.z)*(1-smoothstep(2.23,2.29,p.z))
        result=result.lerp(Vector(rgba('cream')),blaze)
        return tuple(result)
    paint(skin,skin_color)
    for ob in root.children_recursive:
        if ob.type=='MESH' and '_Cannon' in ob.name:
            label=ob.name.split('_')[1]
            if 'Left' in label or coat=='grey':
                paint(ob,lambda p: tuple(Vector(rgba('hair')).lerp(Vector(rgba('cream')),1-smoothstep(.23,.29,p.z))))
    return root

def archive(root,label):
    root.name=label
    for ob in descendants(root):
        ob.hide_set(True);ob.hide_render=True

def highland(stage='blockout',flower=False):
    root=pivot('Animal_Highland_'+('flower' if flower else 'copper'))
    body=pivot('CowBody',parent=root)
    skinparts=[sweep('Cow_Barrel',[(0,-.62,.91,.07,.13),(0,-.45,.92,.32,.34),(0,-.02,.87,.40,.37),(0,.46,.90,.39,.35),(0,.80,.88,.28,.29),(0,.91,.86,.025,.10)],'ginger',body,plane='body',sides=24)]
    skinparts.append(sweep('Cow_Neck',[(0,-.40,.81,.27,.30),(0,-.64,.98,.28,.28),(0,-.88,1.07,.26,.23)],'ginger',body,plane='body'))
    skinparts.append(sweep('Cow_Head',[(0,-.65,1.10,.19,.17),(0,-.81,1.08,.29,.27),(0,-1.01,.96,.25,.23),(0,-1.17,.84,.26,.15),(0,-1.31,.81,.20,.105)],'ginger',body,sides=24,plane='body'))
    for rear in (False,True):
        for side in (-1,1):
            y=.58 if rear else -.41
            skinparts.append(sweep('Cow_Leg',[(side*.26,y,.95,.12,.13),(side*.27,y,.63,.115,.12),(side*.27,y+.025,.34,.078,.088),(side*.27,y-.03,.11,.073,.081)],'ginger',body,plane='vertical',sides=14))
            sweep('Cow_Hoof',[(side*.27,y-.04,.14,.077,.085),(side*.27,y-.045,.09,.088,.10),(side*.27,y-.06,.025,.09,.115)],'hoof',body,plane='vertical',sides=16,power=.85)
    union('Cow_ContinuousSkin',skinparts,'ginger',body,voxel=.017,target=4300)
    for side in (-1,1):
        sweep('Cow_Horn',[(side*.24,-.74,1.23,.09,.07),(side*.45,-.74,1.30,.086,.065),(side*.64,-.68,1.38,.055,.045),(side*.75,-.64,1.54,.027,.025),(side*.79,-.62,1.64,.002,.002)],'cream',body,sides=16,steps=4)
        sweep('Cow_Ear',[(side*.23,-.82,1.08,.065,.05),(side*.41,-.86,1.06,.14,.064),(side*.52,-.85,1.09,.055,.03),(side*.56,-.84,1.11,.003,.003)],'ginger',body,sides=14)
    if stage=='blockout':
        return root
    # Coarse directional locks define the silhouette. No bead curtain or GPU hair.
    for side in (-1,1):
        for i in range(6):
            y=-.37+i*.215
            x=side*(.28+.07*math.sin(i*.6))
            sweep('Cow_FlankLock',[(x,y,1.17,.075,.13),(side*.37,y+.035,.91,.075,.145),(side*.42,y+.07,.71,.055,.115),(side*.41,y+.10,.61+.055*math.sin(i*1.9),.006,.012)],'ginger',body,sides=14,steps=4)
        sweep('Cow_CheekLock',[(side*.22,-.84,1.08,.065,.09),(side*.30,-.85,.84,.065,.08),(side*.28,-.87,.65,.005,.005)],'gold',body,sides=12)
    for i in range(5):
        x=(i-2)*.10
        sweep('Cow_Fringe',[(x,-.79,1.32,.074,.085),(x*.94,-.95,1.20,.072,.085),(x*1.10,-1.07,1.08+.04*abs(i-2),.025,.025),(x*1.10,-1.09,1.04+.04*abs(i-2),.003,.003)],'gold' if i%2 else 'ginger',body,sides=12)
    sweep('Cow_Tail',[(0,.88,.97,.038,.035),(0,1.03,.71,.035,.03),(.035,1.06,.40,.033,.025),(.08,1.0,.26,.065,.045),(.11,.97,.15,.004,.004)],'ginger',body,sides=12,flute=.04)
    if stage=='secondary':
        return root
    coatparts=[ob for ob in root.children_recursive if ob.type=='MESH' and ob.name.startswith(('Cow_ContinuousSkin','Cow_FlankLock','Cow_CheekLock','Cow_Fringe'))]
    skin=union('Cow_ShagSculpt',coatparts,'ginger',body,voxel=.014,target=6200)
    def cow_color(p):
        result=Vector(rgba('ginger')).lerp(Vector(rgba('gold')),max(0,min(.5,(p.z-.2)*.36)))
        if p.y < -1.16 and p.z < .98:
            result=result.lerp(Vector(rgba('nose')),max(0,min(1,(-p.y-1.16)/.10)))
        return tuple(result)
    paint(skin,cow_color)
    for side in (-1,1):
        form('Cow_Eyelid',(side*.237,-1.015,1.005),(.022,.057,.050),'gold',body,sides=14,rings=8)
        eye('Cow_Eye',(side*.255,-1.031,1.008),(.016,.037,.033),body)
    for side in (-1,1):
        form('Cow_Nostril',(side*.105,-1.304,.848),(.033,.009,.022),'ink',body,sides=12,rings=6)
    if flower:
        for i in range(5):
            a=math.tau*i/5
            form('Cow_FlowerPetal',(.34+.066*math.cos(a),-.805,1.16+.066*math.sin(a)),(.04,.022,.038),'pink',body,sides=12,rings=6)
        form('Cow_FlowerCenter',(.34,-.835,1.16),(.025,.012,.025),'duck',body,sides=12,rings=6)
    return root

def dog(stage='blockout',breed='shiba'):
    short=breed=='corgi';fluffy=breed in ('samoyed','collie');floppy=breed=='beagle'
    h=.46 if short else .60 if breed=='shepherd' else .56
    color='cream' if breed=='samoyed' else 'hair' if breed=='collie' else 'ginger'
    root=pivot('Animal_Dog_'+breed);body=pivot('DogBody',parent=root)
    parts=[sweep('Dog_Barrel',[(0,-.36,h,.04,.07),(0,-.25,h,.21,.24),(0,.07,h,.22,.215),(0,.27,h+.012,.19,.195),(0,.43,h,.215,.22),(0,.56,h,.08,.13),(0,.60,h,.002,.002)],color,body,plane='body',sides=24)]
    parts.append(sweep('Dog_Chest',[(0,-.18,h-.06,.18,.15),(0,-.31,h+.08,.235,.20),(0,-.39,h+.22,.20,.18)],color,body,plane='vertical'))
    hz=h+.26
    parts.append(sweep('Dog_Head',[(0,-.26,hz,.09,.09),(0,-.42,hz+.02,.23,.215),(0,-.57,hz,.22,.19),(0,-.70,hz-.075,.15,.11),(0,-.85,hz-.105,.125,.085),(0,-.88,hz-.105,.08,.062)],color,body,plane='body',sides=24))
    for rear in (False,True):
        for side in (-1,1):
            y=.36 if rear else -.29
            x=side*.16
            parts.append(sweep('Dog_Leg',[(x,y,h+.05,.07,.105),(x*1.04,y,h-.14,.08,.09),(x*1.05,y+(.04 if rear else 0),.24,.052,.062),(x*1.06,y-.035,.09,.062,.078)],color,body,plane='vertical',sides=14))
            parts.append(form('Dog_Paw',(x*1.07,y-.055,.064),(.081,.117,.060),color,body,sides=16,rings=8))
    skin=union('Dog_ContinuousSkin',parts,color,body,voxel=.010,target=4100)
    for side in (-1,1):
        if floppy:
            sweep('Dog_DropEar',[(side*.17,-.37,hz+.16,.075,.06),(side*.235,-.40,hz+.03,.093,.052),(side*.255,-.47,hz-.14,.075,.046),(side*.24,-.49,hz-.21,.02,.022)],'hair',body,sides=16)
        else:
            fold=breed=='collie'
            tall=.07 if breed=='shepherd' else 0
            sweep('Dog_Ear',[(side*.16,-.39,hz+.12,.075,.058),(side*.19,-.36,hz+.22,.078,.045),(side*.21,-.35,hz+.31+tall,.027,.018),(side*.23,-.40 if fold else -.36,hz+.32+tall if fold else hz+.355+tall,.003,.003)],color,body,sides=16,plane='vertical')
    if stage=='blockout':
        return root
    if fluffy:
        locks=[]
        for side in (-1,1):
            for i in range(3):
                locks.append(sweep('Dog_Ruff',[(side*.15,-.30+i*.035,h+.29-i*.10,.09,.12),(side*.26,-.25+i*.055,h+.13-i*.1,.07,.10),(side*.27,-.17+i*.065,h+.04-i*.11,.005,.008)],color,body,sides=12))
        skin=union('Dog_RuffSculpt',[skin]+locks,color,body,voxel=.010,target=4500)
    if breed in ('shiba','corgi','samoyed'):
        sweep('Dog_CurlTail',[(0,.52,h+.04,.065,.06),(.03,.67,h+.22,.08,.07),(.06,.66,h+.39,.085,.07),(.07,.48,h+.43,.075,.06),(.07,.40,h+.32,.02,.025)],color,body,sides=16,steps=4)
    else:
        sweep('Dog_LongTail',[(0,.52,h+.045,.065,.06),(0,.71,h+.11,.085,.065),(.025,.92,h+.24,.077,.06),(.06,1.05,h+.36,.032,.03),(.09,1.10,h+.42,.002,.002)],color,body,sides=16)
    if stage=='secondary':
        return root
    def dog_color(p):
        result=Vector(rgba(color))
        cream=Vector(rgba('cream'))
        if breed=='samoyed':
            return tuple(result.lerp(Vector(rgba('wool')),max(0,min(.35,(.7-p.z)*.4))))
        white=max(1-smoothstep(.11,.20,p.z),(1-smoothstep(-.28,-.18,p.y))*(1-smoothstep(h-.005,h+.115,p.z)),(1-smoothstep(-.69,-.59,p.y))*(1-smoothstep(hz-.06,hz+.06,p.z)))
        if breed=='collie':
            white=max(white,smoothstep(-.51,-.46,p.y)*(1-smoothstep(-.30,-.25,p.y))*(1-smoothstep(h+.31,h+.38,p.z)),(1-smoothstep(.025,.055,abs(p.x)))*(1-smoothstep(-.56,-.50,p.y)))
        elif breed=='beagle':
            white=max(white,(1-smoothstep(.02,.05,abs(p.x)))*(1-smoothstep(-.59,-.53,p.y)))
            saddle=smoothstep(-.20,-.10,p.y)*(1-smoothstep(.40,.49,p.y))*smoothstep(h+.04,h+.13,p.z)
            result=result.lerp(Vector(rgba('hair')),saddle)
        elif breed=='shepherd':
            white=0
            saddle=smoothstep(-.16,-.05,p.y)*smoothstep(h+.03,h+.13,p.z)
            mask=(1-smoothstep(-.69,-.59,p.y))*(1-smoothstep(hz+.025,hz+.13,p.z))
            result=result.lerp(Vector(rgba('hair')),max(saddle,mask))
        elif breed=='corgi':
            white=max(white,(1-smoothstep(.016,.04,abs(p.x)))*(1-smoothstep(-.57,-.51,p.y)))
        result=result.lerp(cream,white)
        return tuple(result)
    paint(skin,dog_color)
    for side in (-1,1):
        # Eyes sit on the sloped facial plane; a dark rim avoids separate googly whites.
        eye('Dog_Eye',(side*.155,-.630,hz+.064),(.025,.028,.024),body)
        if not floppy:
            form('Dog_InnerEar',(side*.188,-.398,hz+.225),(.040,.008,.057),'pink',body,sides=12,rings=8,tilt=-.08)
    eye('Dog_Nose',(0,-.872,hz-.068),(.071,.035,.042),body,'ink')
    sweep('Dog_Mouth',[(0,-.879,hz-.12,.006,.006),(0,-.856,hz-.16,.006,.006),(0,-.81,hz-.172,.006,.006)],'nose',body,sides=8,steps=2)
    return root

def sheep(stage='blockout',lamb=False):
    root=pivot('Animal_'+('Lamb' if lamb else 'Sheep'))
    body=pivot('SheepBody',parent=root)
    fleece=sweep('Sheep_Fleece',[(0,-.47,.77,.03,.05),(0,-.35,.80,.27,.31),(0,-.10,.80,.34,.33),(0,.25,.79,.345,.32),(0,.52,.78,.29,.30),(0,.66,.77,.05,.08),(0,.69,.76,.003,.003)],'wool',body,plane='body',sides=36,steps=5)
    for side in (-1,1):
        for rear in (False,True):
            y=.43 if rear else -.28
            sweep('Sheep_Leg',[(side*.19,y,.70,.065,.075),(side*.20,y,.43,.054,.063),(side*.20,y-.02,.17,.039,.047),(side*.20,y-.055,.065,.044,.055)],'face',body,plane='vertical',sides=12)
            sweep('Sheep_Hoof',[(side*.20,y-.06,.095,.044,.053),(side*.20,y-.075,.025,.049,.063)],'hoof',body,plane='vertical',sides=12,power=.82)
    face=sweep('Sheep_Face',[(0,-.33,.87,.10,.12),(0,-.48,.91,.14,.17),(0,-.62,.88,.145,.17),(0,-.75,.74,.115,.12),(0,-.84,.69,.097,.08),(0,-.89,.69,.022,.027)],'face',body,plane='body',sides=24,steps=4)
    for side in (-1,1):
        sweep('Sheep_Ear',[(side*.10,-.47,.97,.047,.045),(side*.23,-.50,.97,.095,.03),(side*.34,-.53,.94,.052,.025),(side*.40,-.55,.96,.003,.003)],'face',body,sides=16)
    if stage=='blockout':
        return root
    # Low-frequency curls deform a single closed fleece cage; they never become beads.
    for v in fleece.data.vertices:
        p=v.co
        angle=math.atan2((p.z-.79)/.33,p.x/.34)
        bulge=0
        for row in range(7):
            cy=-.36+row*.145
            for curl in range(10):
                ca=math.tau*curl/10+row*.37+.08*math.sin(row+curl*2.1)
                da=math.atan2(math.sin(angle-ca),math.cos(angle-ca))
                dy=(p.y-cy)/.095
                bulge+=(.058+.014*math.sin(row*3+curl))*math.exp(-((da/.25)**2+dy*dy)*.65)
        bulge*=smoothstep(-.48,-.25,p.y)*(1-smoothstep(.52,.69,p.y))
        p.x+=math.cos(angle)*bulge
        p.z+=math.sin(angle)*bulge
    select(fleece)
    sub=fleece.modifiers.new('Soft wool lobes','SUBSURF');sub.levels=1
    bpy.ops.object.modifier_apply(modifier=sub.name)
    curls=[]
    for row in range(5):
        y=-.27+row*.18
        for curl in range(9):
            angle=math.tau*curl/9+row*.29
            x=math.cos(angle)*(.29 if row in (0,4) else .32)
            z=.79+math.sin(angle)*(.29 if row in (0,4) else .315)
            size=.11+.016*math.sin(row*7+curl*2.3)
            curls.append(form('Sheep_WoolCurl',(x,y+.015*math.sin(curl),z),(size,.135,size*.9),'wool',body,sides=14,rings=8))
    fleece=union('Sheep_FleeceSculpt',[fleece]+curls,'wool',body,voxel=.010,target=4600)
    scalp=form('Sheep_Forelock',(0,-.48,1.005),(.165,.17,.095),'wool',body,sides=24,rings=10)
    for v in scalp.data.vertices:
        v.co.z+=.012*math.sin(v.co.x*50)*math.cos(v.co.y*48)
    sweep('Sheep_Tail',[(0,.59,.78,.05,.045),(0,.71,.68,.055,.05),(0,.73,.57,.023,.025),(0,.72,.54,.002,.002)],'wool',body,sides=12)
    if stage=='secondary':
        return root
    for side in (-1,1):
        eye('Sheep_Eye',(side*.137,-.645,.907),(.012,.024,.022),body)
        form('Sheep_InnerEar',(side*.27,-.527,.983),(.063,.034,.006),'pink',body,sides=12,rings=6)
    form('Sheep_Nose',(0,-.866,.715),(.049,.012,.025),'nose',body,sides=16,rings=6)
    def fleece_color(p):
        light=Vector(rgba('cream'));base=Vector(rgba('wool'))
        return tuple(base.lerp(light,smoothstep(.57,1.08,p.z)*.5))
    paint(fleece,fleece_color)
    if lamb:
        for ob in root.children_recursive:
            if ob.type=='MESH':
                ob.data.transform(__import__('mathutils').Matrix.Scale(.63,4))
    return root

def cat(stage='blockout'):
    root=pivot('Animal_Cat');body=pivot('CatBody',parent=root)
    h=.36
    parts=[sweep('Cat_Barrel',[(0,-.28,h,.035,.05),(0,-.16,h,.14,.17),(0,.04,h,.145,.145),(0,.25,h+.01,.16,.18),(0,.41,h,.09,.12),(0,.45,h,.002,.002)],'cream',body,plane='body',sides=24)]
    parts.append(sweep('Cat_Neck',[(0,-.21,.35,.12,.14),(0,-.28,.49,.12,.14),(0,-.33,.58,.105,.095)],'cream',body,plane='vertical'))
    parts.append(sweep('Cat_Head',[(0,-.25,.58,.035,.06),(0,-.36,.59,.165,.16),(0,-.46,.58,.16,.15),(0,-.56,.52,.12,.085),(0,-.625,.515,.085,.055),(0,-.65,.517,.012,.025)],'cream',body,plane='body',sides=24))
    for side in (-1,1):
        for rear in (False,True):
            y=.29 if rear else -.22
            parts.append(sweep('Cat_Leg',[(side*.105,y,.42,.055,.07),(side*.115,y+(.025 if rear else 0),.27,.046,.057),(side*.115,y-.016,.09,.030,.037),(side*.118,y-.05,.04,.035,.045)],'cream',body,plane='vertical',sides=14))
            parts.append(form('Cat_Paw',(side*.118,y-.065,.035),(.048,.069,.032),'cream',body,sides=14,rings=8))
    skin=union('Cat_ContinuousSkin',parts,'cream',body,voxel=.007,target=3300)
    for side in (-1,1):
        sweep('Cat_Ear',[(side*.105,-.34,.675,.065,.055),(side*.145,-.32,.75,.052,.035),(side*.17,-.31,.81,.025,.014),(side*.176,-.31,.84,.002,.002)],'gold',body,sides=16,plane='vertical')
    if stage=='blockout':
        return root
    tail=pivot('CatTail',parent=body)
    sweep('Cat_Tail',[(0,.405,.40,.038,.038),(.015,.59,.46,.036,.036),(.065,.71,.63,.033,.033),(.12,.70,.80,.03,.03),(.16,.59,.88,.026,.025),(.16,.47,.86,.015,.018),(.155,.45,.84,.002,.002)],'gold',tail,sides=16,steps=5)
    if stage=='secondary':
        return root
    def cat_color(p):
        f=smoothstep(.32,.48,p.z)*smoothstep(-.29,-.16,p.y)
        if p.y<-.30 and p.z>.59:
            f=max(f,smoothstep(.59,.70,p.z)*(1-smoothstep(.055,.09,abs(p.x))))
        return tuple(Vector(rgba('cream')).lerp(Vector(rgba('gold')),f*.95))
    paint(skin,cat_color)
    for side in (-1,1):
        form('Cat_Lid',(side*.083,-.548,.628),(.042,.011,.029),'face',body,sides=16,rings=8)
        eye('Cat_Eye',(side*.083,-.559,.628),(.035,.012,.022),body,'sage')
        eye('Cat_Pupil',(side*.081,-.570,.628),(.007,.005,.018),body)
        form('Cat_InnerEar',(side*.143,-.357,.752),(.034,.007,.047),'pink',body,sides=12,rings=8)
    form('Cat_Nose',(0,-.646,.546),(.025,.010,.014),'pink',body,sides=12,rings=6)
    for side in (-1,1):
        sweep('Cat_Mouth',[(0,-.643,.526,.0025,.0025),(side*.02,-.627,.511,.0025,.0025),(side*.044,-.608,.515,.002,.002)],'nose',body,sides=6,steps=2)
    return root

def swan(stage='blockout'):
    root=pivot('Animal_Swan');body=pivot('SwanBody',parent=root)
    barrel=sweep('Swan_Body',[(0,-.50,.29,.03,.045),(0,-.32,.30,.23,.22),(0,.07,.29,.34,.24),(0,.42,.33,.29,.23),(0,.70,.40,.16,.15),(0,.86,.49,.025,.03)],'swan',body,sides=24,steps=4,plane='body')
    neck=sweep('Swan_Neck',[(0,-.32,.32,.105,.11),(0,-.50,.49,.09,.09),(0,-.61,.71,.072,.071),(0,-.58,.93,.06,.062),(0,-.62,1.10,.058,.06),(0,-.78,1.16,.063,.066),(0,-.89,1.12,.066,.064)],'swan',body,sides=20,steps=5)
    head=form('Swan_Head',(0,-.89,1.12),(.093,.16,.098),'swan',body,sides=24,rings=12)
    union('Swan_ContinuousSkin',[barrel,neck,head],'swan',body,voxel=.011,target=2950)
    bill=sweep('Swan_Bill',[(0,-1.00,1.105,.07,.042),(0,-1.105,1.077,.064,.032),(0,-1.20,1.053,.035,.017),(0,-1.23,1.057,.002,.003)],'bill',body,sides=16,steps=3,plane='body',power=.8)
    if stage=='blockout':
        return root
    for side in (-1,1):
        wing=pivot('SwanWing'+('L' if side<0 else 'R'),parent=body)
        form('Swan_WingCoverts',(side*.24,.20,.42),(.14,.40,.20),'swan',wing,sides=20,rings=12,tilt=.12)
        for i in range(4):
            x=side*(.29-.017*i)
            sweep('Swan_WingFeather',[(x,.01+i*.07,.48+i*.025,.045,.095),(x,.33+i*.06,.53+i*.015,.05,.085),(side*(.15+i*.013),.68+i*.04,.58+i*.017,.029,.05),(side*(.13+i*.01),.81+i*.025,.61+i*.022,.002,.002)],'cream' if i%2 else 'swan',wing,sides=12,steps=3,plane='body')
        union('Swan_WingSculpt',list(wing.children),'swan',wing,voxel=.013,target=1100)
    if stage=='secondary':
        return root
    for side in (-1,1):
        form('Swan_Mask',(side*.064,-.982,1.142),(.024,.074,.032),'ink',body,sides=16,rings=8)
        eye('Swan_Eye',(side*.080,-.956,1.155),(.009,.018,.012),body)
    form('Swan_BillKnob',(0,-1.016,1.152),(.049,.045,.031),'ink',body,sides=16,rings=8)
    return root

def owl(stage='blockout'):
    root=pivot('Animal_Owl');body=pivot('OwlBody',parent=root)
    sweep('Owl_ContinuousSkin',[(0,.02,.07,.07,.07),(0,.025,.20,.21,.16),(0,.015,.37,.249,.19),(0,-.005,.55,.25,.194),(0,-.005,.66,.20,.16),(0,-.004,.725,.095,.08),(0,0,.74,.003,.003)],'owl',body,plane='vertical',sides=36,steps=6)
    for side in (-1,1):
        foot=pivot('OwlFoot',parent=body)
        sweep('Owl_Leg',[(side*.10,.015,.14,.035,.035),(side*.105,-.005,.045,.025,.025)],'gold',foot,sides=12)
        for toe in range(3):
            x=side*.10+(toe-1)*.025
            sweep('Owl_Toe',[(side*.10,-.015,.038,.012,.012),(x,-.083,.023,.011,.010),(x,-.111,.014,.006,.006),(x,-.12,.012,.002,.002)],'bill',foot,sides=8,steps=2)
    if stage=='blockout':
        return root
    for side in (-1,1):
        wing=pivot('OwlWing'+('L' if side<0 else 'R'),parent=body)
        parts=[sweep('Owl_Wing',[(side*.16,-.02,.48,.035,.03),(side*.22,.01,.38,.085,.066),(side*.22,.04,.23,.073,.067),(side*.16,.06,.12,.03,.036),(side*.13,.07,.09,.002,.002)],'owldark',wing,sides=18,steps=4,plane='vertical')]
        for i in range(3):
            parts.append(sweep('Owl_FlightFeather',[(side*.21,-.025+i*.037,.36,.034,.025),(side*.24,-.02+i*.035,.23,.03,.02),(side*.17,-.01+i*.035,.11-i*.018,.025,.018),(side*.135,-.01+i*.035,.09-i*.016,.002,.002)],'owldark',wing,sides=10))
        union('Owl_WingSculpt',parts,'owldark',wing,voxel=.007,target=750)
    sweep('Owl_Tail',[(0,.13,.19,.06,.035),(0,.22,.105,.07,.023),(0,.25,.075,.04,.018),(0,.26,.066,.003,.003)],'owldark',body,sides=14,plane='vertical')
    if stage=='secondary':
        return root
    for side in (-1,1):
        eye('Owl_Iris',(side*.098,-.183,.542),(.036,.012,.038),body,'gold')
        eye('Owl_Pupil',(side*.098,-.194,.544),(.027,.007,.031),body)
    sweep('Owl_Beak',[(0,-.187,.511,.035,.025),(0,-.22,.479,.028,.025),(0,-.226,.438,.009,.012),(0,-.22,.422,.002,.002)],'bill',body,sides=12,plane='vertical')
    skin=next(ob for ob in root.children_recursive if ob.name.startswith('Owl_ContinuousSkin'))
    def owl_color(p):
        result=Vector(rgba('owl'))
        front=1-smoothstep(-.15,-.11,p.y)
        breast=(1-smoothstep(.75,1.15,(p.x/.14)**2+((p.z-.275)/.16)**2))
        result=result.lerp(Vector(rgba('owlface')),breast*.6*front)
        fleck=math.sin(p.x*64+p.z*11)*math.cos(p.z*70)
        result=result.lerp(Vector(rgba('owldark')),smoothstep(.70,.97,fleck)*front*breast*.4)
        disk=min(((p.x-side*.098)/.118)**2+((p.z-.544)/.146)**2 for side in (-1,1))
        face=(1-smoothstep(.55,1.4,disk))*front
        result=result.lerp(Vector(rgba('owlface')),face)
        return tuple(result)
    paint(skin,owl_color)
    return root

def webfoot(name,x,y,z,size,color,parent):
    outline=[(-.28,.30),(-.44,-.22),(-.40,-.50),(-.14,-.60),(0,-.49),(.16,-.61),(.41,-.48),(.45,-.23),(.27,.30)]
    verts=[(x+u*size,y+v*size,z+w) for w in (0,.012) for u,v in outline]
    n=len(outline);faces=[tuple(range(n-1,-1,-1)),tuple(range(n,n*2))]
    for i in range(n): faces.append((i,(i+1)%n,(i+1)%n+n,i+n))
    ob=mesh(name,verts,faces,color,parent)
    select(ob);mod=ob.modifiers.new('Rounded web edge','BEVEL');mod.width=.006;mod.segments=2
    bpy.ops.object.modifier_apply(modifier=mod.name)
    return ob

def duck(stage='blockout',duckling=False):
    root=pivot('Animal_'+('Duckling' if duckling else 'Duck'))
    body=pivot('DuckBody',parent=root)
    color='duck' if duckling else 'cream'
    barrel=sweep('Duck_Body',[(0,-.25,.25,.025,.04),(0,-.15,.245,.19,.175),(0,.09,.235,.22,.18),(0,.31,.29,.17,.16),(0,.44,.36,.055,.055),(0,.48,.39,.003,.003)],color,body,plane='body',sides=24,steps=4)
    neck=sweep('Duck_Neck',[(0,-.16,.28,.115,.11),(0,-.235,.38,.11,.10),(0,-.27,.49,.12,.12)],color,body,plane='vertical',sides=20)
    head=form('Duck_Head',(0,-.29,.48),(.145,.16,.15),color,body,sides=24,rings=14)
    union('Duck_ContinuousSkin',[barrel,neck,head],color,body,voxel=.007,target=2200)
    sweep('Duck_Bill',[(0,-.397,.444,.073,.029),(0,-.48,.426,.091,.024),(0,-.55,.424,.067,.017),(0,-.58,.43,.005,.005)],'bill',body,plane='body',sides=20,steps=3,power=.8)
    for side in (-1,1):
        sweep('Duck_Leg',[(side*.09,.015,.17,.020,.02),(side*.095,-.025,.055,.017,.017)],'bill',body,sides=10,plane='vertical')
        webfoot('Duck_WebFoot',side*.095,-.046,.014,.145,'bill',body)
    if stage=='blockout':
        return root
    for side in (-1,1):
        wing=pivot('DuckWing'+('L' if side<0 else 'R'),parent=body)
        cover=form('Duck_Wing',(side*.17,.10,.31),(.074,.24,.105),color,wing,sides=20,rings=12,tilt=.10)
        feathers=[]
        for i in range(3):
            feathers.append(sweep('Duck_Feather',[(side*.20,.04+i*.05,.33+i*.009,.02,.027),(side*.19,.25+i*.045,.36+i*.009,.031,.032),(side*.10,.39+i*.025,.39+i*.014,.014,.018),(side*.095,.415+i*.028,.397+i*.014,.002,.002)],color,wing,sides=10,plane='body'))
        union('Duck_WingSculpt',[cover]+feathers,color,wing,voxel=.006,target=650)
    if stage=='secondary':
        return root
    for side in (-1,1):
        eye('Duck_Eye',(side*.137,-.313,.515),(.012,.017,.020),body)
        form('Duck_Nostril',(side*.037,-.484,.450),(.008,.014,.003),'nose',body,sides=10,rings=6)
    sweep('Duck_BillLine',[(-.074,-.497,.424,.002,.002),(0,-.573,.417,.002,.002),(.074,-.497,.424,.002,.002)],'nose',body,sides=6,steps=2)
    skin=next(ob for ob in root.children_recursive if ob.name.startswith('Duck_ContinuousSkin'))
    def duck_color(p):
        highlight=smoothstep(.10,.61,p.z)*.28
        result=Vector(rgba(color)).lerp(Vector(rgba('cream')),highlight)
        if duckling and p.y>-.11:
            stripe=1-smoothstep(.06,.105,abs(p.x))
            result=result.lerp(Vector(rgba('gold')),stripe*smoothstep(.35,.43,p.z)*.65)
        return tuple(result)
    paint(skin,duck_color)
    if duckling:
        for ob in root.children_recursive:
            if ob.type=='MESH': ob.data.transform(__import__('mathutils').Matrix.Scale(.60,4))
    return root

def finish(root,slug,decisions,variants=()):
    bpy.context.view_layer.update()
    ground=min((ob.matrix_world@Vector(p)).z for ob in root.children_recursive if ob.type=='MESH' for p in ob.bound_box)
    for ob in root.children_recursive:
        if ob.type=='MESH':
            ob.data.transform(__import__('mathutils').Matrix.Translation((0,0,-ground)))
    # Static GLBs have two draws, while the source retains the anatomical pivot markers.
    meshes=[]
    for material in (MATTE,GLOSS):
        group=[ob for ob in root.children_recursive if ob.type=='MESH' and any(m.name.split('.')[0]==material.name for m in ob.data.materials)]
        if not group:
            continue
        bpy.ops.object.select_all(action='DESELECT')
        for ob in group: ob.hide_set(False);ob.select_set(True)
        bpy.context.view_layer.objects.active=group[0]
        if len(group)>1: bpy.ops.object.join()
        ob=group[0];ob.name=slug+('_coat' if material==MATTE else '_eyes')
        ob.data.name=ob.name+'_mesh'
        if not ob.data.color_attributes.get('ArtColor') and len(ob.data.color_attributes):
            ob.data.color_attributes[0].name='ArtColor'
        world=ob.matrix_world.copy();ob.parent=root;ob.matrix_world=world
        ob.data.materials.clear();ob.data.materials.append(material)
        for poly in ob.data.polygons: poly.material_index=0
        meshes.append(ob)
    if slug in ('swan','owl','cat','lamb'):
        for ob in meshes: ob.data.calc_loop_triangles()
        total=sum(len(ob.data.loop_triangles) for ob in meshes)
        if total>5800:
            coatmesh=meshes[0]
            select(coatmesh)
            mod=coatmesh.modifiers.new('Small animal silhouette budget','DECIMATE')
            mod.ratio=(len(coatmesh.data.loop_triangles)-(total-5800))/len(coatmesh.data.loop_triangles)
            bpy.ops.object.modifier_apply(modifier=mod.name)
    for ob in meshes:
        select(ob)
        bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
        bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT')
        bpy.ops.uv.smart_project(angle_limit=math.radians(66),island_margin=.02)
        bpy.ops.object.mode_set(mode='OBJECT')
    bpy.ops.object.select_all(action='DESELECT')
    for ob in [root]+meshes:
        ob.hide_set(False);ob.select_set(True)
    bpy.context.view_layer.objects.active=root
    path=OUT/(slug+'.glb')
    bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,use_active_scene=True,export_yup=True,export_apply=True,export_animations=False,export_extras=True)
    bpy.context.view_layer.update()
    tris=sum(len((ob.data.calc_loop_triangles() or ob.data.loop_triangles)) for ob in meshes)
    bounds=[ob.matrix_world@Vector(v) for ob in meshes for v in ob.bound_box]
    entry={'id':slug,'root':root.name,'triangles':tris,'materials':sorted({m.name for ob in meshes for m in ob.data.materials}),'draws':len(meshes),'bytes':path.stat().st_size,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'boundsBlender':[[min(p[i] for p in bounds) for i in range(3)],[max(p[i] for p in bounds) for i in range(3)]],'decisions':decisions,'optionalVariants':list(variants),'textures':0,'uv':'non-overlapping Smart UV charts, reserved for future texture painting','orientation':'metres; glTF Y up, +Z forward; ground origin','animation':'static unrigged model; authoring pivot markers in Blender source'}
    manifestpath=ROOT/'docs/village/animals-v2-manifest.json'
    manifest=json.loads(manifestpath.read_text()) if manifestpath.exists() else {'version':2,'animals':[]}
    entry['source']='assets/village/animals-v2/animal-art-studio.blend#'+root.name
    manifest['animals']=[a for a in manifest['animals'] if a['id']!=slug]+[entry]
    manifestpath.write_text(json.dumps(manifest,indent=2)+'\n')
    bpy.context.preferences.filepaths.save_version=0
    bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/'animal-art-studio.blend'))
    print(json.dumps(entry))

def native_scale(root,scale):
    for ob in root.children_recursive:
        if ob.type=='MESH': ob.data.transform(__import__('mathutils').Matrix.Scale(scale,4))

def lineup(roots,stage,keep_positions=False):
    for ob in bpy.context.scene.objects:
        if ob.name.startswith('Animal_') and ob.parent is None and ob not in roots:
            for child in descendants(ob): child.hide_set(True);child.hide_render=True
    rows=[roots[i:i+4] for i in range(0,len(roots),4)]
    for index,row in enumerate(rows):
        for col,root in enumerate(row):
            root.location=((col-1.5)*3.1,(len(rows)-1-index)*3.2,0)
            for ob in descendants(root): ob.hide_set(False);ob.hide_render=False
    cam=bpy.context.scene.camera
    target=Vector((0,(len(rows)-1)*1.6,.65))
    cam.location=target+Vector((7,-15,8))
    cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler()
    cam.data.ortho_scale=max(13,len(rows)*3.4)
    for area in bpy.context.screen.areas:
        if area.type=='VIEW_3D':
            view=area.spaces.active.region_3d;view.view_location=target
            view.view_rotation=cam.rotation_euler.to_quaternion();view.view_distance=cam.data.ortho_scale
    portrait(stage)
    if not keep_positions:
        for root in roots: root.location=(0,0,0)

if __name__=='__main__':
    scene_start()
