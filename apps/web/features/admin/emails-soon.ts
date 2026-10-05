import 'server-only';

import { after } from 'next/server';

import { sendDueEmails } from '@/lib/email/send';
import { serviceClient } from '@/lib/supabase/service';

/**
 * After an admin action that the customer hears about (a visible order event queues its email in the database), send
 * the due emails once the response has gone out. The every-minute outbox job is the safety net (migration 17).
 */
export function sendEmailsSoon(): void {
  after(() => sendDueEmails(serviceClient()));
}
