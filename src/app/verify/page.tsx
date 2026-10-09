import VerifyClient from "./VerifyClient";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Verified Payee — x402 Identity Hub",
  description:
    "Prove who gets paid. Link your agent's x402 endpoint to its ENS name in three steps, so clients can check the payout address belongs to you before they pay.",
  path: "/verify/",
});

export default function VerifyPage() {
  return <VerifyClient />;
}
