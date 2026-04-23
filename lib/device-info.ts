export interface DeviceInfo {
  device_id: string
  device_name: string
  device_type: string
  browser_info: string
  ip_address?: string
  isMobile: boolean
  isTablet: boolean
  isDesktop: boolean
  isLaptop?: boolean
}

/**
 * Get or create a persistent UUID stored in localStorage.
 * This ensures the same physical device always gets the same ID
 * even if browser fingerprint changes (e.g. after browser update).
 * Two people with identical phones will have DIFFERENT IDs because
 * localStorage is sandboxed per-browser installation.
 */
function getPersistentDeviceUUID(): string {
  const STORAGE_KEY = "qcc_device_uuid"
  try {
    let uuid = localStorage.getItem(STORAGE_KEY)
    if (!uuid) {
      // Generate a cryptographically random UUID
      uuid = crypto.randomUUID
        ? crypto.randomUUID()
        : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
            const r = (Math.random() * 16) | 0
            return (c === "x" ? r : (r & 0x3) | 0x8).toString(16)
          })
      localStorage.setItem(STORAGE_KEY, uuid)
    }
    return uuid
  } catch {
    // localStorage blocked (private mode, etc.) — fall back to session-scoped random
    return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)
  }
}

/**
 * Get WebGL renderer string — unique per GPU model / driver.
 * Two same-model phones with different GPUs will produce different values.
 */
function getWebGLFingerprint(): string {
  try {
    const canvas = document.createElement("canvas")
    const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl") as WebGLRenderingContext | null
    if (!gl) return "no-webgl"
    const ext = gl.getExtension("WEBGL_debug_renderer_info")
    if (ext) {
      const renderer = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || ""
      const vendor = gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) || ""
      return `${vendor}|${renderer}`
    }
    return gl.getParameter(gl.RENDERER) || "unknown"
  } catch {
    return "webgl-error"
  }
}

/**
 * Simple deterministic hash (DJB2-style) for a string.
 */
function hashString(str: string): number {
  let hash = 5381
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i)
    hash = hash & hash // 32-bit
  }
  return Math.abs(hash)
}

/**
 * Generate a robust device ID.
 *
 * Strategy:
 *  1. Persistent UUID from localStorage  — unique per browser install (primary key)
 *  2. Hardware fingerprint (WebGL, CPU, screen, touch) — extra entropy
 *  3. Canvas paint hash — catches same-device, different-user-profile scenarios
 *
 * This means:
 *  - Abban in Eastern and Arthur in Central will ALWAYS have different IDs
 *    because their localStorage UUIDs are different.
 *  - Even two staff using the exact same phone model get different IDs.
 */
export function generateDeviceId(): string {
  if (typeof document === "undefined" || typeof window === "undefined") {
    throw new Error("generateDeviceId must be called on the client side.")
  }

  // 1. Persistent UUID (most important — unique per browser install)
  const persistentId = getPersistentDeviceUUID()

  // 2. Hardware fingerprint
  const webgl = getWebGLFingerprint()

  const canvas = document.createElement("canvas")
  const ctx = canvas.getContext("2d")
  if (ctx) {
    ctx.textBaseline = "top"
    ctx.font = "14px Arial"
    ctx.fillStyle = "#f60"
    ctx.fillRect(125, 1, 62, 20)
    ctx.fillStyle = "#069"
    ctx.fillText("QCC Device Fingerprint 2026", 2, 15)
    ctx.fillStyle = "rgba(102, 204, 0, 0.7)"
    ctx.fillText("QCC Device Fingerprint 2026", 4, 17)
  }

  const hardwareFingerprint = [
    navigator.userAgent,
    navigator.language,
    screen.width + "x" + screen.height + "x" + screen.colorDepth,
    navigator.hardwareConcurrency || 0,
    (navigator as any).deviceMemory || 0,
    navigator.maxTouchPoints || 0,
    navigator.platform || "",
    webgl,
    canvas.toDataURL(),
  ].join("||")

  const hardwareHash = hashString(hardwareFingerprint)
    .toString(16)
    .padStart(8, "0")
    .toUpperCase()

  // 3. Combine: UUID prefix + hardware hash suffix
  //    Format: QCC-{first8ofUUID}-{hardwareHash}
  const uuidShort = persistentId.replace(/-/g, "").slice(0, 12).toUpperCase()
  return `QCC-${uuidShort}-${hardwareHash}`
}

export function getDeviceInfo(): DeviceInfo {
  if (typeof window === "undefined") {
    throw new Error("getDeviceInfo must be called on the client side.")
  }

  const device_id = generateDeviceId()

  function getFriendlyDeviceName(): string {
    try {
      const uaData = (navigator as any).userAgentData
      if (uaData && uaData.platform) {
        const brand =
          Array.isArray(uaData.brands) && uaData.brands.length > 0
            ? uaData.brands[0].brand
            : "Browser"
        return `${brand} on ${uaData.platform}`
      }

      const ua = navigator.userAgent || ""
      let browser = "Browser"
      if (/firefox/i.test(ua)) browser = "Firefox"
      else if (/edg\//i.test(ua)) browser = "Edge"
      else if (/chrome\//i.test(ua) && !/edg\//i.test(ua)) browser = "Chrome"
      else if (/safari/i.test(ua) && !/chrome/i.test(ua)) browser = "Safari"
      else if (/opr\//i.test(ua) || /opera/i.test(ua)) browser = "Opera"

      const ua_lower = ua.toLowerCase()
      let platform = navigator.platform || ""
      if (!platform) {
        if (ua_lower.includes("windows")) platform = "Windows"
        else if (ua_lower.includes("mac os") || ua_lower.includes("macintosh")) platform = "macOS"
        else if (ua_lower.includes("android")) platform = "Android"
        else if (ua_lower.includes("iphone") || ua_lower.includes("ipad")) platform = "iOS"
        else if (ua_lower.includes("linux")) platform = "Linux"
        else platform = "Device"
      }

      return `${browser} on ${platform}`
    } catch {
      return navigator.userAgent.slice(0, 80)
    }
  }

  const deviceName = getFriendlyDeviceName()
  const ua = navigator.userAgent
  const isMobile = /Mobi|Android/i.test(ua)
  const isTablet = /Tablet|iPad/i.test(ua)
  const isDesktop = !isMobile && !isTablet
  const isLaptop = isDesktop

  return {
    device_id,
    device_name: deviceName,
    device_type: isMobile ? "mobile" : isTablet ? "tablet" : isLaptop ? "laptop" : "desktop",
    browser_info: navigator.userAgent,
    isMobile,
    isTablet,
    isDesktop,
    isLaptop,
  }
}
