import { sendThrottledAlert } from './lib/alert';
import { requestErrorAlert } from './lib/request-error';

import type { Instrumentation } from 'next';

/**
 * Next calls this for every uncaught server error (pages, route handlers, server actions, middleware). Launch QA F-4:
 * the founder gets one alert per route per 10 minutes with the route pattern, method, digest and release, nothing
 * from the request itself (lib/request-error.ts). Vercel's logs keep the full error under the same digest.
 */
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  const alert = requestErrorAlert({
    error,
    method: request.method,
    routePath: context.routePath,
    routeType: context.routeType,
    release: process.env.VERCEL_GIT_COMMIT_SHA,
  });
  await sendThrottledAlert(alert.key, alert.title, alert.fields);
};
