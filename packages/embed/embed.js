/**
 * x402id widget embed loader.
 * Usage:
 *   <div data-x402id
 *        data-treasury="0x..."
 *        data-platform-fee-wei="5000000000000000"
 *        data-chain-id="1"
 *        data-theme="light"
 *        data-parents="402bot.eth,402api.eth"
 *        data-height="520"></div>
 *   <script src="https://x402id.eth.link/embed.js" async></script>
 *
 * Each matching element becomes an iframe pointed at the hosted widget.
 */
(function () {
  var HOST = (window.__X402ID_HOST__ || "https://x402id.eth.link").replace(/\/$/, "");

  function mount(el) {
    if (el.getAttribute("data-x402id-mounted") === "1") return;
    el.setAttribute("data-x402id-mounted", "1");

    var params = new URLSearchParams({
      treasury:       el.getAttribute("data-treasury") || "",
      platformFeeWei: el.getAttribute("data-platform-fee-wei") || "0",
      chainId:        el.getAttribute("data-chain-id") || "1",
      theme:          el.getAttribute("data-theme") || "light",
      parents:        el.getAttribute("data-parents") || "",
    });

    var iframe = document.createElement("iframe");
    iframe.src = HOST + "/widget/?" + params.toString();
    iframe.title = "x402id registration widget";
    iframe.style.border = "0";
    iframe.style.width  = "100%";
    iframe.style.height = (el.getAttribute("data-height") || "520") + "px";
    iframe.style.maxWidth = "440px";
    iframe.style.colorScheme = "normal";
    iframe.allow = "clipboard-write";
    iframe.referrerPolicy = "strict-origin-when-cross-origin";

    el.appendChild(iframe);

    window.addEventListener("message", function (ev) {
      if (ev.source !== iframe.contentWindow) return;
      if (!ev.data || ev.data.type !== "x402id:resize") return;
      var h = Number(ev.data.height);
      if (h > 0 && h < 2000) iframe.style.height = h + "px";
    });
  }

  function scan() {
    var nodes = document.querySelectorAll("[data-x402id]");
    for (var i = 0; i < nodes.length; i++) mount(nodes[i]);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", scan);
  } else {
    scan();
  }
})();
