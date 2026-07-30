import IntegrateClient from "./IntegrateClient";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Integrate — x402 Identity Hub",
  description:
    "Embed x402 agent identity in your product: the drop-in mint widget, the platform-fee forwarder, and the @x402identity/mcp server for AI agents.",
  path: "/integrate/",
});

export default function IntegratePage() {
  return <IntegrateClient />;
}
