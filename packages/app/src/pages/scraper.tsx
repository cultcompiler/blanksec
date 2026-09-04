import { createSignal, For, Show, onMount, createMemo } from "solid-js"

// The scraper bridge is exposed by the desktop preload as window.api.scraper.
// It drives the 24/7 dark-web scraper daemon on the Kali box over SSH.
type ScraperJob = { id: number; description?: string; status?: string; matches?: number; [k: string]: unknown }
type ScraperFinding = { url?: string; score?: number; title?: string; snippet?: string; [k: string]: unknown }
type ScraperResult = { ok?: boolean; error?: string; [k: string]: unknown }
type ScraperAPI = {
  addJob: (descr: string, plan?: unknown) => Promise<ScraperResult>
  listJobs: () => Promise<ScraperJob[]>
  results: (id: number, limit?: number) => Promise<ScraperFinding[]>
  start: (id: number) => Promise<ScraperResult>
  stop: (id: number) => Promise<ScraperResult>
  delete: (id: number) => Promise<ScraperResult>
  status: () => Promise<ScraperResult>
}
const api = (): ScraperAPI | undefined => (window as unknown as { api?: { scraper?: ScraperAPI } }).api?.scraper

const c = {
  bg: "var(--v2-background-bg-deep, #0a0a0a)",
  panel: "var(--v2-background-bg-base, #151515)",
  panel2: "var(--v2-background-bg-inverse, #1c1c1c)",
  border: "var(--border-base, #2a2a2a)",
  text: "var(--text-strong, #ededed)",
  weak: "var(--text-weak, #8a8a8a)",
  accent: "var(--icon-interactive-base, #4c7fff)",
  danger: "#e5534b",
  ok: "#3fb950",
}

export default function ScraperPage() {
  const [jobs, setJobs] = createSignal<ScraperJob[]>([])
  const [selected, setSelected] = createSignal<number | null>(null)
  const [findings, setFindings] = createSignal<ScraperFinding[]>([])
  const [status, setStatus] = createSignal<ScraperResult | null>(null)
  const [descr, setDescr] = createSignal("")
  const [busy, setBusy] = createSignal(false)
  const [msg, setMsg] = createSignal<string | null>(null)
  const [loadingFindings, setLoadingFindings] = createSignal(false)

  const available = createMemo(() => !!api())

  async function refresh() {
    const s = api()
    if (!s) return
    setBusy(true)
    try {
      const [st, js] = await Promise.all([s.status(), s.listJobs()])
      setStatus(st)
      setJobs(Array.isArray(js) ? js : [])
    } catch (e: any) {
      setMsg("Could not reach the Kali scraper: " + String(e?.message || e))
    } finally {
      setBusy(false)
    }
  }

  async function loadFindings(id: number) {
    const s = api()
    if (!s) return
    setSelected(id)
    setLoadingFindings(true)
    setFindings([])
    try {
      const r = await s.results(id, 100)
      setFindings(Array.isArray(r) ? r : [])
    } catch (e: any) {
      setMsg("Could not load findings: " + String(e?.message || e))
    } finally {
      setLoadingFindings(false)
    }
  }

  async function addJob() {
    const s = api()
    const d = descr().trim()
    if (!s || !d) return
    setBusy(true)
    setMsg("Interpreting the description and building a search plan (this can take up to a minute)...")
    try {
      const r = await s.addJob(d)
      if (r && r.ok === false) setMsg("Job not added: " + (r.error || "unknown error"))
      else {
        setMsg("Job added. It will start crawling shortly.")
        setDescr("")
      }
      await refresh()
    } catch (e: any) {
      setMsg("Add failed: " + String(e?.message || e))
    } finally {
      setBusy(false)
    }
  }

  async function act(kind: "start" | "stop" | "delete", id: number) {
    const s = api()
    if (!s) return
    if (kind === "delete" && !confirm("Delete this scrape job and its findings?")) return
    setBusy(true)
    try {
      await s[kind](id)
      if (kind === "delete" && selected() === id) {
        setSelected(null)
        setFindings([])
      }
      await refresh()
    } catch (e: any) {
      setMsg(kind + " failed: " + String(e?.message || e))
    } finally {
      setBusy(false)
    }
  }

  onMount(refresh)

  const daemonUp = createMemo(() => {
    const st = status()
    return !!st && st.ok !== false && !st.error
  })

  return (
    <div style={{ height: "100%", display: "flex", "flex-direction": "column", background: c.bg, color: c.text }}>
      {/* header */}
      <div
        style={{
          display: "flex",
          "align-items": "center",
          gap: "12px",
          padding: "16px 20px",
          "border-bottom": `1px solid ${c.border}`,
        }}
      >
        <div style={{ "font-size": "16px", "font-weight": "600" }}>Scraper</div>
        <div
          style={{
            "font-size": "12px",
            padding: "2px 8px",
            "border-radius": "999px",
            border: `1px solid ${c.border}`,
            color: daemonUp() ? c.ok : c.danger,
          }}
        >
          {daemonUp() ? "Kali daemon online" : "Kali daemon unreachable"}
        </div>
        <div style={{ flex: "1" }} />
        <button
          onClick={refresh}
          disabled={busy()}
          style={{
            "font-size": "13px",
            padding: "6px 12px",
            "border-radius": "6px",
            border: `1px solid ${c.border}`,
            background: c.panel,
            color: c.text,
            cursor: "pointer",
          }}
        >
          Refresh
        </button>
      </div>

      <Show
        when={available()}
        fallback={
          <div style={{ padding: "24px", color: c.weak }}>
            The scraper is only available in the Blank desktop app (it needs the Kali SSH bridge).
          </div>
        }
      >
        {/* new job */}
        <div style={{ display: "flex", gap: "8px", padding: "14px 20px", "border-bottom": `1px solid ${c.border}` }}>
          <input
            value={descr()}
            onInput={(e) => setDescr(e.currentTarget.value)}
            onKeyDown={(e) => e.key === "Enter" && addJob()}
            placeholder="Describe what to scrape (plain English) — e.g. 'leaked credential dumps mentioning acme.com'"
            style={{
              flex: "1",
              "font-size": "13px",
              padding: "9px 12px",
              "border-radius": "6px",
              border: `1px solid ${c.border}`,
              background: c.panel,
              color: c.text,
              outline: "none",
            }}
          />
          <button
            onClick={addJob}
            disabled={busy() || !descr().trim()}
            style={{
              "font-size": "13px",
              "font-weight": "500",
              padding: "9px 16px",
              "border-radius": "6px",
              border: "none",
              background: c.accent,
              color: "#fff",
              cursor: descr().trim() ? "pointer" : "default",
              opacity: descr().trim() && !busy() ? "1" : "0.5",
            }}
          >
            Add job
          </button>
        </div>

        <Show when={msg()}>
          <div style={{ padding: "8px 20px", "font-size": "12px", color: c.weak, "border-bottom": `1px solid ${c.border}` }}>
            {msg()}
          </div>
        </Show>

        {/* body: jobs | findings */}
        <div style={{ flex: "1", display: "flex", "min-height": "0" }}>
          {/* job list */}
          <div style={{ width: "340px", "border-right": `1px solid ${c.border}`, overflow: "auto", "flex-shrink": "0" }}>
            <Show
              when={jobs().length}
              fallback={<div style={{ padding: "20px", color: c.weak, "font-size": "13px" }}>No scrape jobs yet.</div>}
            >
              <For each={jobs()}>
                {(job) => {
                  const running = () => String(job.status || "").toLowerCase().includes("run")
                  return (
                    <div
                      onClick={() => loadFindings(job.id)}
                      style={{
                        padding: "12px 16px",
                        "border-bottom": `1px solid ${c.border}`,
                        cursor: "pointer",
                        background: selected() === job.id ? c.panel2 : "transparent",
                      }}
                    >
                      <div style={{ "font-size": "13px", "line-height": "1.35", "margin-bottom": "6px" }}>
                        {job.description || `Job #${job.id}`}
                      </div>
                      <div style={{ display: "flex", "align-items": "center", gap: "10px", "font-size": "11px", color: c.weak }}>
                        <span style={{ color: running() ? c.ok : c.weak }}>{running() ? "running" : job.status || "idle"}</span>
                        <Show when={typeof job.matches === "number"}>
                          <span>{job.matches} matches</span>
                        </Show>
                        <div style={{ flex: "1" }} />
                        <Show
                          when={running()}
                          fallback={
                            <button onClick={(e) => (e.stopPropagation(), act("start", job.id))} style={miniBtn(c.accent)}>
                              start
                            </button>
                          }
                        >
                          <button onClick={(e) => (e.stopPropagation(), act("stop", job.id))} style={miniBtn(c.weak)}>
                            stop
                          </button>
                        </Show>
                        <button onClick={(e) => (e.stopPropagation(), act("delete", job.id))} style={miniBtn(c.danger)}>
                          delete
                        </button>
                      </div>
                    </div>
                  )
                }}
              </For>
            </Show>
          </div>

          {/* findings */}
          <div style={{ flex: "1", overflow: "auto", "min-width": "0" }}>
            <Show
              when={selected() !== null}
              fallback={
                <div style={{ padding: "24px", color: c.weak, "font-size": "13px" }}>
                  Select a job to view its ranked findings.
                </div>
              }
            >
              <Show
                when={!loadingFindings()}
                fallback={<div style={{ padding: "24px", color: c.weak }}>Loading findings...</div>}
              >
                <Show
                  when={findings().length}
                  fallback={<div style={{ padding: "24px", color: c.weak }}>No findings scored above the bar yet.</div>}
                >
                  <For each={findings()}>
                    {(f) => (
                      <div style={{ padding: "12px 20px", "border-bottom": `1px solid ${c.border}` }}>
                        <div style={{ display: "flex", "align-items": "baseline", gap: "10px", "margin-bottom": "4px" }}>
                          <Show when={typeof f.score === "number"}>
                            <span style={{ "font-size": "12px", "font-weight": "600", color: c.accent }}>{f.score}</span>
                          </Show>
                          <span style={{ "font-size": "13px", "font-weight": "500", "word-break": "break-all" }}>
                            {f.title || f.url || "(untitled)"}
                          </span>
                        </div>
                        <Show when={f.url && f.title}>
                          <div style={{ "font-size": "11px", color: c.weak, "word-break": "break-all", "margin-bottom": "4px" }}>
                            {f.url}
                          </div>
                        </Show>
                        <Show when={f.snippet}>
                          <div style={{ "font-size": "12px", color: c.weak, "line-height": "1.4" }}>{f.snippet}</div>
                        </Show>
                      </div>
                    )}
                  </For>
                </Show>
              </Show>
            </Show>
          </div>
        </div>
      </Show>
    </div>
  )
}

function miniBtn(color: string) {
  return {
    "font-size": "11px",
    padding: "2px 7px",
    "border-radius": "4px",
    border: `1px solid ${color}`,
    background: "transparent",
    color,
    cursor: "pointer",
  } as const
}
