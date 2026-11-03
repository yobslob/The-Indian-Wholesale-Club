import 'server-only';

import { recordPaymentDispute, recordStripeRefund } from '@repo/db/server';

import { sendAlert } from '@/lib/alert';
import { logger } from '@/lib/logger';

import type { StripeEventDeps } from './events';
import type { IwcClient } from '@repo/db';

/** The real side effects for events.ts: the service-role database, the founder's alert hook, the logs. */
export function stripeEventDeps(service: IwcClient, extra: Partial<StripeEventDeps> = {}): StripeEventDeps {
  return {
    recordRefund: (input) => recordStripeRefund(service, input),
    recordDispute: (input) => recordPaymentDispute(service, input),
    alert: (title, fields) => sendAlert(title, fields),
    warn: (event, context) => logger.warn(event, context),
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    now: () => Date.now(),
    ...extra,
  };
}
