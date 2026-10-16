export function timeAgo(iso: string): string {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'şimdi';
  if (min < 60) return `${min} dk`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour} sa`;
  const day = Math.floor(hour / 24);
  if (day < 7) return `${day} g`;
  return new Date(iso).toLocaleDateString('tr-TR');
}

export function formatPrice(value: number): string {
  return `${Number(value).toLocaleString('tr-TR', { maximumFractionDigits: 2 })} ₺`;
}
