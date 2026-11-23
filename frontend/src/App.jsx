import { useEffect, useState } from "react";

const UNIT = 100000000n;

function clerk(raw) {
  try {
    const value = BigInt(raw || 0);
    const whole = value / UNIT;
    const frac = (value % UNIT).toString().padStart(8, "0").replace(/0+$/, "");
    return `${whole}${frac ? `.${frac}` : ""} CLERK`;
  } catch {
    return "—";
  }
}

function supra(raw) {
  if (raw === null || raw === undefined || raw === "") return "—";
  return clerk(raw).replace(" CLERK", " SUPRA");
}

function short(address = "") {
  if (!address || address.length < 12) return address || "Not connected";
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

const BLURB = {
  "Wallet Detective": "Balance and recent activity, in plain language.",
  "Project Research": "What this account has published, and the SUPRA it holds.",
  "Contract Risk": "Looks for public actions such as mint or upgrade.",
  "Content": "Turns a finished report into a short post. It does not add facts.",
  "Wallet Cleaner": "Only lists a burn if the mechanism is already proven.",
  "Trading": "Checks whether a price exists. It will not invent one or send a swap.",
  "Portfolio": "The coins on an account. No profit, no price guess.",
};

function blurb(agent) {
  return BLURB[agent.name] || agent.description;
}

function jobLabel(status) {
  if (status === "FUNDED") return "Paid";
  if (status === "COMPLETED") return "Done";
  if (status === "REFUNDED") return "Refunded";
  if (status === "FAILED") return "Returned";
  return status || "";
}

function placeholder(type) {
  if (type === "package-module") return "A contract address, or address::module";
  if (type === "trade-intent") return "For example, 10 SUPRA for CLERK";
  if (type === "report") return "A wallet address to write from";
  if (type === "supra-address") return "Wallet address, starting with 0x";
  return "Tell the agent what to look at";
}

async function api(path, options) {
  const response = await fetch(path, options);
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "That did not work.");
  return body;
}

function accountFrom(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return accountFrom(value[0]);
  return value.address || value.account || "";
}

function wallet() {
  return window.starkey?.supra || null;
}

function txHash(result) {
  const hash = typeof result === "string" ? result : result?.hash || result?.txHash || result?.transactionHash || "";
  if (!hash) return "";
  return hash.startsWith("0x") ? hash : `0x${hash}`;
}

async function askWallet(prepared) {
  const provider = wallet();
  if (!provider?.sendTransaction) throw new Error("Install StarKey, then connect it.");
  let result;
  try {
    result = await provider.sendTransaction({
      data: prepared.data,
      from: prepared.from,
      to: "",
      value: "",
      chainId: "6",
    });
  } catch (error) {
    const text = error?.message || String(error || "");
    if (/reject|denied|cancel|closed/i.test(text)) throw new Error("The wallet was closed. Nothing was paid.");
    throw new Error("StarKey did not finish that approval.");
  }
  const hash = txHash(result);
  if (!hash) throw new Error("StarKey closed without a payment. Nothing was marked paid.");
  return hash;
}

async function waitFor(hash) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const row = await api("/api/tx/status", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ hash }),
    });
    if (row.status === "success") return;
    if (row.status === "failed") throw new Error("The transaction failed. Nothing was marked paid.");
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error("The network has not confirmed it yet. Check Jobs in a minute.");
}

export function App() {
  const [page, setPage] = useState("home");
  const [health, setHealth] = useState(null);
  const [agents, setAgents] = useState([]);
  const [address, setAddress] = useState("");
  const [picked, setPicked] = useState(null);
  const [input, setInput] = useState("");
  const [jobs, setJobs] = useState([]);
  const [openJob, setOpenJob] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [balance, setBalance] = useState("");
  const [again, setAgain] = useState("");

  async function refresh(next = address) {
    if (!next) return;
    const row = await api(`/api/balance/${next}`);
    setBalance(row.balance);
    setGas(row.supra);
    setJobs(await api(`/api/jobs?user=${next}`));
  }

  useEffect(() => {
    void Promise.all([api("/api/health"), api("/api/agents")])
      .then(([nextHealth, nextAgents]) => {
        setHealth(nextHealth);
        setAgents(nextAgents);
      })
      .catch((reason) => setError(reason.message));
  }, []);

  async function connect() {
    setError("");
    const provider = wallet();
    if (!provider) {
      setError("StarKey is not installed in this browser.");
      return;
    }
    await provider.connect();
    await provider.changeNetwork?.({ chainId: "6" });
    const next = accountFrom(await provider.account());
    if (!next) {
      setError("StarKey did not share an account.");
      return;
    }
    setAddress(next);
    await refresh(next);
  }

  async function disconnect() {
    setError("");
    try { await wallet()?.disconnect?.(); } catch { /* the wallet may already be closed */ }
    setAddress("");
    setBalance("");
    setGas(null);
    setJobs([]);
    setOpenJob(null);
    setPage("home");
  }

  async function hire(agent) {
    setError("");
    setNotice("");
    if (!address) return setError("Connect StarKey first.");
    if (!input.trim()) return setError("Write what the agent should look at.");
    setBusy(true);
    try {
      const prepared = await api("/api/tx", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind: "hire", sender: address, agentId: agent.id, input }),
      });
      setNotice("StarKey should open now. Approve the payment there.");
      const hash = await askWallet(prepared);
      setNotice("Payment sent. Waiting for testnet.");
      await waitFor(hash);
      const done = await api("/api/jobs/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ hash, input }),
      });
      setOpenJob({ ...done, hash });
      setPage("job");
      setNotice("");
      await refresh();
    } catch (reason) {
      setNotice("");
      setError(reason.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="shell">
      <header className="top">
        <button className="brand" type="button" onClick={() => setPage("home")}>
          <strong>CLERK</strong>
          <span>Testnet</span>
        </button>
        <nav className="nav">
          <button type="button" aria-current={page === "market" ? "page" : undefined} onClick={() => setPage("market")}>Agents</button>
          <button type="button" aria-current={page === "jobs" ? "page" : undefined} onClick={() => setPage("jobs")}>Jobs</button>
          <button type="button" aria-current={page === "wallet" ? "page" : undefined} onClick={() => setPage("wallet")}>Wallet</button>
          <button type="button" aria-current={page === "trade" ? "page" : undefined} onClick={() => setPage("trade")}>Trade</button>
          {address ? (
            <button type="button" onClick={() => void disconnect()}>{short(address)} · Disconnect</button>
          ) : (
            <button className="connect" type="button" onClick={() => void connect()}>Connect StarKey</button>
          )}
        </nav>
      </header>
      <main className="main">
        {error ? <p className="error">{error}</p> : null}
        {notice ? <p className="notice">{notice}</p> : null}
        {page === "home" ? <Home connected={Boolean(address)} onBrowse={() => setPage("market")} onConnect={() => void connect()} /> : null}
        {page === "market" ? (
          <section>
            <h1>Agents</h1>
            <p className="lede">Pick one, pay its price in CLERK, and get the result back here.</p>
            <div className="grid">
              {agents.map((agent) => (
                <article className="card" key={agent.id}>
                  <span className="eyebrow">{agent.category}</span>
                  <h2>{agent.name}</h2>
                  <p>{blurb(agent)}</p>
                  <strong className="price">{clerk(agent.price)}</strong>
                  <button type="button" onClick={() => { setPicked(agent); setInput(""); setPage("hire"); }}>Hire</button>
                </article>
              ))}
            </div>
          </section>
        ) : null}
        {page === "hire" && picked ? (
          <section className="panel hire">
            <span className="eyebrow">{clerk(picked.price)}</span>
            <h1>{picked.name}</h1>
            <p>{blurb(picked)}</p>
            <p>StarKey will ask you to approve this payment. The result appears after the network accepts it.</p>
            <label>What should it look at?
              <textarea rows={4} value={input} onChange={(event) => setInput(event.target.value)} placeholder={placeholder(picked.inputType)} />
            </label>
            <button className="pay" type="button" disabled={busy} onClick={() => void hire(picked)}>
              {busy ? "Waiting for StarKey" : `Pay ${clerk(picked.price)}`}
            </button>
            <p className="muted">Your balance: {balance ? clerk(balance) : "connect a wallet"} · Network fee: {supra(gas)}</p>
            {!address ? <button type="button" className="ghost" onClick={() => void connect()}>Connect StarKey</button> : null}
          </section>
        ) : null}
        {page === "jobs" ? (
          <section className="stack">
            <h1>Your jobs</h1>
            {jobs.map((job) => {
              const agent = agents.find((item) => item.id === job.agentId);
              return (
                <button className="panel job" key={job.id} type="button" onClick={async () => {
                  const body = await api(`/api/jobs/${job.id}`);
                  setOpenJob(body);
                  setPage("job");
                }}>
                  <strong>{agent?.name || `Job ${job.id}`}</strong>
                  <span>{jobLabel(job.status)}</span>
                  <span>{clerk(job.amount)}</span>
                </button>
              );
            })}
            {!address ? <p className="muted">Connect StarKey to see the jobs you paid for.</p> : null}
            {address && !jobs.length ? <p className="muted">No jobs for this wallet yet.</p> : null}
          </section>
        ) : null}
        {page === "job" && openJob?.report ? <Report report={openJob.report} job={openJob.job} hash={openJob.hash} /> : null}
        {page === "job" && openJob && !openJob.report ? (
          <section className="panel hire">
            <h1>{agents.find((item) => item.id === openJob.job?.agentId)?.name || "Paid job"}</h1>
            <p>This payment is saved. Enter the same request to open the result. It does not charge again.</p>
            <label>The request you paid for
              <textarea rows={3} value={again} onChange={(event) => setAgain(event.target.value)} />
            </label>
            <button className="pay" type="button" disabled={busy} onClick={async () => {
              setError("");
              setBusy(true);
              try {
                const body = await api("/api/jobs/open", {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({ id: openJob.job.id, input: again }),
                });
                setOpenJob(body);
              } catch (reason) {
                setError(reason.message);
              } finally {
                setBusy(false);
              }
            }}>{busy ? "Opening" : "Open the result"}</button>
          </section>
        ) : null}
        {page === "trade" ? <Trade /> : null}
        {page === "wallet" ? (
          <Wallet
            address={address}
            balance={balance}
            gas={gas}
            busy={busy}
            onConnect={() => void connect()}
            onFaucet={async () => {
              setError("");
              setNotice("StarKey should open so you can claim 500 test CLERK.");
              setBusy(true);
              try {
                const prepared = await api("/api/tx", {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({ kind: "faucet", sender: address }),
                });
                const hash = await askWallet(prepared);
                await waitFor(hash);
                await refresh();
                setNotice("500 test CLERK is in this wallet. You can claim again in an hour.");
              } catch (reason) {
                setNotice("");
                setError(reason.message);
              } finally {
                setBusy(false);
              }
            }}
            onSupra={async () => {
              setError("");
              setBusy(true);
              try {
                await api("/api/supra-faucet", {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({ user: address }),
                });
                await refresh();
                setNotice("Test SUPRA was requested. It pays the network fee, not the agent.");
              } catch (reason) {
                setError(reason.message);
              } finally {
                setBusy(false);
              }
            }}
          />
        ) : null}
      </main>
      <footer className="foot">Testnet. Pay an agent, then read the result.</footer>
    </div>
  );
}

function Home({ connected, onBrowse, onConnect }) {
  return (
    <section className="hero">
      <p className="eyebrow">Testnet</p>
      <h1>Pay an agent. Get the job.</h1>
      <p className="lede">Wallet reports, contract checks, and cleanups. CLERK pays for the work. It does not earn yield.</p>
      <div className="actions">
        <button className="pay" type="button" onClick={onBrowse}>See the agents</button>
        {connected ? null : <button className="ghost" type="button" onClick={onConnect}>Connect StarKey</button>}
      </div>
    </section>
  );
}

function Report({ report }) {
  const rows = Array.isArray(report.history) && report.history.length ? report.history : (report.lines || []);
  const holdings = Array.isArray(report.holdings) ? report.holdings : [];
  return (
    <section className="report">
      <div>
        <p className="eyebrow">{report.title || "Result"}</p>
        <h1>{report.summary || report.title}</h1>
        {report.subject ? <p className="subject">{short(report.subject)}</p> : null}
      </div>
      {holdings.length ? (
        <div className="balances">
          {holdings.map((item) => (
            <div className="stat" key={`${item.name}-${item.amount}`}>
              <strong>{item.amount}</strong>
              <span>{item.name}</span>
            </div>
          ))}
        </div>
      ) : null}
      {rows.length ? (
        <ol className="timeline">
          {rows.map((row, index) => (
            <li key={index}>
              <time>{row.when || "Result"}</time>
              <strong>{row.title}</strong>
              <span>{row.detail || ""}</span>
            </li>
          ))}
        </ol>
      ) : (
        <div className="stack">
          {(report.claims || []).slice(0, 4).map((claim, index) => <p key={index}>{claim.claim}</p>)}
        </div>
      )}
      {report.watch ? <p className="note">{report.watch}</p> : null}
    </section>
  );
}

function Trade() {
  const [preview, setPreview] = useState(null);
  const [pay, setPay] = useState("100 SUPRA");
  const [receive, setReceive] = useState("another token");
  const [error, setError] = useState("");
  return (
    <section className="panel hire">
      <h1>Trade</h1>
      <p>Ask for a price. If no venue can quote it, nothing is swapped and no transaction is created.</p>
      <label>Pay<input value={pay} onChange={(event) => setPay(event.target.value)} /></label>
      <label>Receive<input value={receive} onChange={(event) => setReceive(event.target.value)} /></label>
      <button className="pay" type="button" onClick={async () => {
        setError("");
        try {
          setPreview(await api("/api/trade/preview", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ pay, receive, slippageBps: 100 }),
          }));
        } catch (reason) { setError(reason.message); }
      }}>Check the price</button>
      {error ? <p className="error">{error}</p> : null}
      {preview ? <Report report={preview} job={{ status: "Price check" }} /> : null}
    </section>
  );
}

function Wallet({ address, balance, gas, busy, onConnect, onFaucet, onSupra }) {
  if (!address) {
    return (
      <section className="panel">
        <h1>Wallet</h1>
        <p>Connect StarKey to see your testnet balance and claim test CLERK.</p>
        <button className="pay" type="button" onClick={onConnect}>Connect StarKey</button>
      </section>
    );
  }
  return (
    <section className="panel">
      <h1>Wallet</h1>
      <div className="balances">
        <div className="stat"><strong>{balance ? clerk(balance).replace(" CLERK", "") : "0"}</strong><span>CLERK</span></div>
        <div className="stat"><strong>{gas ? supra(gas).replace(" SUPRA", "") : "0"}</strong><span>SUPRA for fees</span></div>
      </div>
      <div className="actions">
        <button className="pay" type="button" disabled={busy} onClick={onFaucet}>{busy ? "Waiting for StarKey" : "Get 500 test CLERK"}</button>
        <button className="ghost" type="button" disabled={busy} onClick={onSupra}>Get test SUPRA</button>
      </div>
      <p className="muted">{short(address)}. Test CLERK can be claimed once an hour. SUPRA only pays the network fee.</p>
    </section>
  );
}
