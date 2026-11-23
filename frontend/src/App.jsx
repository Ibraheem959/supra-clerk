import { useEffect, useState } from "react";

const UNIT = 100000000n;

function clerk(raw) {
  try {
    const value = BigInt(raw);
    const whole = value / UNIT;
    const frac = (value % UNIT).toString().padStart(8, "0").replace(/0+$/, "");
    return `${whole}${frac ? `.${frac}` : ""} CLERK`;
  } catch {
    return "—";
  }
}

function short(address = "") {
  if (address.length < 12) return address || "Not connected";
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

async function api(path, options) {
  const response = await fetch(path, options);
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "The desk refused that.");
  return body;
}

function accountFrom(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return accountFrom(value[0]);
  return value.address || value.account || "";
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
  const [busy, setBusy] = useState(false);
  const [balance, setBalance] = useState("");

  async function load() {
    const [nextHealth, nextAgents] = await Promise.all([api("/api/health"), api("/api/agents")]);
    setHealth(nextHealth);
    setAgents(nextAgents);
  }

  useEffect(() => { void load().catch((reason) => setError(reason.message)); }, []);

  async function connect() {
    setError("");
    const provider = window.starkey?.supra;
    if (!provider) {
      setError("StarKey is not in this browser. Install it, then connect.");
      return;
    }
    await provider.connect();
    const chain = health?.chainId === 6 ? "6" : health?.chainId === 50 ? "50" : "8";
    await provider.changeNetwork?.({ chainId: chain });
    const next = accountFrom(await provider.account());
    setAddress(next);
    if (next && health?.mode !== "chain") {
      await api("/api/faucet", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ user: next }) });
    }
    if (next) {
      const row = await api(`/api/balance/${next}`);
      setBalance(row.balance);
      setJobs(await api(`/api/jobs?user=${next}`));
    }
  }

  async function hire(agent) {
    setError("");
    if (!address) return setError("Connect StarKey first.");
    if (!input.trim()) return setError("The job needs an input.");
    setBusy(true);
    try {
      if (health?.mode === "chain") {
        const prepared = await api("/api/jobs", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ user: address, agentId: agent.id, input }),
        });
        setOpenJob({
          job: { status: "AWAITING SIGNATURE" },
          report: {
            title: agent.name,
            subject: prepared.function,
            claims: [{ label: "DATA", claim: prepared.note, evidence: prepared.args.join("\n") }],
            unavailable: ["StarKey must sign the hire. This page does not mark it paid."],
          },
        });
        setPage("job");
        return;
      }
      const created = await api("/api/jobs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ user: address, agentId: agent.id, input }),
      });
      const done = await api(`/api/jobs/${created.id}/run`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ secret: created.secret }),
      });
      sessionStorage.setItem(`clerk-job-${created.id}`, created.secret);
      setOpenJob(done);
      setPage("job");
      setJobs(await api(`/api/jobs?user=${address}`));
      const row = await api(`/api/balance/${address}`);
      setBalance(row.balance);
    } catch (reason) {
      setError(reason.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="shell">
      <header className="top">
        <div className="brand">
          <strong>CLERK</strong>
          <span>Pay the agent. Get the job done.</span>
        </div>
        <nav className="nav">
          {["home", "market", "jobs", "trade", "wallet"].map((id) => (
            <button key={id} type="button" aria-current={page === id ? "page" : undefined} onClick={() => setPage(id)}>
              {id === "market" ? "Agents" : id[0].toUpperCase() + id.slice(1)}
            </button>
          ))}
          <button type="button" onClick={() => void connect()}>{address ? short(address) : "Connect StarKey"}</button>
        </nav>
      </header>
      <main className="main">
        {health ? (
          <p className="banner">
            {health.mode === "chain"
              ? `On-chain escrow. Supra testnet, chain id ${health.chainId}. Market ${health.market}. Reports still read ${health.reports}.`
              : health.note}
          </p>
        ) : null}
        {error ? <p className="error">{error}</p> : null}
        {page === "home" ? <Home onBrowse={() => setPage("market")} /> : null}
        {page === "market" ? (
          <section className="grid">
            {agents.map((agent) => (
              <article className="card" key={agent.id}>
                <span className="muted">{agent.category}</span>
                <h2>{agent.name}</h2>
                <p>{agent.description}</p>
                <strong className="price">{clerk(agent.price)}</strong>
                <span className="muted">{agent.permissions}</span>
                <span className="muted">{agent.completed} completed · {agent.rating === null ? "no rating yet" : `${agent.rating.toFixed(1)} rating`}</span>
                <button type="button" onClick={() => { setPicked(agent); setPage("hire"); }}>Hire</button>
              </article>
            ))}
          </section>
        ) : null}
        {page === "hire" && picked ? (
          <section className="panel">
            <span className="muted">{picked.permissions}</span>
            <h1>{picked.name}</h1>
            <p>{picked.description}</p>
            <p className="price">{clerk(picked.price)} leaves the local balance when you hire. A published market would escrow this in the Move module instead.</p>
            <label>Input
              <textarea rows={5} value={input} onChange={(event) => setInput(event.target.value)} placeholder={picked.inputType === "package-module" ? "0xaddress::module" : "0x wallet address"} />
            </label>
            <button className="pay" type="button" disabled={busy} onClick={() => void hire(picked)}>{busy ? "Working" : "Pay and run"}</button>
          </section>
        ) : null}
        {page === "jobs" ? (
          <section className="jobs">
            <h1>My jobs</h1>
            {jobs.map((job) => (
              <button className="panel" key={job.id} type="button" onClick={async () => {
                const secret = sessionStorage.getItem(`clerk-job-${job.id}`);
                const body = await api(`/api/jobs/${job.id}${secret ? `?secret=${secret}` : ""}`);
                setOpenJob(body);
                setPage("job");
              }}>
                <strong>Job {job.id}</strong>
                <span>{job.status} · {clerk(job.amount)}</span>
              </button>
            ))}
            {!jobs.length ? <p className="muted">No jobs for this wallet yet.</p> : null}
          </section>
        ) : null}
        {page === "job" && openJob?.report ? <Report report={openJob.report} job={openJob.job} /> : null}
        {page === "trade" ? <Trade /> : null}
        {page === "wallet" ? <Wallet address={address} balance={balance} health={health} /> : null}
      </main>
    </div>
  );
}

function Home({ onBrowse }) {
  return (
    <section>
      <p className="muted">SUPRA · MOVE · A DESK, NOT A CHAT</p>
      <h1>Hire an agent. Pay on-chain. Get the job done.</h1>
      <p className="lede">Clerk sells finished work. A wallet report, a contract reading, a cleanup that refuses to burn what it cannot prove. The token pays for the job. It does not earn yield.</p>
      <button className="pay" type="button" onClick={onBrowse}>See the agents</button>
    </section>
  );
}

function Report({ report, job }) {
  return (
    <section className="claims">
      <p className="muted">{job?.status} · {report.title}</p>
      <h1>{report.subject}</h1>
      {report.claims?.map((claim, index) => (
        <article className="claim" data-label={claim.label} key={index}>
          <small>{claim.label}</small>
          <p>{claim.claim}</p>
          <pre>{claim.evidence}</pre>
        </article>
      ))}
      {report.unavailable?.map((line) => <p className="muted" key={line}>{line}</p>)}
    </section>
  );
}

function Trade() {
  const [preview, setPreview] = useState(null);
  const [pay, setPay] = useState("100 SUPRA");
  const [receive, setReceive] = useState("a token");
  return (
    <section className="panel">
      <h1>Trading</h1>
      <p>Atmos, Dexlyn, and WARs are asked only when an official quote is pinned. None is pinned, so this preview will not invent a price or a transaction.</p>
      <label>Pay<input value={pay} onChange={(event) => setPay(event.target.value)} /></label>
      <label>Receive<input value={receive} onChange={(event) => setReceive(event.target.value)} /></label>
      <button className="pay" type="button" onClick={async () => {
        setPreview(await api("/api/trade/preview", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ pay, receive, slippageBps: 100 }),
        }));
      }}>Compare venues</button>
      {preview ? <Report report={preview} job={{ status: "PREVIEW" }} /> : null}
    </section>
  );
}

function Wallet({ address, balance, health }) {
  return (
    <section className="panel">
      <h1>Wallet</h1>
      <p>{address || "StarKey is not connected."}</p>
      <p className="price">{balance ? clerk(balance) : "—"} on the local ledger</p>
      <p className="muted">Network {health?.network}. Market address {health?.market || "not published"}.</p>
    </section>
  );
}
