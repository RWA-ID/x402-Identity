const CHAINS = [
  { id: "ethereum", name: "Ethereum", atMint: true },
  { id: "base", name: "Base", atMint: true },
  { id: "arbitrum", name: "Arbitrum" },
  { id: "optimism", name: "Optimism" },
  { id: "polygon", name: "Polygon" },
  { id: "bnb", name: "BNB Chain" },
  { id: "avalanche", name: "Avalanche" },
  { id: "linea", name: "Linea" },
  { id: "scroll", name: "Scroll" },
  { id: "zksync", name: "zkSync" },
  { id: "gnosis", name: "Gnosis" },
  { id: "celo", name: "Celo" },
  { id: "mantle", name: "Mantle" },
  { id: "blast", name: "Blast" },
];

/**
 * The mint sets the Ethereum and Base address records; every other EVM chain is an
 * ENSIP-11 address record the holder adds. Keep the copy saying exactly that.
 */
export function ChainStrip() {
  return (
    <div className="chain-strip">
      <div className="chain-copy">
        <div className="eyebrow">Multichain</div>
        <h2 style={{ marginTop: 10 }}>One name. An address on every EVM chain.</h2>
        <p>
          Every x402 name is a standard ENS name, so it can hold a separate address for each EVM chain
          (ENSIP-11). The mint flow sets <b>Ethereum</b> and <b>Base</b> to the minting wallet; add any
          other chain as an address record in the ENS manager.
        </p>
      </div>
      <ul className="chain-grid" aria-label="Supported EVM chains">
        {CHAINS.map((c) => (
          <li key={c.id} className={`chain ${c.atMint ? "at-mint" : ""}`}>
            <img src={`/chains/${c.id}.svg`} alt="" width={28} height={28} loading="lazy" />
            <span>{c.name}</span>
            {c.atMint && <em className="mono">set at mint</em>}
          </li>
        ))}
      </ul>
      <p className="micro" style={{ marginTop: 14 }}>
        Chain names and logos are trademarks of their respective owners and do not imply endorsement.
      </p>
    </div>
  );
}
