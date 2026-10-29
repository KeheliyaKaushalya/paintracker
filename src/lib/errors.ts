/** Turns whatever Supabase/network threw into a short message a nurse can act on. */
export interface ErrorLike {
  message?: string
  code?: string
  details?: string
}

export function isNetworkError(err: ErrorLike | null | undefined): boolean {
  if (!err) return false
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true
  // PostgREST errors always carry a code. No code => the request never got a proper answer.
  return !err.code && /fetch|network|load failed|timeout|aborted|offline|failed to/i.test(err.message ?? '')
}

export function friendlyMessage(err: ErrorLike | null | undefined): string {
  if (!err) return 'Something went wrong.'
  if (isNetworkError(err)) return "Can't reach the server. Check your connection."
  switch (err.code) {
    case '23505':
      return /bht/i.test(`${err.message} ${err.details}`)
        ? 'A patient with that BHT number already exists.'
        : 'That entry already exists.'
    case '23514':
      return 'One of the values is outside the allowed range. Check the numbers and try again.'
    case '23503':
      return 'This refers to something that no longer exists. Go back and reopen the patient.'
    case '42501':
      return "You don't have permission to do that."
    case 'PGRST301':
    case 'PGRST303':
      return 'Your session has expired. Please sign in again.'
    default:
      return err.message || 'Something went wrong.'
  }
}

/** Build a real Error (with a friendly message) from a Supabase error object. */
export function toError(err: ErrorLike): Error {
  const e = new Error(friendlyMessage(err)) as Error & { code?: string; network?: boolean }
  e.code = err.code
  e.network = isNetworkError(err)
  return e
}
