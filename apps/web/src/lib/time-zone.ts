export function isSupportedTimeZone(value: string) {
  const timezone = value.trim();
  if (!timezone || timezone.length > 100) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(0);
    return true;
  } catch {
    return false;
  }
}
