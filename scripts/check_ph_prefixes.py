import json, sys, collections, os, glob
sys.stdout.reconfigure(encoding="utf-8")

with open(r"C:\Users\ishij\Documents\GitHub\shihotaikan\scripts\out\past_submissions.json","r",encoding="utf-8") as f:
    recs = json.load(f)

prefixes = collections.Counter(
    (r["pastPhotoCode"][0] if r["pastPhotoCode"] else "(empty)") for r in recs
)
print("ph prefix distribution (from Excel data):")
for k, c in sorted(prefixes.items()):
    print(f"  {k}: {c}")

print()
print("first sample for each prefix:")
seen = set()
for r in recs:
    p = r["pastPhotoCode"][:1] if r["pastPhotoCode"] else "_"
    if p not in seen:
        seen.add(p)
        print(f"  {p}: code={r['pastPhotoCode']} path={r['pastPhotoStoragePath']}")

print()
print("Image directory file counts:")
LINKS = r"C:\Users\ishij\Documents\GitHub\shihotaikan\司法大観\画像\Links"
for sub in sorted(os.listdir(LINKS)):
    p = os.path.join(LINKS, sub)
    if not os.path.isdir(p):
        continue
    eps = glob.glob(os.path.join(p, "*.eps"))
    samples = [os.path.basename(x) for x in eps[:3]]
    print(f"  {sub}: {len(eps)} eps  e.g. {samples}")
