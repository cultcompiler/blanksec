// Blank — dark-web scraper controller (Kali SSH bridge).
//
// The scraping ENGINE lives on the Kali box (/opt/kultsec-scraper/scraper.py, a 24/7 systemd service that
// crawls Tor and scores findings even when this app is closed). This module is only the CONTROLLER: it runs
// the daemon's CLI over SSH and returns its single-line JSON. Uses the system `ssh` client (built into
// Windows 10+/macOS/Linux) so there is no native SSH dependency to bundle.
//
// Config is env-overridable but defaults to the same Kali box the rest of the operator's tooling uses.
import { execFile } from "node:child_process"
import os from "node:os"
import path from "node:path"
import { ipcMain } from "electron"

const KALI = {
  host: process.env.KALI_HOST || "2.25.136.192",
  user: process.env.KALI_USER || "root",
  port: Number(process.env.KALI_PORT || 22),
  key: process.env.KALI_KEY || path.join(os.homedir(), ".ssh", "vast_rig"),
}
const SCRAPER = "python3 /opt/kultsec-scraper/scraper.py"
const shq = (s: unknown) => "'" + String(s ?? "").replace(/'/g, "'\\''") + "'"

function kaliExec(remoteCmd: string, timeout = 250_000): Promise<{ out: string; err: string }> {
  return new Promise((resolve, reject) => {
    const args = [
      "-i",
      KALI.key,
      "-p",
      String(KALI.port),
      "-o",
      "StrictHostKeyChecking=accept-new",
      "-o",
      "ConnectTimeout=20",
      "-o",
      "BatchMode=yes",
      `${KALI.user}@${KALI.host}`,
      remoteCmd,
    ]
    execFile("ssh", args, { timeout, maxBuffer: 16 * 1024 * 1024, windowsHide: true }, (error, stdout, stderr) => {
      // A killed process means our timeout fired.
      if (error && (error as NodeJS.ErrnoException & { killed?: boolean }).killed) {
        return reject(new Error("Kali command timed out"))
      }
      // ssh exits non-zero when the remote command does; the daemon still prints its JSON, so resolve anyway.
      resolve({ out: stdout?.toString() || "", err: stderr?.toString() || "" })
    })
  })
}

// The daemon's CLI prints a single JSON line; parse the last non-empty line.
async function cli(argstr: string, timeout?: number): Promise<any> {
  const { out, err } = await kaliExec(`${SCRAPER} ${argstr}`, timeout)
  const line =
    String(out || "")
      .trim()
      .split("\n")
      .filter(Boolean)
      .pop() || ""
  try {
    return JSON.parse(line)
  } catch {
    return { ok: false, error: (err || out || "no output from the Kali daemon").toString().slice(-400) }
  }
}

export const scraper = {
  plan: (descr: string) => cli(`plan ${shq(descr)}`, 250_000),
  addJob: (descr: string, planObj?: unknown) =>
    cli(`addjob ${shq(descr)}${planObj ? ` --plan ${shq(JSON.stringify(planObj))}` : ""}`, 250_000),
  listJobs: async () => {
    const r = await cli("listjobs")
    return (r && r.jobs) || []
  },
  results: async (jobId: number, limit?: number) => {
    const r = await cli(`results ${Number(jobId)} --limit ${Number(limit) || 100}`)
    return (r && r.results) || []
  },
  startJob: (id: number) => cli(`start ${Number(id)}`),
  stopJob: (id: number) => cli(`stop ${Number(id)}`),
  deleteJob: (id: number) => cli(`delete ${Number(id)}`),
  rename: (id: number, name: string) => cli(`rename ${Number(id)} ${shq(name)}`),
  status: async () => {
    try {
      return await cli("status")
    } catch (e: any) {
      return { ok: false, error: String(e?.message || e) }
    }
  },
}

export function registerScraperIpc() {
  ipcMain.handle("scraper:plan", (_e, descr: string) => scraper.plan(descr))
  ipcMain.handle("scraper:addJob", (_e, descr: string, planObj?: unknown) => scraper.addJob(descr, planObj))
  ipcMain.handle("scraper:listJobs", () => scraper.listJobs())
  ipcMain.handle("scraper:results", (_e, id: number, limit?: number) => scraper.results(id, limit))
  ipcMain.handle("scraper:start", (_e, id: number) => scraper.startJob(id))
  ipcMain.handle("scraper:stop", (_e, id: number) => scraper.stopJob(id))
  ipcMain.handle("scraper:delete", (_e, id: number) => scraper.deleteJob(id))
  ipcMain.handle("scraper:rename", (_e, id: number, name: string) => scraper.rename(id, name))
  ipcMain.handle("scraper:status", () => scraper.status())
}
