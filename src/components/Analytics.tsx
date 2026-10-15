"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";

const GA_ID = "G-WYTL4XKH0W";

/**
 * Google Analytics (gtag.js), disclosed on /privacy. Not on /widget/: partners
 * embed it in an iframe on their own sites, and their visitors never saw our
 * privacy notice. /widget-demo/ is our own page and keeps it.
 */
export function Analytics() {
  const path = usePathname();
  if (path === "/widget" || path.startsWith("/widget/")) return null;
  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
      <Script id="gtag-init" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${GA_ID}');`}
      </Script>
    </>
  );
}
