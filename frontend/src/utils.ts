export function getThemeColor(name: string) {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
}
