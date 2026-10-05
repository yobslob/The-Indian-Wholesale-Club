/** D-047: a pricing setting that still holds Claude's researched estimate, with its source and date. */
export interface PricingEstimate {
  setting: string;
  source: string;
  source_url: string | null;
  checked_on: string;
}

export function EstimateNote({
  estimates,
  setting,
}: {
  estimates: PricingEstimate[];
  setting: string;
}): React.JSX.Element | null {
  const e = estimates.find((x) => x.setting === setting);
  if (!e) return null;
  return (
    <p className="text-caution text-xs leading-snug">
      Estimate, checked {e.checked_on}: {e.source}{' '}
      {e.source_url ? (
        <a href={e.source_url} target="_blank" rel="noreferrer" className="underline">
          source
        </a>
      ) : null}
    </p>
  );
}
