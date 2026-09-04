import { createEffect, createSignal, on, onCleanup, onMount, Show, Suspense, type JSX, type ParentProps } from "solid-js"
import { createStore } from "solid-js/store"
import { useLocation } from "@solidjs/router"
import ScraperPage from "@/pages/scraper"
import AdminPage from "@/pages/admin"
import LoginPage from "@/pages/login"
import { DebugBar } from "@/components/debug-bar"
import { TabsInfoPopup } from "@/components/help-button"
import { Titlebar, type TitlebarUpdate } from "@/components/titlebar"
import { usePlatform } from "@/context/platform"
import { setV2Toast, ToastRegion } from "@/utils/toast"

type Section = "chat" | "scraper" | "admin"
type AuthInfo = {
  role: string | null
  isOwner: boolean
  configured: boolean
  username: string | null
  perms: Record<string, boolean> | null
  authUrl: string
}
// Fallback when there is no desktop auth bridge (e.g. web): behave as a full-access owner, no gate.
const FULL_OWNER: AuthInfo = {
  role: "owner",
  isOwner: true,
  configured: true,
  username: "owner",
  perms: { chat: true, code_local: true, kali: true, scraper: true, settings: true, admin: true },
  authUrl: "",
}

export default function NewLayout(props: ParentProps) {
  const platform = usePlatform()
  const [state, setState] = createStore({ debugTools: true })
  const [section, setSection] = createSignal<Section>("chat")
  const location = useLocation()

  const [auth, setAuth] = createSignal<AuthInfo | null>(null)
  const [authReady, setAuthReady] = createSignal(false)
  async function reloadAuth() {
    const a = (window as unknown as { api?: { auth?: { state: () => Promise<AuthInfo> } } }).api?.auth
    if (!a) {
      setAuth(FULL_OWNER)
      setAuthReady(true)
      return
    }
    try {
      setAuth(await a.state())
    } catch {
      setAuth(FULL_OWNER)
    }
    setAuthReady(true)
  }
  onMount(reloadAuth)

  const configured = () => !!auth()?.configured
  const isOwner = () => !!auth()?.isOwner
  const canScraper = () => isOwner() || !!auth()?.perms?.scraper
  const canAdmin = () => isOwner()

  // Any navigation (opening a chat tab, a new session) drops back to the Chat view.
  createEffect(on(() => location.pathname, () => setSection("chat"), { defer: true }))

  // Clicking anywhere outside the active section panel + rail (e.g. a chat tab) drops back to Chat.
  let overlayRef: HTMLDivElement | undefined
  onMount(() => {
    const onDown = (e: PointerEvent) => {
      if (section() === "chat") return
      const t = e.target as HTMLElement | null
      if (!t || (overlayRef && overlayRef.contains(t)) || t.closest("[data-activity-rail]")) return
      setSection("chat")
    }
    document.addEventListener("pointerdown", onDown, true)
    onCleanup(() => document.removeEventListener("pointerdown", onDown, true))
  })

  createEffect(() => setV2Toast(true))

  const update: TitlebarUpdate = {
    version: () => {
      const s = platform.updater?.state()
      if (s?.status !== "ready") return
      return s.version
    },
    installing: () => platform.updater?.state().status === "installing",
    install: () => void platform.updater?.install(),
  }

  return (
    <div
      class="relative bg-v2-background-bg-deep flex-1 min-h-0 min-w-0 flex flex-col select-none [&_input]:select-text [&_textarea]:select-text [&_[contenteditable]]:select-text"
      style={{
        "padding-top": "env(safe-area-inset-top, 0px)",
        "padding-bottom": "env(safe-area-inset-bottom, 0px)",
      }}
    >
      <Titlebar
        update={update}
        hideTabs={() => !configured() || section() !== "chat"}
        debugTools={
          import.meta.env.DEV
            ? { visible: state.debugTools, toggle: () => setState("debugTools", (value) => !value) }
            : undefined
        }
      />
      <Show when={authReady()} fallback={<div class="flex-1 bg-v2-background-bg-deep" />}>
        <Show
          when={configured()}
          fallback={
            <div class="flex min-h-0 min-w-0 flex-1">
              <LoginPage onDone={reloadAuth} />
            </div>
          }
        >
          <div class="flex-1 min-h-0 min-w-0 flex">
            <ActivityRail
              section={section()}
              onSelect={setSection}
              showScraper={canScraper()}
              showAdmin={canAdmin()}
            />
            <main class="relative flex-1 min-h-0 min-w-0 overflow-x-hidden flex flex-col items-start contain-strict">
              <Suspense>{props.children}</Suspense>
              <Show when={section() !== "chat"}>
                <div ref={overlayRef} class="absolute inset-0 z-20 bg-v2-background-bg-base">
                  <Show when={section() === "scraper"}>
                    <ScraperPage />
                  </Show>
                  <Show when={section() === "admin"}>
                    <AdminPage />
                  </Show>
                </div>
              </Show>
            </main>
          </div>
        </Show>
      </Show>
      {import.meta.env.DEV && state.debugTools && <DebugBar inline />}
      <TabsInfoPopup />
      <ToastRegion v2 />
    </div>
  )
}

function ActivityRail(props: {
  section: Section
  onSelect: (s: Section) => void
  showScraper: boolean
  showAdmin: boolean
}) {
  return (
    <div
      data-activity-rail
      class="flex w-12 shrink-0 flex-col items-center gap-1 border-r border-v2-border-border-muted bg-v2-background-bg-base pt-2"
    >
      <RailButton active={props.section === "chat"} onClick={() => props.onSelect("chat")} title="Chat">
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      </RailButton>
      <Show when={props.showScraper}>
        <RailButton active={props.section === "scraper"} onClick={() => props.onSelect("scraper")} title="Scraper">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.3-4.3" />
          </svg>
        </RailButton>
      </Show>
      <Show when={props.showAdmin}>
        <RailButton active={props.section === "admin"} onClick={() => props.onSelect("admin")} title="Admin">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z" />
          </svg>
        </RailButton>
      </Show>
    </div>
  )
}

function RailButton(props: { active: boolean; onClick: () => void; title: string; children: JSX.Element }) {
  return (
    <button
      onClick={props.onClick}
      title={props.title}
      aria-label={props.title}
      class="flex size-9 cursor-pointer items-center justify-center rounded-[6px] border-0 bg-transparent transition-colors duration-[120ms]"
      classList={{
        "bg-v2-overlay-simple-overlay-hover text-v2-icon-icon-base": props.active,
        "text-v2-icon-icon-muted hover:bg-v2-overlay-simple-overlay-hover hover:text-v2-icon-icon-base": !props.active,
      }}
    >
      {props.children}
    </button>
  )
}
