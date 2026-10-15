// The secret a cron caller presented. Two shapes are accepted so either
// scheduler works without a proxy in front:
//   - `x-cron-secret: <secret>`         — external cron (cron-job.org, crontab + curl)
//   - `Authorization: Bearer <secret>`  — Vercel Cron, which sends the
//                                         project's CRON_SECRET this way
// Callers compare the result with AUTOMATION_CRON_SECRET in constant time.
export function suppliedCronSecret(request: Request): string {
  const header = request.headers.get('x-cron-secret');
  if (header) return header;
  const auth = request.headers.get('authorization') ?? '';
  return auth.startsWith('Bearer ') ? auth.slice('Bearer '.length).trim() : '';
}
