export function truncateUrlMiddle(url: string, max: number): string {
  if (url.length <= max) return url;
  if (max < 5) return url.slice(0, max);
  const keep = max - 1;
  const head = Math.ceil(keep / 2);
  const tail = keep - head;
  return `${url.slice(0, head)}…${url.slice(url.length - tail)}`;
}
