import type { PageLoad } from './$types';

/** Re-exposes the root layout data for the home page. */
export const load: PageLoad = async ({ parent }) => parent();
