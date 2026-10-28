import type { EnsVersion } from "@x402identity/widget-core";

/** Which ENS version a name is on, so v1 and v2 names can be told apart at a glance. */
export function EnsBadge({ version }: { version: EnsVersion | undefined }) {
  if (!version) return null;
  return <span className={`ens-badge ens-badge-${version}`}>ENS{version}</span>;
}

/** The Verified Payee wizard works for every .eth name, on either ENS version, at no charge. */
export function EnsReadyCard() {
  return (
    <div className="ens-ready">
      <div className="ens-ready-badges">
        <EnsBadge version="v1" />
        <EnsBadge version="v2" />
      </div>
      <div>
        <div className="ens-ready-title">ENSv1 and ENSv2 ready</div>
        <p className="ens-ready-text">
          Any .eth name you control works, at no charge (your wallet pays only the network fee): ENSv1 names,
          wrapped or not and subnames included, and names registered or upgraded on ENSv2. Each name is marked with
          its version.
        </p>
      </div>
    </div>
  );
}
