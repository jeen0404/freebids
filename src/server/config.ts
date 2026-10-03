export function appBaseUrl(): string {
  return (process.env.APP_URL || `http://localhost:${process.env.PORT || 3000}`).replace(/\/$/, '');
}
