import { Globe, Siren, HeartPulse, Landmark, MessagesSquare, type LucideIcon } from "lucide-react"
import type { CategoryKey } from "@/lib/safety-display"

/**
 * One icon per category, shared by the report pyramid and the home page.
 *
 * The components are stored rather than rendered elements so each caller can
 * set its own size — the pyramid wants 12px, the header band wants 20. The
 * reason this is a module and not two lists is that the header is the first
 * promise the site makes and the report is where it's kept; if a siren meant
 * "crime" in one place and a shield meant it in the other, the visitor would
 * have to learn the vocabulary twice.
 */
export const CATEGORY_ICON: Record<CategoryKey, LucideIcon> = {
  crime: Siren,
  sentiment: MessagesSquare,
  advisories: Globe,
  stability: Landmark,
  health: HeartPulse,
}
