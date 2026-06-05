// Lightweight "is there a newer version?" check. The app fetches a small JSON
// file hosted alongside the landing page; if its version is higher than the
// bundled APP_VERSION, the app shows an update banner linking to the download.
//
// This does NOT auto-install (that needs a signed build + electron-updater).
// It just tells existing users a new build exists so they re-download.
//
// To ship an update: bump APP_VERSION here AND package.json, rebuild, then
// edit landing/version.json to the new version + (optional) notes, and redeploy.

export const APP_VERSION = '2.1.0'

// Friendly version shown in the UI — drops a trailing ".0" so 2.0.0 reads "2.0".
export const DISPLAY_VERSION = APP_VERSION.replace(/\.0$/, '')

const VERSION_URL = 'https://flashbang-bco.pages.dev/version.json'
const DOWNLOAD_URL = 'https://github.com/noahkarantonis-sketch/Flashbang/releases/download/v2.1/Flashbang-Setup-2.1.0.exe'

export interface UpdateInfo {
  version: string
  url: string
  notes?: string
}

// Compare two dotted version strings. Returns true if `remote` > `current`.
function isNewer(remote: string, current: string): boolean {
  const a = remote.split('.').map((n) => parseInt(n, 10) || 0)
  const b = current.split('.').map((n) => parseInt(n, 10) || 0)
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] ?? 0
    const y = b[i] ?? 0
    if (x !== y) return x > y
  }
  return false
}

// Returns update info if a newer version is available, else null. Never throws
// (network failures just mean "no update to show").
export async function checkForUpdate(): Promise<UpdateInfo | null> {
  try {
    const res = await fetch(`${VERSION_URL}?t=${Date.now()}`, { cache: 'no-store' })
    if (!res.ok) return null
    const data = (await res.json()) as Partial<UpdateInfo>
    if (!data?.version || !isNewer(data.version, APP_VERSION)) return null
    return {
      version: data.version,
      url: data.url || DOWNLOAD_URL,
      notes: data.notes
    }
  } catch {
    return null
  }
}
