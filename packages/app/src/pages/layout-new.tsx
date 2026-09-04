import { createEffect, createSignal, on, Show, Suspense, type JSX, type ParentProps } from "solid-js"
import { createStore } from "solid-js/store"
import { useLocation } from "@solidjs/router"
import ScraperPage from "@/pages/scraper"
import { DebugBar } from "@/components/debug-bar"
import { TabsInfoPopup } from "@/components/help-button"
import { Titlebar, type TitlebarUpdate } from "@/components/titlebar"
import { usePlatform } from "@/context/platform"
import { setV2Toast, ToastRegion } from "@/utils/toast"

export default function NewLayout(props: ParentProps) {
  const platform = usePlatform()
  const [state, setState] = createStore({ debugTools: true })
  const [section, setSection] = createSignal<"chat" | "scraper">("chat")
  const location = useLocation()
  // Any navigation (opening a chat tab, a new session) drops back to the Chat view.
  createEffect(on(() => location.pathname, () => setSection("chat"), { defer: true }))

  createEffect(() => setV2Toast(true))

  const update: TitlebarUpdate = {
    version: () => {
      const state = platform.updater?.state()
      if (state?.status !== "ready") return
      return state.version
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
        debugTools={
          import.meta.env.DEV
            ? { visible: state.debugTools, toggle: () => setState("debugTools", (value) => !value) }
            : undefined
        }
      />
      <div class="flex-1 min-h-0 min-w-0 flex">
        <ActivityRail section={section()} onSelect={setSection} />
        <main class="relative flex-1 min-h-0 min-w-0 overflow-x-hidden flex flex-col items-start contain-strict">
          <Suspense>{props.children}</Suspense>
          <Show when={section() === "scraper"}>
            <div class="absolute inset-0 z-20 bg-v2-background-bg-base">
              <ScraperPage />
            </div>
          </Show>
        </main>
      </div>
      {import.meta.env.DEV && state.debugTools && <DebugBar inline />}
      <TabsInfoPopup />
      <ToastRegion v2 />
    </div>
  )
}

function ActivityRail(props: { section: "chat" | "scraper"; onSelect: (s: "chat" | "scraper") => void }) {
  return (
    <div class="flex w-12 shrink-0 flex-col items-center gap-1 border-r border-v2-border-border-muted bg-v2-background-bg-base pt-2">
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
