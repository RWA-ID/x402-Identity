import { readFileSync, readdirSync, statSync } from "fs";
import { join, relative } from "path";
import { config } from "dotenv";

config({ path: ".env.local" });

const JWT = process.env.PINATA_JWT;
if (!JWT) {
  console.error("Missing PINATA_JWT — add it to .env.local (see .env.example).");
  process.exit(1);
}

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
