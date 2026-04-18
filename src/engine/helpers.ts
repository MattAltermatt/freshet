const MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

export function formatDate(input: unknown, fmt: string | undefined): string {
  if (input === undefined || input === null) return '';
  const d = new Date(String(input));
  if (isNaN(d.getTime())) return '';
  if (!fmt) {
    const month = MONTHS_SHORT[d.getMonth()]!;
    const day = d.getDate();
    const year = d.getFullYear();
    const hh24 = d.getHours();
    const hh12 = ((hh24 + 11) % 12) + 1;
    const mm = String(d.getMinutes()).padStart(2, '0');
    const ampm = hh24 < 12 ? 'AM' : 'PM';
    return `${month} ${day}, ${year} ${hh12}:${mm} ${ampm}`;
  }
  const pad2 = (n: number) => String(n).padStart(2, '0');
  return fmt
    .replace(/yyyy/g, String(d.getFullYear()))
    .replace(/MM/g, pad2(d.getMonth() + 1))
    .replace(/dd/g, pad2(d.getDate()))
    .replace(/HH/g, pad2(d.getHours()))
    .replace(/mm/g, pad2(d.getMinutes()))
    .replace(/ss/g, pad2(d.getSeconds()));
}
