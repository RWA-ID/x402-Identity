// x402id.dev: serves the static site. Every other host bound to this worker
// (www.x402id.dev, 402id.dev, www.402id.dev) 301s to the canonical host, path kept.
const CANONICAL = "x402id.dev";
const API_HOST = "api.x402id.dev";

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.hostname !== CANONICAL && !url.hostname.endsWith(".workers.dev")) {
      url.hostname = CANONICAL;
      url.protocol = "https:";
      url.port = "";
      return Response.redirect(url.toString(), 301);
    }
    // The x402 manifest is the API worker's (its paid routes live there). Asked
    // as api.x402id.dev so its resource URLs point at that subdomain, which
    // x402#2979 allows from the apex.
    if (url.pathname === "/.well-known/x402") {
      return env.API.fetch(new Request(`https://${API_HOST}/.well-known/x402`, { headers: req.headers }));
    }
    return env.ASSETS.fetch(req);
  },
};
