export class SourceUnavailable extends Error {}
export class SourceHttpError extends Error {
  constructor(public status: number, public retryAfter: number | null = null) {
    super(`Source returned HTTP ${status}`)
  }
}
