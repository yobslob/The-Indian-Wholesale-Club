import 'server-only';

import { cache } from 'react';

import { getWaitingCounts } from '@repo/db/admin';

import type { IwcClient } from '@repo/db';

/** The sidebar's counts (D-096), read once per request: the layout and Today both use them. */
export const waitingCounts = cache((client: IwcClient) => getWaitingCounts(client));
