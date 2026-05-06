"""Split combined past_submissions.json into per-department files for safer
browser-side upload via /admin."""
import json, os, sys

sys.stdout.reconfigure(encoding="utf-8")
OUT = r"C:\Users\ishij\Documents\GitHub\shihotaikan\scripts\out"

with open(os.path.join(OUT, "past_submissions.json"), "r", encoding="utf-8") as f:
    recs = json.load(f)

court = [r for r in recs if r["department"] == "裁判所の部"]
moj   = [r for r in recs if r["department"] == "法務省の部"]

for name, data in [
    ("past_submissions_court.json", court),
    ("past_submissions_moj.json", moj),
]:
    p = os.path.join(OUT, name)
    with open(p, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    sz = os.path.getsize(p)
    print(f"{len(data):5d} records  {sz/1024/1024:.1f} MB  {name}")

print(f"Total: {len(recs)} records")
