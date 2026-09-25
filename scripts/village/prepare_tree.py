"""Simplify individual leaf silhouettes; preserve canopy coverage for the web."""
import bpy, collections, math
from pathlib import Path
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath='/tmp/cosy-tree-source/tree.gltf')
obj=next(o for o in bpy.context.scene.objects if o.type=='MESH');mesh=obj.data
parent=list(range(len(mesh.vertices)))
def find(x):
 while parent[x]!=x:parent[x]=parent[parent[x]];x=parent[x]
 return x
for p in mesh.polygons:
 if p.material_index==1:
  a,b,c=p.vertices[:3];ra,rb,rc=find(a),find(b),find(c);parent[rb]=ra;parent[rc]=ra
parts=collections.defaultdict(dict);uvs=mesh.uv_layers.active.data
for p in mesh.polygons:
 if p.material_index!=1:continue
 group=parts[find(p.vertices[0])]
 for li in p.loop_indices:
  uv=tuple(uvs[li].uv);group[uv]=mesh.loops[li].vertex_index
verts=[];faces=[];texcoords=[]
def cross(o,a,b):return (a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0])
for index,points in enumerate(parts.values()):
 if index%3==0:continue
 points2=sorted(points)
 if len(points2)<3:continue
 lower=[];upper=[]
 for p in points2:
  while len(lower)>=2 and cross(lower[-2],lower[-1],p)<=0:lower.pop()
  lower.append(p)
 for p in reversed(points2):
  while len(upper)>=2 and cross(upper[-2],upper[-1],p)<=0:upper.pop()
  upper.append(p)
 hull=lower[:-1]+upper[:-1]
 if len(hull)<3:continue
 if len(hull)>5:hull=[hull[round(i*len(hull)/5)] for i in range(5)]
 base=len(verts)
 for uv in hull:verts.append(tuple(mesh.vertices[points[uv]].co));texcoords.append(uv)
 for i in range(1,len(hull)-1):faces.append((base,base+i,base+i+1))
leafmesh=bpy.data.meshes.new('Leaf silhouettes');leafmesh.from_pydata(verts,[],faces);leafmesh.materials.append(mesh.materials[1]);layer=leafmesh.uv_layers.new()
for p in leafmesh.polygons:
 for li in p.loop_indices:layer.data[li].uv=texcoords[leafmesh.loops[li].vertex_index]
leafobj=bpy.data.objects.new('Leaves',leafmesh);bpy.context.collection.objects.link(leafobj);leafobj.matrix_world=obj.matrix_world.copy()
# Keep bark, removing the full-resolution leaves before simplifying branches.
bpy.context.view_layer.objects.active=obj;obj.select_set(True)
bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='DESELECT');bpy.ops.object.mode_set(mode='OBJECT')
for p in mesh.polygons:p.select=p.material_index==1
bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.delete(type='FACE');bpy.ops.object.mode_set(mode='OBJECT')
mod=obj.modifiers.new('Bark budget','DECIMATE');mod.ratio=.08;bpy.ops.object.modifier_apply(modifier=mod.name)
for img in bpy.data.images:
 if img.size[0]>512:img.scale(512,512)
root=Path(__file__).resolve().parents[2]/'public/village/models'
bpy.ops.export_scene.gltf(filepath=str(root/'birch.glb'),export_format='GLB',export_image_format='AUTO',export_yup=True)
print('Leaf triangles',len(faces))
