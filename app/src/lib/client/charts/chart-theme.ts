export function readChartColor(
  token: 'chart-1' | 'chart-2' | 'chart-3',
): string {
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue(`--${token}`)
    .trim();
  return raw ? `hsl(${raw})` : 'hsl(248 100% 66%)';
}

export function withAlpha(hslColor: string, alpha: number): string {
  return hslColor.replace('hsl(', 'hsla(').replace(')', ` / ${alpha})`);
}
