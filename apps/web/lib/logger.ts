/**
 * Structured JSON logger: one JSON line per event. Errors are also stored in admin_error_events (service role) and
 * sent to the founder through lib/alert.ts (ADMIN_ALERT_WEBHOOK_URL): at most one alert per event name per
 * 10 minutes, with emails and phone numbers hidden and a 5 s limit (launch QA F-3).
 */
import { sendThrottledAlert } from './alert';

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
  await sendThrottledAlert(`log:${event}`, event, context);
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
