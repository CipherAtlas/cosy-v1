"""Cut four gentle puppy yips from the CC0 OpenGameArt dog recording.

Source: https://opengameart.org/content/dog-barking-mono (Brandon Morris).
The archived original at assets/village/audio keeps this build reproducible.
"""
import hashlib
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
source = ROOT / "assets/village/audio/dog-barking-source.wav"
target = ROOT / "public/village/audio/puppies"
target.mkdir(parents=True, exist_ok=True)
clips = [
    ("mochi", 0.000, .248, 1.31),
    ("kiko", .518, .213, 1.23),
    ("biscuit", 1.118, .254, 1.11),
    ("cloud", 1.684, .345, 1.18),
]
records = []
for name, start, length, pitch in clips:
    output = target / f"{name}-yip.mp3"
    fade_start = max(.08, length / pitch - .04)
    filters = (
        f"highpass=f=170,lowpass=f=4200,"
        f"asetrate=44100*{pitch},aresample=32000,"
        f"afade=t=in:st=0:d=0.008,afade=t=out:st={fade_start}:d=0.04,"
        "loudnorm=I=-18:TP=-3:LRA=6"
    )
    subprocess.run([
        "ffmpeg", "-y", "-loglevel", "error", "-ss", str(start), "-t", str(length),
        "-i", str(source), "-af", filters, "-ac", "1", "-ar", "32000", "-b:a", "64k", str(output)
    ], check=True)
    records.append({"name": name, "file": str(output.relative_to(ROOT)), "bytes": output.stat().st_size,
                    "sha256": hashlib.sha256(output.read_bytes()).hexdigest(), "pitchRatio": pitch})

preview = ROOT / "docs/village/evidence/puppy-yips.mp3"
inputs = [argument for name, *_ in clips for argument in ("-i", str(target / f"{name}-yip.mp3"))]
subprocess.run(["ffmpeg", "-y", "-loglevel", "error", *inputs,
    "-filter_complex", ";".join(f"[{i}:a]apad=pad_dur=0.32[a{i}]" for i in range(4)) + ";[a0][a1][a2][a3]concat=n=4:v=0:a=1[out]",
    "-map", "[out]", "-ac", "1", "-ar", "32000", "-b:a", "80k", str(preview)], check=True)

manifest = {
    "source": "https://opengameart.org/content/dog-barking-mono",
    "sourceFile": str(source.relative_to(ROOT)),
    "author": "Brandon Morris (submitted by HaelDB)",
    "license": "CC0 1.0, selected from OpenGameArt's dual CC0 / OGA-BY listing",
    "changes": "Four individual barks trimmed, high/low-pass filtered, gently pitched, faded, normalized and encoded as mono MP3.",
    "clips": records,
    "preview": str(preview.relative_to(ROOT)),
}
(ROOT / "docs/village/puppy-sound-manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
print(json.dumps(manifest))
