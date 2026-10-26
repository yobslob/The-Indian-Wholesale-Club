'use client';

/** YYYYMMDD of a calendar day, and the day after (an all-day event ends the next day). */
const ics = (day: string): string => day.replaceAll('-', '');
const next = (day: string): string => new Date(Date.parse(`${day}T12:00:00Z`) + 86_400_000).toISOString().slice(0, 10);

/**
 * "Add to calendar" on the thank-you page (the homesick plan, D-161): an all-day event on the delivery date (or across
 * the window), "Home arrives (IWC order IWC-1234)", made in the browser as an .ics file the phone or computer opens in
 * its own calendar. Nothing is sent anywhere.
 */
export function CalendarLink({ number, from, to }: { number: string; from: string; to: string }): React.JSX.Element {
  const add = (): void => {
    const body = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//IWC//Order//EN',
      'BEGIN:VEVENT',
      `UID:${number}@iwc-order`,
      `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`,
      `DTSTART;VALUE=DATE:${ics(from)}`,
      `DTEND;VALUE=DATE:${ics(next(to))}`,
      `SUMMARY:Home arrives (IWC order ${number})`,
      'DESCRIPTION:Your parcel from India. Keep the scissors near.',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');
    const url = URL.createObjectURL(new Blob([body], { type: 'text/calendar' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `iwc-${number}.ics`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <button type="button" onClick={add} className="border-line text-ink font-ui press rounded-pill inline-flex min-h-12 items-center gap-2 border bg-paper px-5 text-[15px] font-medium">
      <svg viewBox="0 0 24 24" aria-hidden="true" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <rect x="4" y="5.5" width="16" height="14.5" rx="2.5" />
        <path d="M4 10h16M8.5 3.5v4M15.5 3.5v4M12 13v4M10 15h4" />
      </svg>
      Add to calendar
    </button>
  );
}
