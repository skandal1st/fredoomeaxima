export function money(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat('ru-RU', { style: 'currency', currency }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency}`;
  }
}

export function date(value?: string | Date | null): string {
  if (!value) return '—';
  const d = typeof value === 'string' ? new Date(value) : value;
  return d.toLocaleDateString('ru-RU', { year: 'numeric', month: 'short', day: 'numeric' });
}

/** Russian labels for status codes coming from the API. */
const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Активно',
  EXPIRED: 'Истёк',
  CANCELLED: 'Отменён',
  PENDING: 'Ожидание',
  SUCCEEDED: 'Оплачено',
  MANUAL: 'Вручную',
  FAILED: 'Ошибка',
  BLOCKED: 'Заблокирован',
  DISABLED: 'Выключен',
  MAINTENANCE: 'Обслуживание',
  UNREACHABLE: 'Недоступен',
  REVOKED: 'Отозван',
  NONE: 'Не развёрнут',
  RUNNING: 'Установка…',
  SUCCESS: 'Развёрнут',
};

export function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

/** Maps a status to a badge variant class defined in globals.css. */
export function statusColor(status: string): string {
  switch (status) {
    case 'ACTIVE':
    case 'SUCCEEDED':
    case 'MANUAL':
    case 'SUCCESS':
      return 'badge-ok';
    case 'PENDING':
    case 'MAINTENANCE':
    case 'RUNNING':
      return 'badge-warn';
    case 'EXPIRED':
    case 'FAILED':
    case 'UNREACHABLE':
    case 'BLOCKED':
    case 'DISABLED':
    case 'REVOKED':
    case 'CANCELLED':
      return 'badge-bad';
    default:
      return 'badge-neutral';
  }
}
