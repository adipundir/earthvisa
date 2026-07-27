# demucs' CLI probes files with ffprobe, which on this machine is an x86_64
# binary on an arm64 host ("Bad CPU type") - and it swallows that into exit 0.
# Drive the model directly instead: soundfile reads the WAV, torch does the rest.
import numpy as np, soundfile as sf, torch, os
from demucs.pretrained import get_model
from demucs.apply import apply_model

os.chdir("/Users/adityapundir/Downloads")
wav, sr = sf.read("cult-classic-audio.wav", always_2d=True, dtype="float32")
model = get_model("htdemucs")
model.eval()
assert sr == model.samplerate, f"{sr} != {model.samplerate}"

x = torch.from_numpy(wav.T).unsqueeze(0)          # (1, ch, n)
ref = x.mean(0)
x = (x - ref.mean()) / ref.std()
with torch.no_grad():
    stems = apply_model(model, x, device="cpu", split=True, overlap=0.25, progress=False)[0]
stems = stems * ref.std() + ref.mean()

names = model.sources                              # drums, bass, other, vocals
idx = {n: i for i, n in enumerate(names)}
vocals = stems[idx["vocals"]].numpy().T
inst = sum(stems[idx[n]] for n in names if n != "vocals").numpy().T

sf.write("cult-classic-instrumental.wav", inst, sr, subtype="PCM_16")
sf.write("cult-classic-vocals-only.wav", vocals, sr, subtype="PCM_16")

rms = lambda a: float(np.sqrt(np.mean(a**2)))
print("sources:", names)
print("original     RMS %.4f" % rms(wav))
print("instrumental RMS %.4f  (%.0f%% of original energy kept)" % (rms(inst), 100*rms(inst)/rms(wav)))
print("vocal stem   RMS %.4f  (%.0f%% pulled out)" % (rms(vocals), 100*rms(vocals)/rms(wav)))
