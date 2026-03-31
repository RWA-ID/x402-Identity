import { readFileSync, readdirSync, statSync } from "fs";
import { join, relative } from "path";

const JWT = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySW5mb3JtYXRpb24iOnsiaWQiOiIxYmExNzU0YS0yNmE1LTRlNTUtYTVjNC0wMmM0OGVjMzhiNDMiLCJlbWFpbCI6ImVuc2dpYW50QGdtYWlsLmNvbSIsImVtYWlsX3ZlcmlmaWVkIjp0cnVlLCJwaW5fcG9saWN5Ijp7InJlZ2lvbnMiOlt7ImRlc2lyZWRSZXBsaWNhdGlvbkNvdW50IjoxLCJpZCI6IkZSQTEifSx7ImRlc2lyZWRSZXBsaWNhdGlvbkNvdW50IjoxLCJpZCI6Ik5ZQzEifV0sInZlcnNpb24iOjF9LCJtZmFfZW5hYmxlZCI6ZmFsc2UsInN0YXR1cyI6IkFDVElWRSJ9LCJhdXRoZW50aWNhdGlvblR5cGUiOiJzY29wZWRLZXkiLCJzY29wZWRLZXlLZXkiOiI5Y2NlOTg2YTA1MjEwMDQ4N2RlNyIsInNjb3BlZEtleVNlY3JldCI6Ijg5NWExNmE4MzU1Yjc2OTQzYjNhMjdiZjE2YzMzZDQ2YjFlY2I4MDlmMWE3Y2NjMTRiNTQxMjRhZDQyMmYyNTQiLCJleHAiOjE4MDM2NzE1ODV9.PP1eQwStDsjsoDDoa8bq078LPMaqHOsHtP6M-Vg-hUg";

const OUT_DIR = new URL("../out", import.meta.url).pathname;

function getAllFiles(dir, base = dir) {
  const results = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      results.push(...getAllFiles(full, base));
    } else {
      results.push({ full, rel: relative(base, full) });
    }
  }
  return results;
}

const files = getAllFiles(OUT_DIR);
console.log(`Uploading ${files.length} files...`);

const form = new FormData();
for (const { full, rel } of files) {
  const content = readFileSync(full);
  const blob = new Blob([content]);
  form.append("file", blob, `x402-identity-hub/${rel}`);
}
form.append("pinataMetadata", JSON.stringify({ name: "x402-identity-hub" }));
form.append("pinataOptions", JSON.stringify({ cidVersion: 1, wrapWithDirectory: false }));

console.log("Sending to Pinata...");
const res = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
  method: "POST",
  headers: { Authorization: `Bearer ${JWT}` },
  body: form,
});

const data = await res.json();
console.log("Status:", res.status);
console.log(JSON.stringify(data, null, 2));

if (data.IpfsHash) {
  console.log(`\n✓ CID: ${data.IpfsHash}`);
  console.log(`  https://ipfs.io/ipfs/${data.IpfsHash}/`);
  console.log(`  Set x402id.eth contenthash to: ipfs://${data.IpfsHash}`);
}
