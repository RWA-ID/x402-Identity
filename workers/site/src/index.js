// x402id.dev: serves the static site. Every other host bound to this worker
// (www.x402id.dev, 402id.dev, www.402id.dev) 301s to the canonical host, path kept.
const CANONICAL = "x402id.dev";

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.hostname !== CANONICAL && !url.hostname.endsWith(".workers.dev")) {
      url.hostname = CANONICAL;
      url.protocol = "https:";
      url.port = "";
      return Response.redirect(url.toString(), 301);
    }
    return env.ASSETS.fetch(req);
  },
};
