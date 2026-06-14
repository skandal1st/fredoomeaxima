export function money(cents: number, currency: string): string {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(cents / 100);
}

export function date(value?: string | Date | null): string {
  if (!value) return '—';
  const d = typeof value === 'string' ? new Date(value) : value;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function statusColor(status: string): string {
  switch (status) {
    case 'ACTIVE':
    case 'SUCCEEDED':
    case 'MANUAL':
      return 'bg-green-100 text-green-700';
    case 'PENDING':
    case 'MAINTENANCE':
      return 'bg-amber-100 text-amber-700';
    case 'EXPIRED':
    case 'FAILED':
    case 'UNREACHABLE':
    case 'BLOCKED':
    case 'DISABLED':
    case 'REVOKED':
    case 'CANCELLED':
      return 'bg-red-100 text-red-700';
    default:
      return 'bg-slate-100 text-slate-600';
  }
}
