import { createSignal, For, Show, onMount, createMemo } from "solid-js"
import { ButtonV2 } from "@opencode-ai/ui/v2/button-v2"
import { Icon as IconV2 } from "@opencode-ai/ui/v2/icon"
import { IconButtonV2 } from "@opencode-ai/ui/v2/icon-button-v2"
import { ScrollView } from "@opencode-ai/ui/scroll-view"

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
  const daemonUp = createMemo(() => {
    const st = status()
    return !!st && st.ok !== false && !st.error
  })

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
    if (!s || !d || busy()) return
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

  return (
    <div class="flex h-full min-h-0 w-full flex-col bg-v2-background-bg-base">
      {/* header */}
      <div class="flex shrink-0 items-center gap-3 px-6 pt-6 pb-4">
        <h1 class="text-[15px] tracking-[-0.1px] text-v2-text-text-base [font-weight:560]">Scraper</h1>
        <Show
          when={daemonUp()}
          fallback={
            <div class="flex items-center gap-1.5 text-[12px] text-v2-text-text-faint [font-weight:440]">
              <span class="size-1.5 rounded-full bg-current opacity-70" />
              <span>Kali daemon unreachable</span>
            </div>
          }
        >
          <div class="flex items-center gap-1.5 text-[12px] text-v2-text-text-muted [font-weight:440]">
            <IconV2 name="status-active" class="size-3" />
            <span>Kali daemon online</span>
          </div>
        </Show>
        <div class="flex-1" />
        <ButtonV2 variant="ghost-muted" size="small" icon="outline-reset" onClick={refresh} disabled={busy()}>
          Refresh
        </ButtonV2>
      </div>

      <Show
        when={available()}
        fallback={
          <div class="px-6 py-4 text-[13px] leading-5 text-v2-text-text-muted [font-weight:440]">
            The scraper is only available in the Blank desktop app (it needs the Kali SSH bridge).
          </div>
        }
      >
        {/* new job */}
        <div class="flex shrink-0 items-center gap-2 px-6 pb-4">
          <label
            class={`
              relative flex h-9 flex-1 items-center gap-2 rounded-[6px] py-1 pl-3 pr-2
              bg-v2-background-bg-layer-02/60 text-v2-icon-icon-muted transition-[background-color]
              duration-[120ms] ease-in-out hover:bg-v2-background-bg-layer-02 focus-within:bg-v2-background-bg-layer-02
            `}
          >
            <IconV2 name="magnifying-glass" />
            <input
              class={`
                min-w-0 flex-1 border-0 bg-transparent text-[13px] outline-0
                text-v2-text-text-base [font-weight:440] placeholder:text-v2-text-text-faint
              `}
              value={descr()}
              onInput={(e) => setDescr(e.currentTarget.value)}
              onKeyDown={(e) => e.key === "Enter" && addJob()}
              placeholder="Describe what to scrape (plain English) — e.g. leaked credential dumps mentioning acme.com"
            />
          </label>
          <ButtonV2 variant="neutral" size="normal" icon="plus" onClick={addJob} disabled={busy() || !descr().trim()}>
            Add job
          </ButtonV2>
        </div>

        <Show when={msg()}>
          <div class="shrink-0 px-6 pb-3 text-[12px] leading-4 text-v2-text-text-muted [font-weight:440]">{msg()}</div>
        </Show>

        {/* body: jobs | findings */}
        <div class="flex min-h-0 flex-1 border-t border-v2-border-border-muted">
          {/* job list */}
          <div class="w-[340px] shrink-0 border-r border-v2-border-border-muted">
            <ScrollView class="h-full">
              <Show
                when={jobs().length}
                fallback={
                  <div class="px-4 py-6 text-[13px] leading-4 text-v2-text-text-muted [font-weight:440]">
                    No scrape jobs yet.
                  </div>
                }
              >
                <div class="flex flex-col gap-px p-2">
                  <For each={jobs()}>
                    {(job) => {
                      const running = () => /run/i.test(String(job.status || ""))
                      return (
                        <div
                          class="group/job relative flex min-h-[52px] items-center rounded-[6px]"
                          classList={{ "bg-v2-overlay-simple-overlay-hover": selected() === job.id }}
                        >
                          <button
                            type="button"
                            class={`
                              flex min-h-[52px] w-full flex-1 flex-col justify-center gap-1 rounded-[6px] border-0
                              bg-transparent px-3 py-2 pr-3 text-left transition-[background-color] duration-[120ms]
                              ease-in-out hover:bg-v2-overlay-simple-overlay-hover focus-visible:outline-none
                            `}
                            onClick={() => loadFindings(job.id)}
                          >
                            <span class="overflow-hidden text-ellipsis text-[13px] leading-4 tracking-[-0.04px] text-v2-text-text-base [font-weight:530]">
                              {job.description || `Job #${job.id}`}
                            </span>
                            <div class="flex items-center gap-2 text-[12px] text-v2-text-text-muted [font-weight:440]">
                              <span class="flex items-center gap-1">
                                <Show when={running()}>
                                  <IconV2 name="status-active" class="size-2.5" />
                                </Show>
                                {running() ? "running" : job.status || "idle"}
                              </span>
                              <Show when={typeof job.matches === "number"}>
                                <span class="text-v2-text-text-faint">·</span>
                                <span>{job.matches} matches</span>
                              </Show>
                            </div>
                          </button>
                          <div
                            class={`
                              absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1 opacity-0
                              transition-opacity group-hover/job:opacity-100 focus-within:opacity-100
                            `}
                          >
                            <Show
                              when={running()}
                              fallback={
                                <ButtonV2 variant="ghost-muted" size="small" onClick={() => act("start", job.id)}>
                                  Start
                                </ButtonV2>
                              }
                            >
                              <ButtonV2 variant="ghost-muted" size="small" onClick={() => act("stop", job.id)}>
                                Stop
                              </ButtonV2>
                            </Show>
                            <IconButtonV2
                              variant="ghost-muted"
                              size="small"
                              icon={<IconV2 name="xmark-small" />}
                              aria-label="Delete job"
                              onClick={() => act("delete", job.id)}
                            />
                          </div>
                        </div>
                      )
                    }}
                  </For>
                </div>
              </Show>
            </ScrollView>
          </div>

          {/* findings */}
          <div class="min-w-0 flex-1">
            <ScrollView class="h-full">
              <Show
                when={selected() !== null}
                fallback={
                  <div class="px-6 py-6 text-[13px] leading-4 text-v2-text-text-muted [font-weight:440]">
                    Select a job to view its ranked findings.
                  </div>
                }
              >
                <Show
                  when={!loadingFindings()}
                  fallback={
                    <div class="px-6 py-6 text-[13px] text-v2-text-text-muted [font-weight:440]">Loading findings…</div>
                  }
                >
                  <Show
                    when={findings().length}
                    fallback={
                      <div class="px-6 py-6 text-[13px] leading-4 text-v2-text-text-muted [font-weight:440]">
                        No findings scored above the bar yet.
                      </div>
                    }
                  >
                    <div class="flex flex-col gap-px p-2">
                      <For each={findings()}>
                        {(f) => (
                          <div class="flex flex-col gap-1 rounded-[6px] px-4 py-3 hover:bg-v2-overlay-simple-overlay-hover">
                            <div class="flex items-baseline gap-2">
                              <Show when={typeof f.score === "number"}>
                                <span class="shrink-0 text-[12px] tabular-nums text-v2-text-text-base [font-weight:560]">
                                  {f.score}
                                </span>
                              </Show>
                              <span class="text-[13px] leading-4 tracking-[-0.04px] break-all text-v2-text-text-base [font-weight:530]">
                                {f.title || f.url || "(untitled)"}
                              </span>
                            </div>
                            <Show when={f.url && f.title}>
                              <span class="text-[12px] break-all text-v2-text-text-muted [font-weight:440]">{f.url}</span>
                            </Show>
                            <Show when={f.snippet}>
                              <span class="text-[12px] leading-4 text-v2-text-text-muted [font-weight:440]">{f.snippet}</span>
                            </Show>
                          </div>
                        )}
                      </For>
                    </div>
                  </Show>
                </Show>
              </Show>
            </ScrollView>
          </div>
        </div>
      </Show>
    </div>
  )
}
