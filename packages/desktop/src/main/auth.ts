// Blank — friend-group auth bridge (talks to the Kali-hosted blank-authd over the Cloudflare tunnel).
//
// Roles:
//   owner  — the operator's own install. Holds the admin token, has every permission, never gated.
//   member — a friend's install. Logs in with username/password; the account is device-locked server-side
//            (bound to the first device that logs in). Permissions come from the server.
//
// State (userData/blank-auth.json): deviceId, role, authUrl, adminToken (owner only), session (member).
import fs from "node:fs"
import path from "node:path"
import crypto from "node:crypto"
import { app, ipcMain } from "electron"

const DEFAULT_AUTH_URL = process.env.BLANK_AUTH_URL || "https://carl-blonde-authors-wallet.trycloudflare.com"

type Perms = Record<string, boolean>
type Session = { username: string; token: string; perms: Perms } | null
type AuthState = {
  deviceId?: string
  role?: "owner" | "member"
  authUrl?: string
  adminToken?: string
  session?: Session
}

const OWNER_PERMS: Perms = { chat: true, code_local: true, kali: true, scraper: true, settings: true, admin: true }

function stateFile() {
  return path.join(app.getPath("userData"), "blank-auth.json")
}
function load(): AuthState {
  try {
    return JSON.parse(fs.readFileSync(stateFile(), "utf8"))
  } catch {
    return {}
  }
}
function save(s: AuthState) {
  try {
    fs.mkdirSync(path.dirname(stateFile()), { recursive: true })
    fs.writeFileSync(stateFile(), JSON.stringify(s, null, 2))
  } catch {}
}
function authUrl(s: AuthState) {
  return (s.authUrl || DEFAULT_AUTH_URL).replace(/\/+$/, "")
}
function deviceId(): string {
  const s = load()
  if (s.deviceId) return s.deviceId
  s.deviceId = crypto.randomBytes(16).toString("hex")
  save(s)
  return s.deviceId
}

async function post(pathname: string, body: object): Promise<any> {
  const s = load()
  try {
    const r = await fetch(authUrl(s) + pathname, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(25000),
    })
    return await r.json()
  } catch (e: any) {
    return { ok: false, error: "auth server unreachable: " + String(e?.message || e) }
  }
}

export const auth = {
  state() {
    const s = load()
    const isOwner = s.role === "owner"
    return {
      role: s.role || null,
      isOwner,
      // Whether this install is provisioned at all. If not, the renderer shows the login page.
      configured: s.role === "owner" || !!s.session,
      username: isOwner ? "owner" : s.session?.username || null,
      perms: isOwner ? OWNER_PERMS : s.session?.perms || null,
      authUrl: authUrl(s),
    }
  },
  async login(username: string, password: string) {
    const r = await post("/login", { username: String(username || "").trim(), password, device: deviceId() })
    if (r && r.ok && r.token) {
      const s = load()
      s.role = "member"
      s.session = { username: String(username).trim(), token: r.token, perms: r.perms || {} }
      save(s)
    }
    return r
  },
  async setupOwner(adminToken: string) {
    const r = await post("/admin/list", { admin_token: String(adminToken || "").trim() })
    if (r && r.ok) {
      const s = load()
      s.role = "owner"
      s.adminToken = String(adminToken).trim()
      s.session = null
      save(s)
      return { ok: true }
    }
    return { ok: false, error: (r && r.error) || "invalid admin token" }
  },
  logout() {
    const s = load()
    s.session = null
    if (s.role === "member") s.role = undefined
    save(s)
    return { ok: true }
  },
  setAuthUrl(url: string) {
    const s = load()
    s.authUrl = String(url || "").trim() || undefined
    save(s)
    return { ok: true }
  },
  admin: {
    async op(pathname: string, body: object) {
      const s = load()
      if (s.role !== "owner" || !s.adminToken) return { ok: false, error: "not an owner" }
      return post(pathname, { ...body, admin_token: s.adminToken })
    },
    list() {
      return auth.admin.op("/admin/list", {})
    },
    create(username: string, password: string, perms: Perms) {
      return auth.admin.op("/admin/create", { username, password, perms })
    },
    update(id: number, perms?: Perms, password?: string) {
      return auth.admin.op("/admin/update", { id, perms, password })
    },
    remove(id: number) {
      return auth.admin.op("/admin/delete", { id })
    },
    resetDevice(id: number) {
      return auth.admin.op("/admin/reset_device", { id })
    },
  },
}

export function registerAuthIpc() {
  ipcMain.handle("auth:state", () => auth.state())
  ipcMain.handle("auth:login", (_e, u: string, p: string) => auth.login(u, p))
  ipcMain.handle("auth:setupOwner", (_e, t: string) => auth.setupOwner(t))
  ipcMain.handle("auth:logout", () => auth.logout())
  ipcMain.handle("auth:setAuthUrl", (_e, url: string) => auth.setAuthUrl(url))
  ipcMain.handle("auth:adminList", () => auth.admin.list())
  ipcMain.handle("auth:adminCreate", (_e, u: string, p: string, perms: Perms) => auth.admin.create(u, p, perms))
  ipcMain.handle("auth:adminUpdate", (_e, id: number, perms?: Perms, password?: string) =>
    auth.admin.update(id, perms, password),
  )
  ipcMain.handle("auth:adminDelete", (_e, id: number) => auth.admin.remove(id))
  ipcMain.handle("auth:adminResetDevice", (_e, id: number) => auth.admin.resetDevice(id))
}
