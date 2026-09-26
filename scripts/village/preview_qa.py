"""Local-only QA harness; compiles the production engine without adding runtime routes.
python3 scripts/village/preview_qa.py --port 3011
Artifacts go under docs/village/evidence; server accepts only its named local outputs.
"""
import argparse,json,re,subprocess,tempfile,shutil
from pathlib import Path
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
ROOT=Path(__file__).resolve().parents[2]
parser=argparse.ArgumentParser();parser.add_argument('--port',type=int,default=3011);parser.add_argument('--evidence-prefix',default='');args=parser.parse_args()
if not re.fullmatch(r'[a-z0-9-]*',args.evidence_prefix):parser.error('Evidence prefix must use lowercase letters, digits or hyphens')
temp=Path(tempfile.mkdtemp(prefix='cosy-village-qa-'))
config={'compilerOptions':{'target':'ES2022','module':'ES2022','moduleResolution':'bundler','outDir':str(temp/'modules'),'rootDir':str(ROOT),'baseUrl':str(ROOT),'paths':{'@/*':['./*']},'skipLibCheck':True,'typeRoots':[str(ROOT/'node_modules/@types')],'types':['node']},'files':[str(ROOT/'features/village/audio.ts'),str(ROOT/'features/village/VillageEngine.ts')]}
(temp/'tsconfig.json').write_text(json.dumps(config))
subprocess.run([str(ROOT/'node_modules/.bin/tsc'),'-p',str(temp/'tsconfig.json')],check=True)
for file in (temp/'modules').rglob('*.js'):
 text=file.read_text().replace('"@/lib/basePath"','"../../lib/basePath.js"')
 text=re.sub(r'(from\s+["\'])(\.[^"\']+)(["\'])',lambda m:m[1]+m[2]+('' if m[2].endswith('.js') else '.js')+m[3],text)
 text=text.replace('process.env.NEXT_PUBLIC_BASE_PATH','""')
 file.write_text(text)
shutil.copy(ROOT/'scripts/village/qa.html',temp/'index.html')
shutil.copy(ROOT/'features/village/village.css',temp/'village.css')
shutil.copy(ROOT/'scripts/village/tests/dialogue.js',temp/'dialogue-tests.js')
shutil.copy(ROOT/'scripts/village/tests/residents.js',temp/'resident-tests.js')
(temp/'village').symlink_to(ROOT/'public/village',target_is_directory=True)
(temp/'three').symlink_to(ROOT/'node_modules/three',target_is_directory=True)
evidence=ROOT/'docs/village/evidence';evidence.mkdir(exist_ok=True)
allowed={'activity-exits.json','bridge-side.png','hearth.png','camera-up.png','camera-down.png','camera-rear.png','audio-output.json','scene-audit.json','entrance.png','cottage.png','bridge.png','rain.png','dusk.png','motion.webm','profile.json','audio-piano.wav','audio-lofi.wav','audio-jazz.wav','audio-measurements.json','audio-lifecycle.json'}
allowed.update({'villager-dialogue.json', 'villager-approach.json', 'villager-approach-runtime.json','spirit-front.png','spirit-back.png','cottage-exterior.png','art-checks.json','movement-checks.json'})
allowed.update({'valley-wide.png','distant-gardens.png','rear-valley.png','resident-pip.png','resident-maple.png','resident-moss.png','resident-luma.png','spirit-villagers.png','fantasy-checks.json'})
allowed.update({'arrival-directory.png','arrival-directory-ja.png','junction-post.png','cottage-post.png','soft-shadows.png','polish-checks.json','soundscape.webm'})
allowed.update({'activity-focus.png','activity-music.png','activity-breathe.png','activity-mood.png','activity-gratitude.png','activity-compliment.png','water-detail.png','fire-detail.png','living-checks.json','activity-motion.webm'})
class Handler(SimpleHTTPRequestHandler):
 def __init__(self,*a,**kw):super().__init__(*a,directory=str(temp),**kw)
 def do_POST(self):
  name=self.path.removeprefix('/save/')
  size=int(self.headers.get('Content-Length','0'))
  if self.headers.get('Origin')!=f'http://127.0.0.1:{args.port}' or name not in allowed or size>100_000_000:
   self.send_error(403);return
  (evidence/(args.evidence_prefix+name)).write_bytes(self.rfile.read(size));self.send_response(200);self.end_headers();self.wfile.write(b'Saved')
 def log_message(self,fmt,*a):
  if a and ('POST' in str(a[0]) or str(a[1])!='200'):super().log_message(fmt,*a)
print(f'QA preview http://127.0.0.1:{args.port} from {temp}',flush=True)
ThreadingHTTPServer(('127.0.0.1',args.port),Handler).serve_forever()
