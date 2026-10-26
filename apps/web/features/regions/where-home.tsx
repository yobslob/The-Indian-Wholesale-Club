'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

/** On this device only: the states opened and how often (never sent anywhere, D-161). */
const KEY = 'iwc-homes';

interface Home {
  slug: string;
  name: string;
  /** The state's greeting in Latin letters ("Vanakkam"), the approved text its page shows (D-019). */
  greeting: string | null;
  visits: number;
}

function read(): Record<string, Home> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, Home>;
  } catch {
    return {};
  }
}

/** On a state's page: counts the visit (one per page load). */
export function RememberHome({ slug, name, greeting }: { slug: string; name: string; greeting: string | null }): null {
  useEffect(() => {
    try {
      const homes = read();
      homes[slug] = { slug, name, greeting, visits: (homes[slug]?.visits ?? 0) + 1 };
      localStorage.setItem(KEY, JSON.stringify(homes));
    } catch {
      // storage blocked: nothing remembered
    }
  }, [slug, name, greeting]);
  return null;
}

/**
 * Where's home (the plan's idea 3, D-161): the state opened most, from its second visit on, greets the shopper on Home
 * above Pick your home: "Vanakkam! Tamil Nadu's shelf missed you." Nothing on a first visit, nothing without storage.
 */
export function WelcomeBack(): React.JSX.Element | null {
  const [home, setHome] = useState<Home | null>(null);
  useEffect(() => {
    const best = Object.values(read()).sort((a, b) => b.visits - a.visits)[0];
    if (best && best.visits >= 2) setHome(best);
  }, []);
  if (!home) return null;
  return (
    <p className="rise-in font-ui text-ink mt-3 text-[15px]">
      {home.greeting ? <span className="text-brand font-semibold">{home.greeting}! </span> : null}
      <Link href={`/states/${home.slug}`} className="underline underline-offset-[3px]">
        {home.name}&rsquo;s shelf missed you
      </Link>
      .
    </p>
  );
}
