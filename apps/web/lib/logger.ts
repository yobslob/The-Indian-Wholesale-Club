/**
 * Structured JSON logger (M7).
 *
 * Every entry is a single JSON line so log aggregators can parse
 * event names and context without regex.
 */

type LogLevel = 'info' | 'warn' | 'error';

export type LogContext = Record<string, unknown>;

function emit(level: LogLevel, event: string, context: LogContext = {}): void {
  const entry = {
    ts: new Date().toISOString(),
    level,
    event,
    ...context,
  };
  const line = JSON.stringify(entry);

  if (level === 'error') {
    console.error(line);
    void persistError(event, context);
  } else if (level === 'warn') {
    console.warn(line);
  } else {
    console.log(line);
  }

  async function persistError(event: string, context: LogContext): Promise<void> {
    try {
      const { supabaseAdmin } = await import('@/lib/supabase/admin');
      await supabaseAdmin.from('admin_error_events').insert({
        event,
        context: context as import('@repo/shared/types').Json,
      });
    } catch {
      // Preserve the original structured console event when persistence is unavailable.
    }
    const alertUrl = process.env.ADMIN_ALERT_WEBHOOK_URL;
    if (alertUrl) {
      try {
        await fetch(alertUrl, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ event, context, timestamp: new Date().toISOString() }),
        });
      } catch (alertError) {
        console.error(JSON.stringify({
          ts: new Date().toISOString(),
          level: 'error',
          event: 'admin.alert_delivery_failed',
          error: alertError instanceof Error ? alertError.message : String(alertError),
        }));
      }
    }
  }
}

export const logger = {
  info: (event: string, context?: LogContext): void => emit('info', event, context),
  warn: (event: string, context?: LogContext): void => emit('warn', event, context),
  error: (event: string, context?: LogContext): void => emit('error', event, context),
};
