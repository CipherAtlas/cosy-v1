"""Skin the approved animal artwork without remeshing or changing its rest shape.

Run with Blender --background animal-art-studio.blend --python this_file.
The saved art studio is never overwritten. Root transforms remain stationary;
the village Worker owns placement, heading and shared action clocks.
"""
import bpy
import math
import json
import hashlib
import shutil
import sys
import struct
import tempfile
from pathlib import Path
from mathutils import Vector, Quaternion

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'assets/village/animals-v2/animal-art-studio.blend'
RIG_SOURCE = SOURCE.with_name('animal-rig-studio.blend')
OUT = ROOT / 'public/village/models/animals-v2'
MANIFEST = ROOT / 'docs/village/animals-v2-manifest.json'
FPS = 30
manifest = json.loads(MANIFEST.read_text())
original_source_hash = hashlib.sha256(SOURCE.read_bytes()).hexdigest()
baseline_dir = Path('/tmp/cosy-animal-static-baseline')
baseline_dir.mkdir(exist_ok=True)
for entry in manifest['animals']:
    target = baseline_dir / (entry['id'] + '.glb')
    if not target.exists() or not entry.get('rigVersion'):
        shutil.copy2(OUT / target.name, target)


def smooth(a, b, x):
    u = max(0., min(1., (x-a)/(b-a)))
    return u*u*(3-2*u)


def geometry_hash(mesh):
    """Rest artwork invariants, excluding newly added deformation data."""
    payload = {
        'positions': [list(v.co) for v in mesh.vertices],
        'faces': [list(p.vertices) for p in mesh.polygons],
        'colors': [[list(d.color) for d in a.data] for a in mesh.color_attributes],
        'uv': [[list(d.uv) for d in a.data] for a in mesh.uv_layers],
        'materials': [m.name for m in mesh.materials],
    }
    return hashlib.sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest()


def exported_artwork_fingerprint(path):
    raw=path.read_bytes();size=struct.unpack_from('<I',raw,12)[0]
    doc=json.loads(raw[20:20+size]);binary=raw[28+size:]
    def read(index):
        a=doc['accessors'][index];view=doc['bufferViews'][a['bufferView']]
        n={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}[a['type']]
        fmt={5126:'f',5125:'I',5123:'H',5121:'B'}[a['componentType']]
        step=struct.calcsize(fmt);stride=view.get('byteStride',n*step)
        start=view.get('byteOffset',0)+a.get('byteOffset',0)
        return [struct.unpack_from('<'+fmt*n,binary,start+i*stride) for i in range(a['count'])]
    result={}
    for mesh in doc['meshes']:
        p=mesh['primitives'][0];attrs=p['attributes']
        arrays=[read(attrs[key]) for key in ('POSITION','TEXCOORD_0','COLOR_0')]
        rows=[','.join(str(math.floor(float(v)*100000+.5)) for array in arrays for v in array[i]) for i in range(len(arrays[0]))]
        result[mesh['name']]=hashlib.sha256('\n'.join(sorted(rows)).encode()).hexdigest()
    return result


def profile(slug):
    if slug.startswith('horse-'):
        return dict(kind='horse', scale=1., body=(0,.06,1.20), neck=(0,-.57,1.38), head=(0,-1.01,2.13), tail=(0,.92,1.38), front=-.57, back=.65, side=.26, hip=1.14, knee=.56, ear=(.115,-.95,2.19), legtop=1.02, headcut=-.94, tailcut=.93)
    if slug.startswith('highland-'):
        return dict(kind='cow', scale=1., body=(0,.08,.84), neck=(0,-.43,.88), head=(0,-.74,1.05), tail=(0,.88,.94), front=-.41, back=.58, side=.27, hip=.83, knee=.35, ear=(.24,-.82,1.07), legtop=.70, headcut=-.73, tailcut=.88)
    if slug.startswith('dog-'):
        breed=slug.split('-')[1]
        scale={'corgi':.75,'shiba':.75,'beagle':.78,'samoyed':.90,'collie':.84,'shepherd':.90}[breed]
        h=.46 if breed=='corgi' else .60 if breed=='shepherd' else .56
        return dict(kind='dog', scale=scale, body=(0,.08,h), neck=(0,-.28,h+.10), head=(0,-.40,h+.26), tail=(0,.52,h+.04), front=-.29, back=.36, side=.16, hip=h-.02, knee=.24, ear=(.17,-.37,h+.40), legtop=h-.16, headcut=-.41, tailcut=.56)
    if slug in ('sheep','lamb'):
        return dict(kind='sheep', scale=.63 if slug=='lamb' else 1., body=(0,.08,.78), neck=(0,-.30,.79), head=(0,-.48,.90), tail=(0,.59,.76), front=-.28, back=.43, side=.20, hip=.63, knee=.30, ear=(.11,-.47,.96), legtop=.47, headcut=-.46, tailcut=.64)
    if slug=='cat':
        return dict(kind='cat', scale=.84, body=(0,.08,.36), neck=(0,-.22,.45), head=(0,-.33,.58), tail=(0,.405,.40), front=-.22, back=.29, side=.115, hip=.35, knee=.16, ear=(.105,-.34,.675), legtop=.27, headcut=-.32, tailcut=.45)
    if slug=='owl':
        return dict(kind='owl', scale=.70, body=(0,.015,.28), neck=(0,-.005,.40), head=(0,-.005,.50), tail=(0,.13,.19), wing=(.18,-.01,.465), front=.015, side=.10, hip=.14, knee=.045, legtop=.08, headcut=.44)
    if slug=='swan':
        return dict(kind='swan', scale=1., body=(0,.12,.28), neck=(0,-.32,.34), head=(0,-.78,1.12), tail=(0,.70,.40), wing=(.20,.02,.40), front=.04, side=.15, hip=.16, knee=.055, legtop=.12, headcut=1.02)
    return dict(kind='duck', scale=.60 if slug=='duckling' else 1., body=(0,.08,.24), neck=(0,-.16,.28), head=(0,-.27,.47), tail=(0,.35,.31), wing=(.15,-.02,.33), front=.015, side=.095, hip=.16, knee=.055, legtop=.09, headcut=.41)


def make_rig(root, slug, p):
    data=bpy.data.armatures.new(slug+'_skeleton')
    rig=bpy.data.objects.new(slug+'_rig',data)
    bpy.context.collection.objects.link(rig)
    rig.parent=root
    rig.show_in_front=True
    bpy.ops.object.select_all(action='DESELECT')
    rig.select_set(True);bpy.context.view_layer.objects.active=rig
    bpy.ops.object.mode_set(mode='EDIT')
    s=p['scale']
    bird=p['kind'] in ('owl','duck','swan')
    points={}
    def bone(name, head, tail, parent=None, deform=True):
        b=data.edit_bones.new(name);b.head=Vector(head)*s;b.tail=Vector(tail)*s
        if (b.tail-b.head).length<.01:safe=b.head+Vector((0,0,.05*s));b.tail=safe
        if parent:b.parent=data.edit_bones[parent]
        b.use_deform=deform
        points[name]=list(b.head)
    body=p['body'];neck=p['neck'];head=p['head'];tail=p['tail']
    bone('Body',body,(body[0],body[1]-.22,body[2]))
    bone('Neck',neck,head,'Body')
    bone('Head',head,(head[0],head[1]-.15,head[2]+.03),'Neck')
    bone('Tail',tail,(tail[0],tail[1]+.18,tail[2]+.02),'Body')
    for side,label in ((-1,'Left'),(1,'Right')):
        pairs=((False,'Front'),) if bird else ((False,'Front'),(True,'Back'))
        for rear,position in pairs:
            x=side*p['side'];y=p['back'] if rear else p['front'];top=(x,y,p['hip']);knee=(x,y,p['knee'])
            name='Leg'+position+label
            bone(name,top,knee,'Body')
            bone(name+'Lower',knee,(x,y-.025,.02),name)
        if bird:
            w=p['wing'];a=(side*w[0],w[1],w[2]);b=(side*(w[0]+.15),w[1]+.10,w[2]-.10)
            bone('Wing'+label,a,b,'Body')
            if p['kind']=='owl':bone('WingTip'+label,(side*.26,.045,.285),(side*.29,.12,.08),'Wing'+label)
        else:
            ear=p['ear'];a=(side*ear[0],ear[1],ear[2])
            bone('Ear'+label,a,(a[0]+side*.05,a[1],a[2]+.09),'Head')
    if p['kind']=='horse':bone('HorseSeat',(0,.08,1.64),(0,.08,1.80),'Body',False)
    bpy.ops.object.mode_set(mode='OBJECT')
    return rig,points


def components(mesh):
    adjacency=[[] for _ in mesh.vertices]
    for edge in mesh.edges:
        a,b=edge.vertices;adjacency[a].append(b);adjacency[b].append(a)
    seen=set();groups=[]
    for i in range(len(adjacency)):
        if i in seen:continue
        stack=[i];seen.add(i);group=[]
        while stack:
            n=stack.pop();group.append(n)
            for other in adjacency[n]:
                if other not in seen:seen.add(other);stack.append(other)
        groups.append(group)
    return groups


def quadruped_weights(v, p):
    x,y,z=v/p['scale'];kind=p['kind'];side='Left' if x<0 else 'Right'
    weights={'Body':1.}
    # Continuous skins receive smooth hip/shoulder and neck transition bands.
    for rear,position in ((False,'Front'),(True,'Back')):
        cy=p['back'] if rear else p['front']
        radius=.25 if kind=='horse' else .20 if kind=='cow' else .14
        lateral=smooth(p['side']*.32,p['side']*.70,abs(x))
        leg=(1-smooth(p['legtop'],p['hip']+.09,z))*(1-smooth(radius*.5,radius,abs(y-cy)))*lateral
        if leg>.001:
            lower=1-smooth(p['knee']*.85,p['knee']*1.25,z)
            weights['Body']*=1-leg
            weights['Leg'+position+side]=leg*(1-lower)
            weights['Leg'+position+side+'Lower']=leg*lower
    neckfront=1-smooth(p['headcut']+.08,p['headcut']+.30,y)
    neckhigh=smooth(p['body'][2]-.03,p['body'][2]+.20,z)
    neckweight=neckfront*neckhigh
    headweight=(1-smooth(p['headcut']-.06,p['headcut']+.12,y))*neckhigh
    weights={k:w*(1-neckweight) for k,w in weights.items()}
    weights['Neck']=neckweight*(1-headweight)
    weights['Head']=neckweight*headweight
    return weights


def bird_weights(v, p):
    x,y,z=v/p['scale'];kind=p['kind'];side='Left' if x<0 else 'Right'
    if kind=='swan':
        n=(1-smooth(-.35,-.21,y))*smooth(.34,.50,z)
        h=smooth(.93,1.09,z)*(1-smooth(-.73,-.58,y))
    else:
        n=smooth(p['headcut']-.13,p['headcut']+.03,z)
        h=smooth(p['headcut']-.04,p['headcut']+.08,z)
    weights={'Body':1-n,'Neck':n*(1-h),'Head':n*h}
    leg=(1-smooth(p['legtop'],p['hip'],z))*smooth(p['side']*.3,p['side']*.7,abs(x))
    weights={k:w*(1-leg) for k,w in weights.items()}
    lower=1-smooth(p['knee']*.8,p['knee']*1.4,z)
    weights['LegFront'+side]=leg*(1-lower);weights['LegFront'+side+'Lower']=leg*lower
    tail=smooth(p['tail'][1]-.06,p['tail'][1]+.12,y)
    if kind=='owl':tail*=1-smooth(.22,.31,z)
    if tail>.001:
        weights={k:w*(1-tail) for k,w in weights.items()};weights['Tail']=tail
    return weights


def skin(mesh, rig, p):
    names=[b.name for b in rig.data.bones if b.use_deform]
    groups={name:mesh.vertex_groups.new(name=name) for name in names}
    kind=p['kind'];bird=kind in ('owl','duck','swan')
    stats={name:0 for name in names};blended=0
    for comp in components(mesh.data):
        verts=[mesh.data.vertices[i].co/p['scale'] for i in comp]
        centre=sum(verts,Vector())/len(verts)
        mins=[min(v[i] for v in verts) for i in range(3)];maxs=[max(v[i] for v in verts) for i in range(3)]
        small=len(comp)<len(mesh.data.vertices)*.38
        rigid=None
        # Joined detail cages still have separate topology. Keep eyes, beaks,
        # hooves, ears, curled tails and sculpted wings anatomically coherent.
        if mesh.name.endswith('_eyes'):rigid='Head'
        elif bird and small:
            wing=abs(centre.x)>.07 and centre.y>-.09 and centre.z>p['legtop']+.035
            if wing and kind=='owl' and maxs[2]<.51:rigid='Wing'+('Left' if centre.x<0 else 'Right')
            elif wing and kind in ('duck','swan') and mins[2]>(.14 if kind=='swan' else .18) and centre.y>0:rigid='Wing'+('Left' if centre.x<0 else 'Right')
            elif centre.y>p['tail'][1] and abs(centre.x)<.08:rigid='Tail'
            elif kind=='owl' and maxs[2]<.16:rigid='LegFront'+('Left' if centre.x<0 else 'Right')+'Lower'
            elif centre.y<-.35 and centre.z>p['headcut']-.14:rigid='Head'
        elif small and not bird:
            if mins[1]>p['tailcut']-.025:rigid='Tail'
            elif centre.z>p['ear'][2]-.04 and abs(centre.x)>p['ear'][0]*.65 and centre.y<p['headcut']+.22:rigid='Ear'+('Left' if centre.x<0 else 'Right')
            elif maxs[2]<p['knee']*.83:
                rigid='Leg'+('Back' if centre.y>(p['front']+p['back'])/2 else 'Front')+('Left' if centre.x<0 else 'Right')+'Lower'
            elif centre.y<p['headcut']-.05:rigid='Head'
        for index in comp:
            v=mesh.data.vertices[index].co
            if kind=='owl' and rigid and rigid.startswith('Wing'):
                tip=1-smooth(.22,.34,v.z/p['scale'])
                weights={rigid:1-tip,'WingTip'+rigid[4:]:tip}
            else:
                weights={rigid:1.} if rigid else (bird_weights(v,p) if bird else quadruped_weights(v,p))
            if not rigid and not bird:
                x,y,z=v/p['scale']
                t=smooth(p['tailcut']-.015,p['tailcut']+.10,y)
                if t>.001:
                    weights={k:w*(1-t) for k,w in weights.items()};weights['Tail']=t
            filtered=sorted(((k,w) for k,w in weights.items() if w>.0001),key=lambda item:item[1],reverse=True)[:4]
            total=sum(w for _,w in filtered)
            if len(filtered)>1:blended+=1
            for name,weight in filtered:
                groups[name].add([index],weight/total,'REPLACE');stats[name]+=1
    mod=mesh.modifiers.new('Anatomical skin','ARMATURE');mod.object=rig;mod.use_deform_preserve_volume=False
    return {'weightedVertices':len(mesh.data.vertices),'blendedVertices':blended,'jointVertices':stats}


def animation(rig, meshes, p, name, duration):
    action=bpy.data.actions.new(rig.name+'_'+name)
    rig.animation_data_create();rig.animation_data.action=action
    for track in rig.animation_data.nla_tracks:track.mute=True
    frames=round(duration*FPS);kind=p['kind'];bird=kind in ('owl','duck','swan')
    rest={b.name:b.matrix_local.to_quaternion() for b in rig.data.bones}
    def rotation(bone, angles):
        q=Quaternion((1,0,0),angles[0]) @ Quaternion((0,1,0),angles[1]) @ Quaternion((0,0,1),angles[2])
        rig.pose.bones[bone].rotation_quaternion=rest[bone].conjugated() @ q @ rest[bone]
    def lift(height):rig.pose.bones['Body'].location=rest['Body'].conjugated() @ Vector((0,0,height*p['scale']))
    for f in range(frames+1):
        bpy.context.scene.frame_set(f+1)
        phase=0 if f==frames else f/frames
        a=math.tau*phase;sn=math.sin(a);cs=math.cos(a)
        for bone in rig.pose.bones:
            bone.rotation_mode='QUATERNION';bone.rotation_quaternion=Quaternion();bone.location=(0,0,0)
        rotations={};height=0.
        if name in ('walk','run','trot','canter'):
            amp=.28 if name=='walk' else .48 if name in ('run','trot') else .63
            if kind=='cow':amp*=.72
            if kind=='sheep':amp*=.82
            if bird:amp*=.42
            for side,label in ((-1,'Left'),(1,'Right')):
                pairs=((False,'Front'),) if bird else ((False,'Front'),(True,'Back'))
                for rear,pos in pairs:
                    offset=0 if ((side<0)==rear) else math.pi
                    if name=='canter':offset=(.3 if side>0 else 0)+(1.8 if rear else 0)
                    swing=math.sin(a+offset)
                    rotations['Leg'+pos+label]=(amp*swing,0,0)
                    rotations['Leg'+pos+label+'Lower']=(-amp*.80*max(0,swing),0,0)
            rotations['Neck']=(.025*sn,0,0);rotations['Head']=(-.020*sn,0,0)
            rotations['Tail']=(0,.07*sn,.055*sn)
            height=.014*(1-math.cos(a*2)) if name=='walk' else .035*(1-math.cos(a*2))
        elif kind=='owl' and name in ('fly','glide','land'):
            # The perched wing points down: opposite Y rotations open it outward.
            opening=1.45+.48*sn if name=='fly' else 1.48+.025*sn if name=='glide' else 1.22+.20*sn
            rotations['Body']=(1.03 if name!='land' else .19,0,0)
            rotations['Head']=(-.95 if name!='land' else -.16,0,.015*sn)
            rotations['Tail']=(-.12 if name!='land' else -.32+.03*sn,0,0)
            for side,label in ((-1,'Left'),(1,'Right')):
                rotations['Wing'+label]=(.05*sn,-side*opening,side*.05)
                rotations['WingTip'+label]=(0,-side*(.12+.13*math.sin(a-.7) if name=='fly' else .03*sn),0)
                rotations['LegFront'+label]=(.90 if name!='land' else .25,0,0)
                rotations['LegFront'+label+'Lower']=(-.55 if name!='land' else -.12,0,0)
        elif kind=='owl' and name=='feed':
            rotations['Neck']=(.17+.10*sn,0,0)
            rotations['Head']=(.30+.14*sn,0,.025*cs)
            rotations['Tail']=(-.025*sn,0,0)
        elif kind=='owl' and name=='idle':
            rotations['Neck']=(.009*sn,0,0)
            rotations['Head']=(-.009*sn,0,.20*math.sin(a)*(.5+.5*cs))
        elif name=='fly':
            for side,label in ((-1,'Left'),(1,'Right')):
                rotations['Wing'+label]=(.08*sn,side*(.85+.70*sn),side*-.95)
                rotations['LegFront'+label]=(-.65,0,0)
                rotations['LegFront'+label+'Lower']=(-.65,0,0)
            rotations['Head']=(.035*sn,0,0);rotations['Tail']=(.09*sn,0,0)
        elif name=='swim':
            for side,label in ((-1,'Left'),(1,'Right')):
                rotations['LegFront'+label]=(.35*math.sin(a+side*math.pi/2),0,0)
                rotations['Wing'+label]=(0,side*.035*sn,0)
            rotations['Neck']=(.025*sn,0,.015*cs);rotations['Tail']=(.03*sn,0,0)
        elif name in ('pet','ask'):
            rotations['Head']=(.09*sn,.055*math.sin(a*2),.045*sn)
            rotations['Neck']=(.025*sn,0,0)
            rotations['Tail']=(0,.22*math.sin(a*3),.11*math.sin(a*3))
            if bird:
                for side,label in ((-1,'Left'),(1,'Right')):rotations['Wing'+label]=(0,side*.16*(.5+.5*sn),0)
            else:
                for side,label in ((-1,'Left'),(1,'Right')):rotations['Ear'+label]=(.06*math.sin(a*2),0,side*.025*sn)
        elif name in ('sit','nap'):
            for side,label in ((-1,'Left'),(1,'Right')):
                rotations['LegBack'+label]=(-.95,0,0);rotations['LegBack'+label+'Lower']=(1.45,0,0)
                rotations['LegFront'+label]=(.16 if name=='sit' else -.95,0,0)
                rotations['LegFront'+label+'Lower']=(-.16 if name=='sit' else 1.35,0,0)
            rotations['Body']=(-.11 if name=='sit' else -.05,0,0);height=-p['hip']*(.10 if name=='sit' else .23)
            rotations['Head']=(.025*sn if name=='sit' else .10+.008*sn,0,0)
        elif name in ('bow','stretch'):
            rotations['Body']=(-.16,0,0);rotations['Neck']=(-.12,0,0);rotations['Head']=(.14+.04*sn,0,0)
            for label in ('Left','Right'):
                rotations['LegFront'+label]=(-.62,0,0);rotations['LegFront'+label+'Lower']=(.95,0,0)
                rotations['LegBack'+label]=(.18,0,0)
            height=-p['hip']*.13;rotations['Tail']=(0,.15*sn,0)
        elif name=='wave':
            rotations['LegFrontRight']=(-1.12,0,-.18);rotations['LegFrontRightLower']=(.45+.32*sn,0,.12*sn)
            rotations['Head']=(0,.04*sn,.04*sn);rotations['Tail']=(0,.12*sn,0)
        elif name=='dance':
            rotations['Body']=(-.20,0,.12*sn);height=.08*(.5+.5*math.sin(a*2))
            for side,label in ((-1,'Left'),(1,'Right')):
                rotations['LegFront'+label]=(-.80+.30*side*sn,0,side*.16)
                rotations['LegFront'+label+'Lower']=(-.25,0,0)
                rotations['LegBack'+label]=(.15*side*sn,0,0)
            rotations['Tail']=(0,.18*math.sin(a*2),0);rotations['Head']=(.08*sn,0,0)
        elif name in ('spin','roll'):
            rotations['Body']=(0,a if name=='roll' else 0,a if name=='spin' else 0)
            if name=='roll':
                height=.05*(1-math.cos(a))
                for label in ('Left','Right'):
                    for pos in ('Front','Back'):
                        rotations['Leg'+pos+label]=(-.60,0,0);rotations['Leg'+pos+label+'Lower']=(.90,0,0)
            else:rotations['Tail']=(0,.20*sn,0)
        elif name in ('up','down'):
            height=.06*(.5-.5*cs);rotations['Head']=(.12*sn,0,0)
        else:
            rotations['Neck']=(.012*sn,0,0);rotations['Head']=(-.012*sn,0,.012*math.sin(a*.5)**2)
            rotations['Tail']=(0,.035*sn,.025*sn)
            if bird:
                for side,label in ((-1,'Left'),(1,'Right')):rotations['Wing'+label]=(0,side*.012*sn,0)
            else:
                for side,label in ((-1,'Left'),(1,'Right')):rotations['Ear'+label]=(.025*math.sin(a*2),0,0)
        for bone,angles in rotations.items():rotation(bone,angles)
        lift(height)
        if kind=='owl' and name in ('fly','glide'):
            for label in ('Left','Right'):
                bone=rig.pose.bones['LegFront'+label+'Lower']
                bone.location=rest[bone.name].conjugated() @ Vector((0,.015,.045*p['scale']))
                bone.keyframe_insert('location',frame=f+1,group=bone.name)
        for bone in rig.pose.bones:
            if bone.name in rotations:bone.keyframe_insert('rotation_quaternion',frame=f+1,group=bone.name)
            if bone.name=='Body' and name not in ('fly','glide','land','swim'):bone.keyframe_insert('location',frame=f+1,group=bone.name)
        if name not in ('fly','glide','land','swim'):
            bpy.context.view_layer.update()
            deps=bpy.context.evaluated_depsgraph_get()
            lowest=min(v.co.z for ob in meshes for v in ob.evaluated_get(deps).data.vertices)
            if lowest<-.00001:lift(height-lowest/p['scale'])
            rig.pose.bones['Body'].keyframe_insert('location',frame=f+1,group='Body')
    # NLA track names are the exported native clip names, independent of file ID.
    rig.animation_data.action=None
    track=rig.animation_data.nla_tracks.new();track.name=name
    strip=track.strips.new(name,1,action);strip.action_frame_start=1;strip.action_frame_end=frames+1
    strip.extrapolation='NOTHING';strip.blend_type='REPLACE'
    for track in rig.animation_data.nla_tracks:track.mute=False
    return action


def deform_probe(meshes, rig, action, frames):
    for track in rig.animation_data.nla_tracks:track.mute=True
    rig.animation_data.action=action
    samples=[]
    for frame in (1,1+frames*.25,1+frames):
        bpy.context.scene.frame_set(round(frame));bpy.context.view_layer.update()
        deps=bpy.context.evaluated_depsgraph_get()
        samples.append([list(v.co) for ob in meshes for v in ob.evaluated_get(deps).data.vertices])
    delta=max((Vector(a)-Vector(b)).length for a,b in zip(samples[0],samples[1]))
    seam=max((Vector(a)-Vector(b)).length for a,b in zip(samples[0],samples[2]))
    rig.animation_data.action=None
    for track in rig.animation_data.nla_tracks:track.mute=False
    return {'maxDeformation':delta,'loopSeam':seam}


requested=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
reports=[]
bpy.context.scene.render.fps=FPS
manifest['staticArtworkSourceSha256']=original_source_hash
manifest['rigProducer']='scripts/village/rig_animal_art.py'
for entry in manifest['animals']:
    slug=entry['id']
    if requested and slug not in requested:continue
    root=bpy.data.objects[entry['root']]
    root.hide_set(False);root.hide_render=False
    meshes=[ob for ob in root.children_recursive if ob.type=='MESH']
    originals={ob.name:geometry_hash(ob.data) for ob in meshes}
    studio_location=root.location.copy();root.location=(0,0,0)
    p=profile(slug);rig,points=make_rig(root,slug,p)
    weights={ob.name:skin(ob,rig,p) for ob in meshes}
    clips={'idle':4.,'walk':1.2,'pet':3.}
    if p['kind']=='horse':clips.update(trot=.8,canter=.9)
    if p['kind']=='dog':clips.update(run=.7,sit=7.,dance=5.2,spin=3.2,bow=3.8,wave=4.2,roll=4.6)
    if p['kind'] in ('owl','duck','swan'):clips.update(fly=1. if p['kind']=='owl' else 1.5,swim=2.)
    if p['kind']=='owl':clips.update(glide=3.,land=1.2,feed=1.8)
    if p['kind']=='cat':clips.update(nap=5.,stretch=3.,ask=3.,up=2.,down=2.)
    probes={}
    for name,duration in clips.items():
        action=animation(rig,meshes,p,name,duration)
        probes[name]=deform_probe(meshes,rig,action,round(duration*FPS))
    # No action is evaluated at the saved/exported rest frame.
    bpy.context.scene.frame_set(0)
    for b in rig.pose.bones:b.rotation_quaternion=Quaternion();b.location=(0,0,0)
    bpy.context.view_layer.update()
    assert all(geometry_hash(ob.data)==originals[ob.name] for ob in meshes),slug+' changed approved artwork'
    bpy.ops.object.select_all(action='DESELECT')
    for ob in [root,rig]+meshes:ob.hide_set(False);ob.select_set(True)
    bpy.context.view_layer.objects.active=rig
    root['animalRigVersion']=1;root['animalArtworkSource']='animal-art-studio.blend';root['stationaryRoot']=True
    path=OUT/(slug+'.glb')
    bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,use_active_scene=True,export_yup=True,export_apply=False,export_animations=True,export_animation_mode='NLA_TRACKS',export_skins=True,export_extras=True,export_force_sampling=True,export_optimize_animation_size=True,export_anim_slide_to_zero=True)
    root.location=studio_location
    entry['staticSha256']=entry.get('staticSha256',entry['sha256'])
    baseline=exported_artwork_fingerprint(baseline_dir/path.name)
    actual=exported_artwork_fingerprint(path)
    assert actual==baseline,slug+' changed exported artwork attributes'
    entry.update(bytes=path.stat().st_size,sha256=hashlib.sha256(path.read_bytes()).hexdigest(),source='assets/village/animals-v2/animal-rig-studio.blend#'+root.name,animation='Skinned anatomical rig; stationary root; native looping clips',rigVersion=1,bones=[b.name for b in rig.data.bones],bonePivotsBlender=points,clips=clips,skinning=weights,restArtworkHashes=originals,restAttributeFingerprints=baseline,deformation=probes)
    reports.append({'id':slug,'clips':clips,'deformation':probes})
    MANIFEST.write_text(json.dumps(manifest,indent=2)+'\n')
    print('RIG_COMPLETE '+json.dumps(reports[-1]),flush=True)
if requested and RIG_SOURCE.exists():
    unchanged=[entry for entry in manifest['animals'] if entry['id'] not in requested]
    names=[name for entry in unchanged for name in (entry['root'],entry['id']+'_rig',entry['id']+'_coat',entry['id']+'_eyes')]
    for entry in unchanged:
        old=bpy.data.objects.get(entry['root'])
        if old:
            for ob in list(old.children_recursive)+[old]:bpy.data.objects.remove(ob,do_unlink=True)
    # Blender refuses to overwrite a file used as an append library.
    with tempfile.TemporaryDirectory(prefix='cosy-rig-library-') as directory:
        prior_source=Path(directory)/RIG_SOURCE.name
        shutil.copy2(RIG_SOURCE,prior_source)
        with bpy.data.libraries.load(str(prior_source),link=False) as (prior,current):
            current.objects=[name for name in names if name in prior.objects]
    for ob in current.objects:
        if ob:bpy.context.scene.collection.objects.link(ob)
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(RIG_SOURCE))
assert hashlib.sha256(SOURCE.read_bytes()).hexdigest()==original_source_hash,'Static artwork source was modified'
print('RIG_SOURCE '+str(RIG_SOURCE),flush=True)
