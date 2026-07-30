import WidgetClient from "./WidgetClient";
import { pageMetadata } from "@/lib/seo";

// The iframe target for the embeddable widget — not a page meant to be linked
// or shared, so keep it out of search results and card previews.
export const metadata = pageMetadata({
  title: "x402 Identity Widget",
  description: "Embeddable mint widget for x402 agent identities.",
  path: "/widget/",
  index: false,
});

export default function WidgetPage() {
  return <WidgetClient />;
}
