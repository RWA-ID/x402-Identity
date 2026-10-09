"use client";

import { useEffect, useMemo, useState } from "react";
import { useAccount, usePublicClient } from "wagmi";
import { mainnet } from "wagmi/chains";
import { useAppKit } from "@reown/appkit/react";
import { getAddress, isAddress, type PublicClient } from "viem";
import { normalize } from "viem/ens";
import { planPayeeRecords, readPayeeRecords, originOf, type PayeePlan } from "@x402identity/widget-core";
import { verifyPayee, viemReader, type PayeeVerdict } from "@x402identity/payee";
import { SiteNav } from "@/components/SiteNav";
import { useOwnedNames, holdsName } from "@/hooks/useOwnedNames";
import { useWritePayee } from "@/hooks/useWritePayee";
import { readChallenge, networkLabel, shortAddr, type Challenge } from "@/lib/challenge";

const PARENTS = ["402bot.eth", "402api.eth", "402mcp.eth"];
const STEPS = ["Choose names", "Link endpoints", "Verify"] as const;

type Endpoint = {
  url: string;
  reading: boolean;
  challenge: Challenge | null;
  error: string | null;
  /** Used when the 402 can't be read: one payout address on one network. */
  manual: { network: string; payTo: string };
};

const emptyEndpoint = (): Endpoint => ({
  url: "",
  reading: false,
  challenge: null,
  error: null,
  manual: { network: "eip155:8453", payTo: "" },
});

type Current = Awaited<ReturnType<typeof readPayeeRecords>>;

type Check = {
  running: boolean;
  error: string | null;
  challenge: Challenge | null;
  verdicts: PayeeVerdict[] | null;
};

/**
 * Records for one name. `keep` are origins the name already lists and the
 * user chose to keep: writing org.x402.origins replaces the whole list, so a
 * seller with two live origins would otherwise lose one.
 */
function planFor(ep: Endpoint, keep: string[]): PayeePlan | null {
  const c = ep.challenge;
  const origin = c?.origin ?? originOf(ep.url);
  if (!origin) return null;
  const origins = [...keep, origin];
  if (c?.readable && c.accepts?.length) return planPayeeRecords(origins, c.accepts);
  if (!isAddress(ep.manual.payTo)) return null;
  return planPayeeRecords(origins, [{ network: ep.manual.network, payTo: ep.manual.payTo }]);
}

/** Origins the name lists now, minus the ones the user removed. */
function keptOrigins(cur: Current | "failed" | undefined, dropped: string[] | undefined): string[] {
  if (!cur || cur === "failed") return [];
  return cur.origins.split(/\s+/).filter((o) => o && !(dropped ?? []).includes(o));
}

function reasonText(v: PayeeVerdict): string {
  switch (v.reason) {
    case "payee-bound":
      return "The name lists this origin and this payout address.";
    case "origin-not-listed":
      return `The name doesn't list ${v.detail?.expected}. Its records list: ${v.detail?.got}.`;
    case "payto-not-listed":
      return `The payout address ${v.detail ? shortAddr(v.detail.got) : ""} isn't listed for this network.`;
    case "name-expired":
      return "The name has expired.";
    case "name-in-grace":
      return "The name is in its grace period — renew the parent first.";
    case "no-records":
      return "The name has no payee records yet. Go back to step 2 and write them.";
    case "resolution-failed":
      return "Couldn't read Ethereum just now. This isn't a failure — try again.";
    case "name-not-normalized":
      return "The name isn't in normalized form.";
    case "unsupported-name":
      return "Only .eth names are supported.";
  }
}

export default function VerifyClient() {
  const { address, isConnected } = useAccount();
  const { open } = useAppKit();
  const client = usePublicClient({ chainId: mainnet.id });
  const owned = useOwnedNames(address);
  const writer = useWritePayee();

  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [extra, setExtra] = useState<string[]>([]);
  const [addInput, setAddInput] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [preselect, setPreselect] = useState<string[]>([]);
  const [endpoints, setEndpoints] = useState<Record<string, Endpoint>>({});
  const [current, setCurrent] = useState<Record<string, Current | "failed">>({});
  const [checks, setChecks] = useState<Record<string, Check>>({});
  const [dropped, setDropped] = useState<Record<string, string[]>>({});

  // ?name=a.402bot.eth,b.402api.eth — the post-mint link preselects its names.
  useEffect(() => {
    const raw = new URLSearchParams(window.location.search).get("name");
    if (raw) setPreselect(raw.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean));
  }, []);

  const allNames = useMemo(
    () => [...new Set([...(owned.status === "ready" ? owned.names : []), ...extra])],
    [owned, extra],
  );

  useEffect(() => {
    if (!preselect.length || owned.status !== "ready") return;
    setSelected((s) => [...new Set([...s, ...preselect.filter((n) => owned.names.includes(n))])]);
  }, [preselect, owned]);

  const toggle = (name: string) =>
    setSelected((s) => (s.includes(name) ? s.filter((n) => n !== name) : [...s, name]));

  const addName = async () => {
    setAddError(null);
    let name: string;
    try {
      name = normalize(addInput.trim());
    } catch {
      setAddError("That isn't a valid name.");
      return;
    }
    if (!PARENTS.some((p) => name.endsWith(`.${p}`))) {
      setAddError(`Use a name under ${PARENTS.join(", ")}.`);
      return;
    }
    if (!client || !address) return;
    try {
      if (!(await holdsName(client, name, address))) {
        setAddError(`Your connected wallet doesn't hold ${name}.`);
        return;
      }
    } catch {
      setAddError("Couldn't check ownership just now — try again.");
      return;
    }
    setExtra((e) => [...new Set([...e, name])]);
    setSelected((s) => [...new Set([...s, name])]);
    setAddInput("");
  };

  const ep = (name: string) => endpoints[name] ?? emptyEndpoint();
  const patch = (name: string, p: Partial<Endpoint>) =>
    setEndpoints((all) => ({ ...all, [name]: { ...(all[name] ?? emptyEndpoint()), ...p } }));

  const read = async (name: string) => {
    const url = ep(name).url.trim();
    if (!originOf(url)) {
      patch(name, { error: "Enter the full https URL of a paid route.", challenge: null });
      return;
    }
    patch(name, { reading: true, error: null, challenge: null });
    try {
      const challenge = await readChallenge(url);
      patch(name, { reading: false, challenge });
    } catch (e) {
      patch(name, { reading: false, error: (e as Error).message });
    }
  };

  const plans = selected.map((name) => ({ name, plan: planFor(ep(name), keptOrigins(current[name], dropped[name])) }));
  // Never write before the current records are known: an unread origins list
  // would be overwritten blind.
  const recordsKnown = plans.every((p) => p.plan === null || (current[p.name] && current[p.name] !== "failed"));
  const ready = plans.length > 0 && plans.every((p) => p.plan !== null) && recordsKnown;

  // Show what each write would replace.
  const planKey = JSON.stringify(plans.map((p) => [p.name, p.plan?.addrs.map((a) => a.network)]));
  useEffect(() => {
    if (!client || step !== 1) return;
    for (const { name, plan } of plans) {
      if (!plan) continue;
      readPayeeRecords(client, name, plan.addrs.map((a) => a.network))
        .then((r) => setCurrent((c) => ({ ...c, [name]: r })))
        .catch(() => setCurrent((c) => ({ ...c, [name]: "failed" })));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planKey, client, step]);

  const payoutElsewhere =
    address &&
    plans.some((p) => p.plan?.addrs.some((a) => getAddress(a.address) !== getAddress(address)));

  const verify = async (name: string) => {
    const url = ep(name).url.trim();
    setChecks((c) => ({ ...c, [name]: { running: true, error: null, challenge: null, verdicts: null } }));
    try {
      if (!client) throw new Error("No Ethereum connection");
      const challenge = await readChallenge(url);
      if (!challenge.readable || !challenge.accepts?.length) {
        throw new Error(
          challenge.redirect
            ? `The URL redirects to ${challenge.redirect}. Use the final URL.`
            : `The endpoint answered ${challenge.status}, not a readable 402.`,
        );
      }
      // Check the records against the live terms as if the server already
      // declared the name, so a correct setup shows before the redeploy.
      const verdicts = await verifyPayee(
        { accepts: challenge.accepts, extensions: { "payee-name": { info: { name } } } },
        challenge.origin,
        viemReader(client as unknown as PublicClient),
      );
      setChecks((c) => ({ ...c, [name]: { running: false, error: null, challenge, verdicts } }));
    } catch (e) {
      setChecks((c) => ({ ...c, [name]: { running: false, error: (e as Error).message, challenge: null, verdicts: null } }));
    }
  };

  const snippet = (name: string) => `// In your @x402 route config (Hono, Express or Next middleware):
extensions: {
  "payee-name": { info: { name: "${name}" } },
},`;

  return (
    <main className="site">
      <SiteNav
        links={[
          { href: "/", label: "Home" },
          { href: "/integrate/", label: "Integrate" },
          { href: "/widget-demo/", label: "Widget demo" },
        ]}
        cta={
          isConnected && address ? (
            <button className="btn btn-ghost" onClick={() => open({ view: "Account" })}>
              <span className="mono" style={{ fontSize: 12 }}>{shortAddr(address)}</span>
            </button>
          ) : (
            <button className="btn btn-ghost" onClick={() => open()}>Connect wallet</button>
          )
        }
      />

      <section className="verify-hero">
        <div className="wrap">
          <div className="eyebrow">Verified Payee</div>
          <h1>Prove who gets paid.</h1>
          <p className="lede">
            Link your agent&apos;s x402 endpoint to its name. Clients can then check that the payout address in
            your 402 belongs to you — before they pay. Three steps, one signature.
          </p>
        </div>
      </section>

      <section className="section-divider verify-body">
        <div className="wrap">
          <ol className="verify-steps">
            {STEPS.map((label, i) => (
              <li key={label} data-state={i === step ? "current" : i < step ? "done" : "todo"}>
                <button disabled={i > step} onClick={() => setStep(i)}>
                  <span className="n">0{i + 1}</span> {label}
                </button>
              </li>
            ))}
          </ol>

          {step === 0 && (
            <div className="verify-card">
              <h2>Choose names</h2>
              {!isConnected ? (
                <>
                  <p className="verify-note">Connect the wallet that holds your names.</p>
                  <button className="btn btn-primary btn-lg" onClick={() => open()}>
                    Connect wallet <span className="arrow">→</span>
                  </button>
                </>
              ) : (
                <>
                  {owned.status === "loading" && <p className="verify-note">Looking up names held by {shortAddr(address!)}…</p>}
                  {owned.status === "failed" && (
                    <p className="verify-error">Couldn&apos;t list your names ({owned.error}). Add them by hand below.</p>
                  )}
                  {owned.status === "ready" && allNames.length === 0 && (
                    <p className="verify-note">
                      This wallet holds no names under 402bot.eth, 402api.eth or 402mcp.eth.{" "}
                      <a href="/" className="verify-link">Mint one</a>, or add a name you hold below.
                    </p>
                  )}
                  {allNames.length > 0 && (
                    <ul className="verify-names">
                      {allNames.map((n) => (
                        <li key={n}>
                          <label>
                            <input type="checkbox" checked={selected.includes(n)} onChange={() => toggle(n)} />
                            <span className="mono">{n}</span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  )}
                  <label className="field-label" htmlFor="add-name" style={{ marginTop: 24 }}>Add a name you hold</label>
                  <div className="input-row">
                    <input
                      id="add-name"
                      className="label-input"
                      placeholder="myagent.402bot.eth"
                      value={addInput}
                      onChange={(e) => setAddInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addName()}
                    />
                    <button className="add-btn" onClick={addName} disabled={!addInput.trim()}>Add</button>
                  </div>
                  {addError && <p className="verify-error">{addError}</p>}
                  <div className="verify-actions">
                    <button className="btn btn-primary btn-lg" disabled={selected.length === 0} onClick={() => setStep(1)}>
                      Continue with {selected.length || "no"} name{selected.length === 1 ? "" : "s"} <span className="arrow">→</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {step === 1 && (
            <div className="verify-card">
              <h2>Link endpoints</h2>
              <p className="verify-note">
                Paste one paid route per name. We read its 402 without paying and fill in the origin and payout
                addresses for you.
              </p>
              {selected.map((name) => {
                const e = ep(name);
                const c = e.challenge;
                const cur = current[name];
                const plan = planFor(e, keptOrigins(cur, dropped[name]));
                const newOrigin = c?.origin ?? originOf(e.url);
                const listed = cur && cur !== "failed" ? cur.origins.split(/\s+/).filter(Boolean) : [];
                const others = listed.filter((o) => o !== newOrigin);
                const unreadable = c && (!c.readable || !c.accepts?.length);
                return (
                  <div key={name} className="verify-endpoint">
                    <div className="mono verify-name">{name}</div>
                    <div className="input-row">
                      <input
                        className="label-input"
                        placeholder="https://api.example.com/v1/route"
                        value={e.url}
                        onChange={(ev) => patch(name, { url: ev.target.value, challenge: null, error: null })}
                        onKeyDown={(ev) => ev.key === "Enter" && read(name)}
                      />
                      <button className="add-btn" onClick={() => read(name)} disabled={e.reading || !e.url.trim()}>
                        {e.reading ? "Reading…" : "Read 402"}
                      </button>
                    </div>
                    {e.error && <p className="verify-error">{e.error}</p>}
                    {c?.redirect && <p className="verify-error">This URL redirects to {c.redirect}. Paste the final URL.</p>}
                    {c && !c.redirect && unreadable && (
                      <div className="verify-manual">
                        <p className="verify-note">
                          {c.paymentRequired === false
                            ? `This URL answered ${c.status}, not 402. Use a paid route, or enter the payout address yourself:`
                            : "We couldn't read this 402. Enter the payout address yourself:"}
                        </p>
                        <div className="input-row">
                          <select
                            className="label-input verify-select"
                            value={e.manual.network}
                            onChange={(ev) => patch(name, { manual: { ...e.manual, network: ev.target.value } })}
                          >
                            <option value="eip155:8453">Base</option>
                            <option value="eip155:1">Ethereum</option>
                          </select>
                          <input
                            className="label-input"
                            placeholder="0x… payout address"
                            value={e.manual.payTo}
                            onChange={(ev) => patch(name, { manual: { ...e.manual, payTo: ev.target.value.trim() } })}
                          />
                        </div>
                      </div>
                    )}
                    {plan && (
                      <table className="verify-records">
                        <thead>
                          <tr><th>Record</th><th>Now</th><th>Will be</th></tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td className="mono">org.x402.origins</td>
                            <td className="mono">{cur === "failed" ? "?" : cur ? cur.origins || "—" : "…"}</td>
                            <td className="mono">{plan.origins.join(" ")}</td>
                          </tr>
                          {plan.addrs.map((a) => (
                            <tr key={a.network}>
                              <td>{networkLabel(a.network)} address</td>
                              <td className="mono">
                                {cur === "failed" ? "?" : cur ? (cur.addrs[a.network] ? shortAddr(cur.addrs[a.network]!) : "—") : "…"}
                              </td>
                              <td className="mono">{shortAddr(a.address)}</td>
                            </tr>
                          ))}
                          <tr>
                            <td className="mono">org.x402.payto</td>
                            <td className="mono">{cur === "failed" ? "?" : cur ? cur.payto || "—" : "…"}</td>
                            <td className="mono">{plan.payto.map((p) => shortAddr(p.split(":").pop()!)).join(" ") || "— (cleared)"}</td>
                          </tr>
                        </tbody>
                      </table>
                    )}
                    {plan && others.length > 0 && (
                      <div className="verify-origins">
                        <p className="verify-note">
                          This name already lists other origins. Keep the ones you still serve; remove stale ones.
                        </p>
                        <ul>
                          {others.map((o) => {
                            const removed = (dropped[name] ?? []).includes(o);
                            return (
                              <li key={o} data-removed={removed}>
                                <span className="mono">{o}</span>
                                <button
                                  className="success-link"
                                  onClick={() =>
                                    setDropped((d) => ({
                                      ...d,
                                      [name]: removed ? (d[name] ?? []).filter((x) => x !== o) : [...(d[name] ?? []), o],
                                    }))
                                  }
                                >
                                  {removed ? "Keep" : "Remove"}
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}
                    {plan && cur === "failed" && (
                      <p className="verify-error">
                        Couldn&apos;t read this name&apos;s current records, so writing is paused to avoid overwriting them. Read the 402 again to retry.
                      </p>
                    )}
                    {c?.extensions && "payee-name" in c.extensions && (
                      <p className="verify-note">
                        This endpoint already declares{" "}
                        <span className="mono">
                          {String((c.extensions["payee-name"] as { info?: { name?: unknown } })?.info?.name)}
                        </span>.
                      </p>
                    )}
                  </div>
                );
              })}

              {payoutElsewhere && (
                <p className="verify-warn">
                  A payout address here is not your connected wallet. That&apos;s normal for a Safe or a treasury, but
                  check it: payments to this name will be authorized to go there.
                </p>
              )}
              {writer.error && <p className="verify-error">{writer.error}</p>}
              <div className="verify-actions">
                <button
                  className="btn btn-primary btn-lg"
                  disabled={!ready || writer.state === "signing" || writer.state === "confirming"}
                  onClick={async () => {
                    await writer.write(plans.filter((p): p is { name: string; plan: PayeePlan } => p.plan !== null));
                  }}
                >
                  {writer.state === "signing"
                    ? "Confirm in your wallet…"
                    : writer.state === "confirming"
                      ? "Writing on Ethereum…"
                      : "Write records"}{" "}
                  <span className="arrow">→</span>
                </button>
                <button className="btn btn-ghost btn-lg" onClick={() => setStep(2)}>
                  Records already set — skip
                </button>
              </div>
              {writer.state === "written" && (
                <div className="verify-ok">
                  Records written.{" "}
                  {writer.hashes.map((h) => (
                    <a key={h} className="verify-link mono" href={`https://etherscan.io/tx/${h}`} target="_blank" rel="noreferrer">
                      {shortAddr(h)}
                    </a>
                  ))}{" "}
                  <button className="btn btn-primary" onClick={() => setStep(2)}>
                    Continue <span className="arrow">→</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="verify-card">
              <h2>Verify</h2>
              <p className="verify-note">
                Declare the name in your 402 and redeploy, then verify. The record check passes as soon as the
                records are set; the endpoint check passes once your server declares the name.
              </p>
              {selected.map((name) => {
                const check = checks[name];
                const declared = check?.challenge?.extensions?.["payee-name"] as { info?: { name?: unknown } } | undefined;
                const declaredName = typeof declared?.info?.name === "string" ? declared.info.name : null;
                const recordsOk = check?.verdicts?.every((v) => v.verdict === true) ?? false;
                const verified = recordsOk && declaredName === name;
                return (
                  <div key={name} className="verify-endpoint">
                    <div className="verify-row">
                      <span className="mono verify-name">{name}</span>
                      {verified && <span className="verify-badge">Verified payee</span>}
                    </div>
                    <div className="code-block verify-code">
                      <button
                        className="btn btn-ghost verify-copy"
                        onClick={() => navigator.clipboard?.writeText(snippet(name))}
                      >
                        Copy
                      </button>
                      <pre><code className="mono">{snippet(name)}</code></pre>
                    </div>
                    <label className="field-label" style={{ marginTop: 16 }}>Paid route to check</label>
                    <div className="input-row">
                      <input
                        className="label-input"
                        placeholder="https://api.example.com/v1/route"
                        value={ep(name).url}
                        onChange={(ev) => patch(name, { url: ev.target.value })}
                        onKeyDown={(ev) => ev.key === "Enter" && originOf(ep(name).url) && verify(name)}
                      />
                    </div>
                    <div className="verify-actions">
                      <button className="btn btn-primary" onClick={() => verify(name)} disabled={check?.running || !originOf(ep(name).url)}>
                        {check?.running ? "Checking…" : check ? "Verify again" : "Verify"}
                      </button>
                    </div>
                    {check?.error && <p className="verify-error">{check.error}</p>}
                    {check?.verdicts && (
                      <ul className="verify-results">
                        {check.verdicts.map((v) => (
                          <li key={v.accepts_index} data-verdict={String(v.verdict)}>
                            <b>
                              Records · {networkLabel(check.challenge!.accepts![v.accepts_index].network)}{" "}
                              {shortAddr(check.challenge!.accepts![v.accepts_index].payTo)}
                            </b>
                            <span>{reasonText(v)}</span>
                          </li>
                        ))}
                        <li data-verdict={declaredName === name ? "true" : "false"}>
                          <b>Endpoint declares the name</b>
                          <span>
                            {declaredName === name
                              ? "Your 402 declares this name."
                              : declaredName
                                ? `Your 402 declares ${declaredName}, not ${name}.`
                                : "Not yet — add the snippet above and redeploy."}
                          </span>
                        </li>
                      </ul>
                    )}
                  </div>
                );
              })}
              <p className="verify-note" style={{ marginTop: 28 }}>
                Agents can run the same check with the <span className="mono">verify_payee</span> tool in{" "}
                <a className="verify-link" href="https://www.npmjs.com/package/@x402identity/mcp" target="_blank" rel="noreferrer">
                  @x402identity/mcp
                </a>
                , or in code with{" "}
                <a className="verify-link" href="https://www.npmjs.com/package/@x402identity/payee" target="_blank" rel="noreferrer">
                  @x402identity/payee
                </a>
                . How it works:{" "}
                <a
                  className="verify-link"
                  href="https://github.com/RWA-ID/x402-Identity/blob/main/specs/extensions/payee-name.md"
                  target="_blank"
                  rel="noreferrer"
                >
                  the payee-name spec
                </a>
                .
              </p>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
