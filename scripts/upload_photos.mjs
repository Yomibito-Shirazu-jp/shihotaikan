// Bulk-upload converted JPG portraits from scripts/out/past_photos_jpg/ to
// Firebase Storage at past_photos/.
//
// Prerequisites:
//   1. Install firebase-admin in this directory:
//        cd scripts && npm init -y && npm install firebase-admin
//   2. Download a service-account key from Firebase Console
//      (Project Settings → Service accounts → Generate new private key)
//      and save it as scripts/service-account.json (already gitignored below).
//   3. Make sure storage.rules has been deployed:
//        firebase deploy --only storage
//
// Usage:
//   node scripts/upload_photos.mjs
//   node scripts/upload_photos.mjs --limit 10           # smoke test
//   node scripts/upload_photos.mjs --concurrency 8      # parallelism (default 4)
//   node scripts/upload_photos.mjs --skip-existing=false  # re-upload everything

import { readdir, readFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { initializeApp, cert, applicationDefault } from "firebase-admin/app";
import { getStorage } from "firebase-admin/storage";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const JPG_ROOT = path.join(ROOT, "scripts", "out", "past_photos_jpg");
const SA_PATH = path.join(__dirname, "service-account.json");
const BUCKET = "aidriven-mastering-fyqu.firebasestorage.app";
const STORAGE_PREFIX = "past_photos";

function parseArgs(argv) {
  const args = { limit: 0, concurrency: 4, skipExisting: true };
  for (const a of argv.slice(2)) {
    if (a.startsWith("--limit=")) args.limit = +a.split("=")[1];
    else if (a === "--limit") { /* next */ }
    else if (a.startsWith("--concurrency=")) args.concurrency = +a.split("=")[1];
    else if (a.startsWith("--skip-existing=")) args.skipExisting = a.split("=")[1] !== "false";
  }
  return args;
}

async function listJpgs(root) {
  const tasks = [];
  if (!existsSync(root)) return tasks;
  for (const prefix of await readdir(root)) {
    const dir = path.join(root, prefix);
    const s = await stat(dir).catch(() => null);
    if (!s || !s.isDirectory()) continue;
    for (const fn of await readdir(dir)) {
      if (!fn.toLowerCase().endsWith(".jpg")) continue;
      tasks.push({
        local: path.join(dir, fn),
        remote: `${STORAGE_PREFIX}/${prefix}/${fn}`,
      });
    }
  }
  return tasks;
}

async function uploadOne(bucket, task, skipExisting) {
  const file = bucket.file(task.remote);
  if (skipExisting) {
    const [exists] = await file.exists();
    if (exists) return { skipped: true };
  }
  await bucket.upload(task.local, {
    destination: task.remote,
    metadata: { contentType: "image/jpeg", cacheControl: "public, max-age=86400" },
    resumable: false,
  });
  return { skipped: false };
}

async function main() {
  if (existsSync(SA_PATH)) {
    const sa = JSON.parse(await readFile(SA_PATH, "utf8"));
    initializeApp({ credential: cert(sa), storageBucket: BUCKET, projectId: "aidriven-mastering-fyqu" });
    console.log("auth: service-account.json");
  } else {
    initializeApp({ credential: applicationDefault(), storageBucket: BUCKET, projectId: "aidriven-mastering-fyqu" });
    console.log("auth: gcloud ADC");
  }
  const bucket = getStorage().bucket();

  const args = parseArgs(process.argv);
  const all = await listJpgs(JPG_ROOT);
  const tasks = args.limit ? all.slice(0, args.limit) : all;
  console.log(`Uploading ${tasks.length} files to gs://${BUCKET}/${STORAGE_PREFIX}/`);
  console.log(`  concurrency=${args.concurrency}  skipExisting=${args.skipExisting}`);
  if (!tasks.length) {
    console.log("Nothing to upload (run convert_eps_to_jpg.py first).");
    return;
  }

  let done = 0, ok = 0, skipped = 0, fail = 0;
  const t0 = Date.now();
  let cursor = 0;
  async function worker() {
    while (cursor < tasks.length) {
      const i = cursor++;
      const t = tasks[i];
      try {
        const r = await uploadOne(bucket, t, args.skipExisting);
        if (r.skipped) skipped++; else ok++;
      } catch (e) {
        fail++;
        console.error(`  FAIL ${t.remote}: ${e.message}`);
      }
      done++;
      if (done % 100 === 0 || done === tasks.length) {
        const sec = (Date.now() - t0) / 1000;
        const rate = done / sec;
        const eta = (tasks.length - done) / rate;
        console.log(`  [${done}/${tasks.length}] uploaded=${ok} skipped=${skipped} fail=${fail} rate=${rate.toFixed(1)}/s eta=${(eta/60).toFixed(1)}min`);
      }
    }
  }
  await Promise.all(Array.from({ length: args.concurrency }, () => worker()));
  console.log(`DONE in ${((Date.now() - t0)/60000).toFixed(1)} min  uploaded=${ok} skipped=${skipped} fail=${fail}`);
}

main().catch(e => { console.error(e); process.exit(1); });
