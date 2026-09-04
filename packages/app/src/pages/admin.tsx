import { createSignal, For, Show, onMount } from "solid-js"
import { createStore } from "solid-js/store"
import { ButtonV2 } from "@opencode-ai/ui/v2/button-v2"
import { IconButtonV2 } from "@opencode-ai/ui/v2/icon-button-v2"
import { Icon as IconV2 } from "@opencode-ai/ui/v2/icon"
import { ScrollView } from "@opencode-ai/ui/scroll-view"

type Perms = Record<string, boolean>
type Account = { id: number; username: string; perms: Perms; device_bound?: boolean; created?: number }
type AuthAPI = {
  adminList: () => Promise<{ ok?: boolean; error?: string; accounts?: Account[] }>
  adminCreate: (u: string, p: string, perms: Perms) => Promise<{ ok?: boolean; error?: string }>
  adminUpdate: (id: number, perms?: Perms, password?: string) => Promise<{ ok?: boolean; error?: string }>
  adminDelete: (id: number) => Promise<{ ok?: boolean; error?: string }>
  adminResetDevice: (id: number) => Promise<{ ok?: boolean; error?: string }>
}
const authApi = (): AuthAPI | undefined => (window as unknown as { api?: { auth?: AuthAPI } }).api?.auth

// chat is always granted; these are the toggleable capabilities.
const TOGGLE_PERMS: [string, string][] = [
  ["code_local", "Local coding"],
  ["kali", "Kali VM"],
  ["scraper", "Scraper"],
  ["settings", "Settings"],
  ["admin", "Admin"],
]

export default function AdminPage() {
  const [accounts, setAccounts] = createSignal<Account[]>([])
  const [msg, setMsg] = createSignal<string | null>(null)
  const [busy, setBusy] = createSignal(false)
  const [newUser, setNewUser] = createSignal("")
  const [newPass, setNewPass] = createSignal("")
  const [newPerms, setNewPerms] = createStore<Perms>({
    chat: true,
    code_local: true,
    kali: false,
    scraper: false,
    settings: false,
    admin: false,
  })

  async function refresh() {
    const a = authApi()
    if (!a) return
    setBusy(true)
    try {
      const r = await a.adminList()
      if (r && r.ok) setAccounts(r.accounts || [])
      else setMsg("Could not load accounts: " + ((r && r.error) || "unknown"))
    } catch (e: any) {
      setMsg("Could not reach the auth server: " + String(e?.message || e))
    } finally {
      setBusy(false)
    }
  }

  async function create() {
    const a = authApi()
    const u = newUser().trim()
    if (!a || !u || newPass().length < 4 || busy()) return
    setBusy(true)
    setMsg(null)
    try {
      const r = await a.adminCreate(u, newPass(), { ...newPerms })
      if (r && r.ok) {
        setNewUser("")
        setNewPass("")
        setMsg("Account created for " + u + ".")
        await refresh()
      } else setMsg("Not created: " + ((r && r.error) || "unknown"))
    } catch (e: any) {
      setMsg("Create failed: " + String(e?.message || e))
    } finally {
      setBusy(false)
    }
  }

  async function togglePerm(acc: Account, key: string) {
    const a = authApi()
    if (!a) return
    const next = { ...acc.perms, [key]: !acc.perms[key] }
    setAccounts((list) => list.map((x) => (x.id === acc.id ? { ...x, perms: next } : x)))
    await a.adminUpdate(acc.id, next)
  }

  async function resetDevice(acc: Account) {
    const a = authApi()
    if (!a) return
    await a.adminResetDevice(acc.id)
    setMsg(acc.username + " can now sign in on a new device.")
    await refresh()
  }

  async function remove(acc: Account) {
    const a = authApi()
    if (!a || !confirm(`Delete the account "${acc.username}"?`)) return
    await a.adminDelete(acc.id)
    await refresh()
  }

  onMount(refresh)

  return (
    <div class="flex h-full min-h-0 w-full flex-col bg-v2-background-bg-base">
      <div class="flex shrink-0 items-center gap-3 px-6 pt-6 pb-4">
        <h1 class="text-[15px] tracking-[-0.1px] text-v2-text-text-base [font-weight:560]">Admin</h1>
        <span class="text-[12px] text-v2-text-text-muted [font-weight:440]">friend accounts &amp; permissions</span>
        <div class="flex-1" />
        <ButtonV2 variant="ghost-muted" size="small" icon="outline-reset" onClick={refresh} disabled={busy()}>
          Refresh
        </ButtonV2>
      </div>

      {/* new account */}
      <div class="shrink-0 border-t border-v2-border-border-muted px-6 py-4">
        <div class="mb-3 text-[12px] text-v2-text-text-muted [font-weight:530]">New account</div>
        <div class="flex flex-wrap items-center gap-2">
          <input
            value={newUser()}
            onInput={(e) => setNewUser(e.currentTarget.value)}
            placeholder="username"
            class="h-9 w-40 rounded-[6px] border border-v2-border-border-muted bg-v2-background-bg-layer-02/60 px-3 text-[13px] text-v2-text-text-base [font-weight:440] outline-0 placeholder:text-v2-text-text-faint focus:border-v2-border-border-strong"
          />
          <input
            type="password"
            value={newPass()}
            onInput={(e) => setNewPass(e.currentTarget.value)}
            placeholder="password"
            class="h-9 w-40 rounded-[6px] border border-v2-border-border-muted bg-v2-background-bg-layer-02/60 px-3 text-[13px] text-v2-text-text-base [font-weight:440] outline-0 placeholder:text-v2-text-text-faint focus:border-v2-border-border-strong"
          />
          <div class="flex items-center gap-1">
            <For each={TOGGLE_PERMS}>
              {([key, label]) => (
                <PermPill on={!!newPerms[key]} label={label} onClick={() => setNewPerms(key, (v) => !v)} />
              )}
            </For>
          </div>
          <ButtonV2
            variant="neutral"
            size="normal"
            icon="plus"
            onClick={create}
            disabled={busy() || !newUser().trim() || newPass().length < 4}
          >
            Create
          </ButtonV2>
        </div>
        <div class="mt-2 text-[11px] text-v2-text-text-faint [font-weight:440]">
          Chat is always allowed. New accounts default to local coding on their own machine only — no Kali, scraper,
          settings, or admin.
        </div>
      </div>

      <Show when={msg()}>
        <div class="shrink-0 px-6 pb-2 text-[12px] text-v2-text-text-muted [font-weight:440]">{msg()}</div>
      </Show>

      {/* accounts */}
      <div class="min-h-0 flex-1 border-t border-v2-border-border-muted">
        <ScrollView class="h-full">
          <Show
            when={accounts().length}
            fallback={
              <div class="px-6 py-6 text-[13px] text-v2-text-text-muted [font-weight:440]">
                No accounts yet. Create one above, then share the username, password, and the login link with your
                friend.
              </div>
            }
          >
            <div class="flex flex-col gap-px p-2">
              <For each={accounts()}>
                {(acc) => (
                  <div class="group/acc relative flex items-center gap-3 rounded-[6px] px-4 py-3 hover:bg-v2-overlay-simple-overlay-hover">
                    <div class="flex min-w-0 flex-col gap-1.5">
                      <div class="flex items-center gap-2">
                        <span class="text-[13px] text-v2-text-text-base [font-weight:530]">{acc.username}</span>
                        <span
                          class="flex items-center gap-1 text-[11px] [font-weight:440]"
                          classList={{
                            "text-v2-text-text-muted": !!acc.device_bound,
                            "text-v2-text-text-faint": !acc.device_bound,
                          }}
                        >
                          <span class="size-1.5 rounded-full bg-current opacity-70" />
                          {acc.device_bound ? "device-locked" : "not yet signed in"}
                        </span>
                      </div>
                      <div class="flex flex-wrap items-center gap-1">
                        <For each={TOGGLE_PERMS}>
                          {([key, label]) => (
                            <PermPill on={!!acc.perms[key]} label={label} onClick={() => togglePerm(acc, key)} />
                          )}
                        </For>
                      </div>
                    </div>
                    <div class="flex-1" />
                    <div class="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover/acc:opacity-100 focus-within:opacity-100">
                      <Show when={acc.device_bound}>
                        <ButtonV2 variant="ghost-muted" size="small" onClick={() => resetDevice(acc)}>
                          Reset device
                        </ButtonV2>
                      </Show>
                      <IconButtonV2
                        variant="ghost-muted"
                        size="small"
                        icon={<IconV2 name="xmark-small" />}
                        aria-label="Delete account"
                        onClick={() => remove(acc)}
                      />
                    </div>
                  </div>
                )}
              </For>
            </div>
          </Show>
        </ScrollView>
      </div>
    </div>
  )
}

function PermPill(props: { on: boolean; label: string; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      class="rounded-[6px] px-2 py-1 text-[12px] [font-weight:530] transition-colors"
      classList={{
        "bg-v2-background-bg-layer-03 text-v2-text-text-base": props.on,
        "bg-transparent text-v2-text-text-faint hover:text-v2-text-text-muted": !props.on,
      }}
    >
      {props.label}
    </button>
  )
}
