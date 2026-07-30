import WidgetDemoClient from "./WidgetDemoClient";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Widget Demo — x402 Identity Hub",
  description:
    "Live demo of the embeddable x402 Identity mint widget, running against Ethereum mainnet.",
  path: "/widget-demo/",
});

export default function WidgetDemoPage() {
  return <WidgetDemoClient />;
}
