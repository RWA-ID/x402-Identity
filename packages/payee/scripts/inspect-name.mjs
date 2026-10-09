// Print the ENS state the payee-name verifier reads for one name.
import { createPublicClient, http, fallback, namehash } from "viem";
import { mainnet } from "viem/chains";
import { viemReader, ORIGINS_KEY, PAYTO_KEY, NAME_WRAPPER } from "../dist/index.js";
const name = process.argv[2];
const client = createPublicClient({ chain: mainnet, transport: fallback([
  http("https://gateway.tenderly.co/public/mainnet"), http("https://eth.api.onfinality.io/public")]) });
const r = viemReader(client);
const owner = await r.registryOwner(name);
console.log({
  name,
  registryOwner: owner,
  wrapped: owner.toLowerCase() === NAME_WRAPPER.toLowerCase(),
  wrapper: owner.toLowerCase() === NAME_WRAPPER.toLowerCase() ? await r.wrapperData(name) : null,
  resolver: await client.getEnsResolver({ name }),
  ethAddr: await r.addr(name, 60n),
  baseAddr: await r.addr(name, 2147492101n),
  [ORIGINS_KEY]: await r.text(name, ORIGINS_KEY),
  [PAYTO_KEY]: await r.text(name, PAYTO_KEY),
});
