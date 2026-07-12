export function joinUrl(code: string): string {
  return `${window.location.origin}${window.location.pathname}#/join/${code}`
}
