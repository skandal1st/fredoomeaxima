/** Maps API/auth error messages to Russian user-facing text. */
export function translateAuthError(msg: string): string {
  if (/invalid credentials/i.test(msg)) return 'Неверный email или пароль';
  if (/already registered/i.test(msg)) return 'Этот email уже зарегистрирован';
  if (/blocked/i.test(msg)) return 'Аккаунт заблокирован';
  if (/Validation/i.test(msg)) return 'Проверьте правильность введённых данных';
  return msg;
}
