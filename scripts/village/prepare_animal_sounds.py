"""Rebuild short licensed animal calls. Requires ffmpeg; sources never ship with the game."""
import argparse,hashlib,json,math,subprocess,tempfile,urllib.request
from pathlib import Path
parser=argparse.ArgumentParser();parser.add_argument("--cached-sources",type=Path);args=parser.parse_args()
ROOT=Path(__file__).resolve().parents[2]
DEST=ROOT/'public/village/audio/animals'
CC0='https://creativecommons.org/publicdomain/zero/1.0/'
BY='https://creativecommons.org/licenses/by/4.0/'
FARM='https://opengameart.org/content/farm-animals'
RECIPES=[
 ('cow','MudchuteAnimals/Mudchute_cow_1.ogg',FARM,'Secretlondon','https://creativecommons.org/licenses/by-sa/3.0/',.6,1.59,70,4200),
 ('sheep','MudchuteAnimals/Mudchute_sheep_1.ogg',FARM,'Secretlondon','https://creativecommons.org/licenses/by-sa/3.0/',0,1.13,100,4500),
 ('lamb','MudchuteAnimals/Mudchute_lamb_1.ogg',FARM,'Secretlondon','https://creativecommons.org/licenses/by-sa/3.0/',0,.54,130,4500),
 ('duck','MudchuteAnimals/Mudchute_duck_1.ogg',FARM,'Secretlondon','https://creativecommons.org/licenses/by-sa/3.0/',0,.85,130,4500),
 ('horse','https://bigsoundbank.com/UPLOAD/bwf-en/1541.wav','https://bigsoundbank.com/horse-neighing-4-s1541.html','Joseph Sardin',CC0,0,1.10,110,5000),
 ('owl','https://cdn.freesound.org/previews/465/465697_9159316-hq.mp3','https://freesound.org/people/Breviceps/sounds/465697/','Breviceps',CC0,2.65,1.25,240,1800),
 ('hedgehog','https://cdn.freesound.org/previews/194/194938_1160789-hq.mp3','https://freesound.org/people/soundmary/sounds/194938/','soundmary',BY,3.65,1.05,250,4000),
 ('swan','https://cdn.freesound.org/previews/336/336174_5903232-hq.mp3','https://freesound.org/people/omnisounddesign/sounds/336174/','omnisounddesign',BY,7.8,1.1,220,4500),
 ('duckling','https://cdn.freesound.org/previews/678/678061_14394624-hq.mp3','https://freesound.org/people/LantC/sounds/678061/','LantC',CC0,4.65,.95,550,6000),
 ('dove','https://cdn.freesound.org/previews/795/795719_1629501-hq.mp3','https://freesound.org/people/5ro4/sounds/795719/','Alva Majo / 5ro4',CC0,.1,1.8,160,2400),
 ('cat','https://opengameart.org/sites/default/files/Meow.ogg','https://opengameart.org/content/meow','IgnasD',CC0,0,.51,130,4500),
 ('purr','https://cdn.freesound.org/previews/118/118959_1990695-hq.mp3','https://freesound.org/people/esperri/sounds/118959/','esperri',CC0,2.8,1.65,40,1500),
]
with tempfile.TemporaryDirectory(prefix='cosy-animal-sounds-') as temporary:
 folder=Path(temporary);DEST.mkdir(parents=True,exist_ok=True)
 farm=folder/'farm.7z';urllib.request.urlretrieve('https://opengameart.org/sites/default/files/mudchuteanimals.7z',farm)
 subprocess.run(['tar','-xf',str(farm),'-C',str(folder)],check=True)
 clips=[]
 for name,download,source,author,license,start,duration,high,low in RECIPES:
  original=folder/download if not download.startswith('https:') else folder/(name+'.source')
  if download.startswith('https:'):
   cached=args.cached_sources/(name+('.wav' if name=='horse' else '.ogg' if name=='cat' else '.mp3')) if args.cached_sources else None
   if cached and cached.exists():original=cached
   else:urllib.request.urlretrieve(download,original)
  output=DEST/(name+'.mp3')
  analysis=subprocess.run(['ffmpeg','-v','info','-ss',str(start),'-i',str(original),'-t',str(duration),'-af',f'aformat=channel_layouts=mono,highpass=f={high},lowpass=f={low},loudnorm=I=-22:TP=-6:LRA=7:print_format=json','-ac','1','-f','null','-'],capture_output=True,text=True,check=True)
  measured,_=json.JSONDecoder().raw_decode(analysis.stderr[analysis.stderr.rfind('{'):]);integrated=float(measured['input_i'])
  if not math.isfinite(integrated):raise ValueError(f'{name}: excerpt has no measurable loudness')
  filters=f'aformat=channel_layouts=mono,highpass=f={high},lowpass=f={low},volume={-22-integrated}dB:precision=float,alimiter=limit=0.42:level=0:attack=5:release=60,afade=t=in:d=0.025,afade=t=out:st={max(0,duration-.08)}:d=0.08'
  subprocess.run(['ffmpeg','-v','error','-y','-ss',str(start),'-i',str(original),'-t',str(duration),'-af',filters,'-ac','1','-ar','32000','-codec:a','libmp3lame','-b:a','64k',str(output)],check=True)
  probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','json',str(output)]))
  clips.append({'species':name,'file':f'animals/{name}.mp3','source':source,'download':download,'author':author,'license':license,
   'sourceSha256':hashlib.sha256(original.read_bytes()).hexdigest(),'excerptStart':start,'excerptDuration':duration,
   'changes':f'Mono excerpt, {high} Hz high-pass / {low} Hz low-pass, measured -22 LUFS gain with -6 dB peak ceiling, short fades, 32 kHz 64 kbps MP3. Freesound sources use the publicly downloadable HQ MP3.',
   'duration':float(probe['format']['duration']),'bytes':output.stat().st_size,'sha256':hashlib.sha256(output.read_bytes()).hexdigest()})
  print(name,output.stat().st_size,flush=True)
 (ROOT/'public/village/audio/animal-recordings.json').write_text(json.dumps({'clips':clips,'existingDogs':'../../../docs/village/puppy-sound-manifest.json'},indent=2)+'\n')
