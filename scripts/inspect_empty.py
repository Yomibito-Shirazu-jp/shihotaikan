import json
from collections import Counter

with open(r"C:\Users\ishij\Documents\GitHub\shihotaikan\scripts\out\past_submissions.json", "r", encoding="utf-8") as f:
    recs = json.load(f)

empty = [r for r in recs if not r["lastName"]]
print("total empty lastName:", len(empty))
by_file = Counter(r["_sourceFile"] for r in empty)
for fn, c in by_file.most_common():
    print(c, fn.encode("unicode_escape").decode())
print()
print("Sample 1:")
r = empty[0]
print("  ph:", r["_sourcePhotoCode"])
print("  firstName(esc):", r["firstName"].encode("unicode_escape").decode())
print("  firstKana(esc):", r["firstNameKana"].encode("unicode_escape").decode())
print("  jobTitle(esc):", r["jobTitle"].encode("unicode_escape").decode())
print("  birthEra/Y:", r["birthEra"], r["birthYear"])
