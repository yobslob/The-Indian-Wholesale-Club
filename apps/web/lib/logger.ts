/**
 * Structured JSON logger: one JSON line per event. Errors are also stored in
 * admin_error_events (service role) and optionally sent to ADMIN_ALERT_WEBHOOK_URL.
 */
type LogLevel = 'info' | 'warn' | 'error';
export type LogContext = Record<string, unknown>;

async function persistError(event: string, context: LogContext): Promise<void> {
  try {
    const { serviceClient } = await import('@/lib/supabase/service');
    await serviceClient()
      .from('admin_error_events')
      .insert({ event, context: JSON.parse(JSON.stringify(context)) });
  } catch {
    // The console line above is still there when persistence is unavailable.
  }
  const alertUrl = process.env.ADMIN_ALERT_WEBHOOK_URL;
  if (!alertUrl) return;
  try {
    await fetch(alertUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ event, context, timestamp: new Date().toISOString() }),
    });
  } catch (alertError) {
    console.error(
      JSON.stringify({
        level: 'error',
        event: 'admin.alert_delivery_failed',
        error: String(alertError),
      }),
    );
  }
}

function emit(level: LogLevel, event: string, context: LogContext = {}): void {
  const line = JSON.stringify({ ts: new Date().toISOString(), level, event, ...context });
  if (level === 'error') {
    console.error(line);
    void persistError(event, context);
  } else if (level === 'warn') {
    console.warn(line);
  } else {
    console.log(line);
  }
}

export const logger = {
  info: (event: string, context?: LogContext): void => emit('info', event, context),
  warn: (event: string, context?: LogContext): void => emit('warn', event, context),
  error: (event: string, context?: LogContext): void => emit('error', event, context),
};

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
