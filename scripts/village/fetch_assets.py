"""Fetch pinned CC0 asset selections from their original publishers."""
import concurrent.futures, json, pathlib, urllib.request, subprocess
ROOT=pathlib.Path(__file__).resolve().parents[2]/'public/village'
def fetch(url,path):
 path.parent.mkdir(parents=True,exist_ok=True)
 if not path.exists():
  req=urllib.request.Request(url,headers={'User-Agent':'CosyVillage/1.0'})
  with urllib.request.urlopen(req,timeout=90) as r: path.write_bytes(r.read())
 return path

def texture(asset,name):
 data=json.loads(subprocess.check_output(['curl','-fsSL','https://api.polyhaven.com/files/'+asset]))
 for kind,suffix in [('Diffuse','color'),('nor_gl','normal')]:
  if kind not in data: continue
  item=data[kind]['1k'].get('jpg') or data[kind]['1k'].get('png')
  fetch(item['url'],ROOT/'textures'/f'{name}-{suffix}.jpg')
 print('texture',name,flush=True)
def tree():
 data=json.loads(subprocess.check_output(['curl','-fsSL','https://api.polyhaven.com/files/tree_small_02']))['gltf']['1k']['gltf']
 dest=pathlib.Path('/tmp/cosy-tree-source')
 fetch(data['url'],dest/'tree.gltf')
 with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
  list(pool.map(lambda kv:fetch(kv[1]['url'],dest/kv[0]),data['include'].items()))
 print('tree source ready',flush=True)
with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
 futures=[pool.submit(texture,a,n) for a,n in [('medieval_wood','wood'),('roof_slates_02','roof'),('plastered_stone_wall','plaster'),('medieval_blocks_03','stone'),('forest_ground_04','ground')]]
 futures.append(pool.submit(tree))
 for f in futures:f.result()

sky=json.loads(subprocess.check_output(['curl','-fsSL','https://api.polyhaven.com/files/kloppenheim_06_puresky']))
fetch(sky['hdri']['2k']['hdr']['url'],ROOT/'textures/sky.hdr')
for name in ['A1','C2','Ds2','Fs2','A2','C3','Ds3','Fs3','A3','C4','Ds4','Fs4','A4','C5']:
 fetch('https://raw.githubusercontent.com/Tonejs/audio/master/salamander/'+name+'.mp3',ROOT/'audio'/(name+'.mp3'))
fetch('https://raw.githubusercontent.com/Tonejs/audio/master/salamander/README',ROOT/'audio/Salamander-LICENSE.txt')

# Representative-slice sky: smaller, warmer source; the older source remains in the archive.
sunset=json.loads(subprocess.check_output(['curl','-fsSL','https://api.polyhaven.com/files/qwantani_sunset_puresky']))
fetch(sunset['hdri']['1k']['hdr']['url'],ROOT/'textures/sunset.hdr')
