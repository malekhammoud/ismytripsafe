/**
 * River's stoplight: the whole report distilled into three colours.
 *
 * Lives here rather than on the page that first used it because it now appears
 * in two places — the homepage, where it is the one piece of explanation above
 * the fold, and /how-it-works, where it sits inside the longer answer. One
 * wording, one set of colours, changed in one file.
 */
export interface Light {
  label: string
  /** A gradient, not a flat colour — a flat traffic-light green on cream reads
   *  like a validation state rather than a lamp. Used where the whole card is
   *  the colour. */
  color: string
  /** The same signal as a single line of ink, for the stacked form on a
   *  document page where a filled block would shout. */
  ink: string
  /** A whisper of it behind the text, so the row reads as one object. */
  wash: string
  body: string
}

export const LIGHTS: Light[] = [
  {
    label: "Green light",
    color: "linear-gradient(150deg, #34a878, #1f7b55)",
    ink: "#1f7b55",
    wash: "rgba(52, 168, 120, 0.07)",
    body: "Little cause for concern — keep cruising. Normal travel sense is enough.",
  },
  {
    label: "Yellow light",
    color: "linear-gradient(150deg, #e0ad3d, #c3862a)",
    ink: "#a97517",
    wash: "rgba(224, 173, 61, 0.1)",
    body: "Caution and a bit of extra research. Not a showstopper at all — a helpful alert so you arrive better prepared.",
  },
  {
    label: "Red light",
    color: "linear-gradient(150deg, #e0654a, #bd3c26)",
    ink: "#bd3c26",
    wash: "rgba(224, 101, 74, 0.09)",
    body: "A genuine risk. Something to pause on and evaluate properly before you make a final decision.",
  },
]
