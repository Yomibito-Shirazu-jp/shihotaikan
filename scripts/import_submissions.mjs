// Bulk-import past_submissions JSON into Firestore at submissions/ using
// firebase-admin (bypasses Firestore security rules; equivalent to "admin").
//
// Prerequisites (same as upload_photos.mjs):
//   1. cd scripts && npm init -y && npm install firebase-admin
//   2. scripts/service-account.json (downloaded from Firebase Console)
//
// Usage:
//   node scripts/import_submissions.mjs                          # all
//   node scripts/import_submissions.mjs --file=out/past_submissions_court.json
//   node scripts/import_submissions.mjs --limit=10               # smoke test
//   node scripts/import_submissions.mjs --dry-run                # validate, no writes

import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { initializeApp, cert, applicationDefault } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SA_PATH = path.join(__dirname, "service-account.json");
const DEFAULT_FILE = path.join(ROOT, "scripts", "out", "past_submissions.json");
const FIRESTORE_DB_ID = "ai-studio-62856496-d194-475b-9299-fb8f880d5761";
const COLLECTION = "submissions";
const BATCH_SIZE = 400;  // Firestore limit is 500/batch; leave headroom.

function parseArgs(argv) {
  const args = { file: DEFAULT_FILE, limit: 0, dryRun: false };
  for (const a of argv.slice(2)) {
    if (a.startsWith("--file=")) args.file = path.resolve(ROOT, a.split("=")[1]);
    else if (a.startsWith("--limit=")) args.limit = +a.split("=")[1];
    else if (a === "--dry-run") args.dryRun = true;
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv);
  if (!existsSync(args.file)) {
    console.error(`Missing input JSON: ${args.file}`);
    process.exit(1);
  }
  const records = JSON.parse(await readFile(args.file, "utf8"));
  if (!Array.isArray(records)) {
    console.error("JSON root must be an array.");
    process.exit(1);
  }
  const items = args.limit ? records.slice(0, args.limit) : records;
  console.log(`Loaded ${records.length} records from ${path.relative(ROOT, args.file)}`);
  console.log(`Will write ${items.length} (limit=${args.limit || "none"}, dryRun=${args.dryRun})`);

  if (args.dryRun) {
    // Validation only: print summary
    const missing = items.filter(r => !r.lastName || !r.firstName || !r.jobTitle).length;
    const withPhoto = items.filter(r => r.pastPhotoStoragePath).length;
    const withGaiji = items.filter(r => r.needsGarbledTextCheck).length;
    console.log(`  validation: missing-required=${missing}  with-photo-path=${withPhoto}  gaiji=${withGaiji}`);
    return;
  }

  if (existsSync(SA_PATH)) {
    const sa = JSON.parse(await readFile(SA_PATH, "utf8"));
    initializeApp({ credential: cert(sa), projectId: "aidriven-mastering-fyqu" });
    console.log("auth: service-account.json");
  } else {
    // Fall back to Application Default Credentials (gcloud auth application-default login)
    initializeApp({ credential: applicationDefault(), projectId: "aidriven-mastering-fyqu" });
    console.log("auth: gcloud ADC");
  }
  const db = getFirestore(FIRESTORE_DB_ID);
  const col = db.collection(COLLECTION);

  let written = 0;
  const t0 = Date.now();
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const slice = items.slice(i, i + BATCH_SIZE);
    const batch = db.batch();
    for (const item of slice) {
      const ref = col.doc();  // auto-id
      batch.set(ref, {
        ...item,
        isImportedPastData: true,
        createdAt: FieldValue.serverTimestamp(),
        // Defaults for any missing required fields (mirrors Admin.tsx).
        department: item.department || "未設定",
        lastName: item.lastName || "",
        firstName: item.firstName || "",
        lastNameKana: item.lastNameKana || "",
        firstNameKana: item.firstNameKana || "",
        jobTitle: item.jobTitle || "",
        careerType: item.careerType || "過去データ",
        photoType: item.photoType || "過去データ",
        agreeTerms: item.agreeTerms !== undefined ? item.agreeTerms : true,
        userId: item.userId || "admin_import",
      });
    }
    await batch.commit();
    written += slice.length;
    const sec = (Date.now() - t0) / 1000;
    const rate = written / sec;
    const eta = (items.length - written) / rate;
    console.log(`  [${written}/${items.length}] rate=${rate.toFixed(1)}/s eta=${(eta/60).toFixed(1)}min`);
  }
  console.log(`DONE in ${((Date.now() - t0)/60000).toFixed(1)} min  written=${written}`);
}

main().catch(e => { console.error(e); process.exit(1); });
