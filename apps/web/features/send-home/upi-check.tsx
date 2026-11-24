import { checkUpi } from '@repo/shared/domain';

import { SEND_HOME_WORDS } from './words';

const W = SEND_HOME_WORDS.upiCheck;

/**
 * D-206, the UPI checker: says as it is typed whether this is a UPI ID or UPI number at all, and whether its handle is
 * one UPI apps use. An unknown handle is a warning to look again, not a refusal; whether the account exists needs a
 * payouts provider (Q-67). The sheet and the India desk show the same words.
 */
export function UpiCheck({ value, id, touched = true }: { value: string; id?: string; touched?: boolean }): React.JSX.Element {
  const check = checkUpi(value);
  const [tone, text] =
    check.kind === 'empty'
      ? (['muted', W.empty] as const)
      : check.kind === 'bad'
        ? ([touched ? 'bad' : 'muted', touched ? W.bad : W.empty] as const)
        : check.kind === 'mobile'
          ? (['good', W.mobile] as const)
          : check.kind === 'known'
            ? (['good', W.known(check.app)] as const)
            : (['warn', W.unknown(check.handle)] as const);
  const color = tone === 'good' ? 'text-positive' : tone === 'bad' ? 'text-danger' : tone === 'warn' ? 'text-caution' : 'text-ink-muted';
  return (
    <span id={id} role="status" className={`font-ui text-[12px] font-normal ${color}`}>
      {tone === 'good' ? '✓ ' : tone === 'bad' ? '✗ ' : tone === 'warn' ? '! ' : ''}
      {text}
    </span>
  );
}
