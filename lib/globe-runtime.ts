// Runtime decisions for the two WebGL globes.
//
// The globe is the most expensive thing on the site: a 110m/50m TopoJSON
// parse, a three.js bundle, and a continuous render loop. On a machine with a
// real GPU that is a pleasant one-second flourish. On a machine without one
// (a VM, a remote desktop, an old laptop with software rasterisation) the same
// loop can occupy the main thread for a minute, and every link on the page
// goes dead while it does.
//
// So the globe is not mounted until we know it is welcome:
//
//   · Save-Data or fewer than four cores → poster, with an explicit button.
//   · A software WebGL renderer (SwiftShader / llvmpipe) → poster, same.
//   · Otherwise → mount after the page has painted and the browser is idle.
//
// The poster is a real orthographic render of the same geometry, so the
// hand-off is invisible. Nothing here runs on the server.

interface NetworkInformation {
  saveData?: boolean
  effectiveType?: string
}

interface NavigatorWithConnection extends Navigator {
  connection?: NetworkInformation
}

/**
 * Is this device likely to render a WebGL globe without seizing up?
 *
 * The renderer string is the only reliable signal available in a browser —
 * `hardwareConcurrency` says nothing about the GPU, and a 16-core server VM
 * with llvmpipe will happily report 16.
 */
export function canAutoStartGlobe(): boolean {
  if (typeof window === "undefined") return false

  const nav = navigator as NavigatorWithConnection
  if (nav.connection?.saveData) return false
  if ((navigator.hardwareConcurrency ?? 8) < 4) return false

  try {
    const canvas = document.createElement("canvas")
    const gl =
      (canvas.getContext("webgl2") as WebGL2RenderingContext | null) ??
      (canvas.getContext("webgl") as WebGLRenderingContext | null)
    if (!gl) return false
    const debug = gl.getExtension("WEBGL_debug_renderer_info")
    const renderer = debug
      ? String(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) ?? "")
      : ""
    // Release the probe context immediately; browsers cap how many can exist.
    gl.getExtension("WEBGL_lose_context")?.loseContext()
    if (/swiftshader|llvmpipe|softpipe|software|basic render|microsoft basic/i.test(renderer)) {
      return false
    }
    return true
  } catch {
    return false
  }
}

/** Run after paint and idle, never during the first screen. */
export function whenIdle(fn: () => void, timeout = 1200): void {
  if (typeof window === "undefined") return
  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(fn, { timeout })
  } else {
    setTimeout(fn, Math.min(timeout, 800))
  }
}

/** Honour the OS setting: no auto-spin for people who asked for less motion. */
export function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true
  )
}

/**
 * Keep the drawing buffer near CSS pixels. A 2× retina canvas is four times
 * the fragments for a difference nobody can see on a soft-lit sphere.
 */
export const MAX_GLOBE_PIXEL_RATIO = 1.5
