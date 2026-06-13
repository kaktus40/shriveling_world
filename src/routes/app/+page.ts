import type { PageLoad } from './$types';

/** Re-exposes the root layout data for the operational application shell. */
export const load: PageLoad = async ({ parent }) => parent();
