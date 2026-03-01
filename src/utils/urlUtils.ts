/**
 * Ensures a URL string has an absolute protocol prefix.
 * If the URL already starts with http://, https://, or // it is returned as-is.
 * Otherwise, https:// is prepended.
 * Null, undefined, and empty strings are returned as empty string.
 */
export function ensureAbsoluteUrl (url: string): string {
  if (!url) return ''
  if (/^(https?:)?\/\//i.test(url)) return url
  return `https://${url}`
}
