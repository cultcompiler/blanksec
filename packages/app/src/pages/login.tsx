import { createSignal, Show } from "solid-js"
import { ButtonV2 } from "@opencode-ai/ui/v2/button-v2"

type AuthAPI = { login: (u: string, p: string) => Promise<{ ok?: boolean; error?: string }> }
const authApi = (): AuthAPI | undefined => (window as unknown as { api?: { auth?: AuthAPI } }).api?.auth

export default function LoginPage(props: { onDone: () => void }) {
  const [username, setUsername] = createSignal("")
  const [password, setPassword] = createSignal("")
  const [busy, setBusy] = createSignal(false)
  const [error, setError] = createSignal<string | null>(null)

  async function signIn() {
    const a = authApi()
    if (!a || busy() || !username().trim() || !password()) return
    setBusy(true)
    setError(null)
    try {
      const r = await a.login(username().trim(), password())
      if (r && r.ok) props.onDone()
      else setError((r && r.error) || "Sign in failed")
    } catch (e: any) {
      setError(String(e?.message || e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div class="flex h-full min-h-0 w-full items-center justify-center bg-v2-background-bg-deep">
      <div class="flex w-[320px] flex-col gap-5">
        <div class="mb-1 flex flex-col items-center gap-1.5">
          <div class="text-[22px] tracking-[2px] text-v2-text-text-base [font-weight:700] [font-family:ui-monospace,SFMono-Regular,monospace]">
            Blank
          </div>
          <div class="text-[13px] text-v2-text-text-muted [font-weight:440]">Sign in to continue</div>
        </div>
        <div class="flex flex-col gap-3">
          <Field label="Username" value={username()} onInput={setUsername} onEnter={signIn} placeholder="username" />
          <Field
            label="Password"
            value={password()}
            onInput={setPassword}
            password
            onEnter={signIn}
            placeholder="password"
          />
          <ButtonV2
            variant="neutral"
            size="normal"
            onClick={signIn}
            disabled={busy() || !username().trim() || !password()}
          >
            Sign in
          </ButtonV2>
        </div>
        <Show when={error()}>
          <div class="text-center text-[12px] text-[#e5534b] [font-weight:440]">{error()}</div>
        </Show>
      </div>
    </div>
  )
}

function Field(props: {
  label: string
  value: string
  onInput: (v: string) => void
  password?: boolean
  placeholder?: string
  onEnter?: () => void
}) {
  return (
    <label class="flex flex-col gap-1.5">
      <span class="text-[12px] text-v2-text-text-muted [font-weight:440]">{props.label}</span>
      <input
        type={props.password ? "password" : "text"}
        value={props.value}
        onInput={(e) => props.onInput(e.currentTarget.value)}
        onKeyDown={(e) => e.key === "Enter" && props.onEnter?.()}
        placeholder={props.placeholder}
        class={`
          h-9 rounded-[6px] border border-v2-border-border-muted bg-v2-background-bg-layer-02/60 px-3 text-[13px]
          text-v2-text-text-base [font-weight:440] outline-0 transition-colors placeholder:text-v2-text-text-faint
          focus:border-v2-border-border-strong
        `}
      />
    </label>
  )
}
