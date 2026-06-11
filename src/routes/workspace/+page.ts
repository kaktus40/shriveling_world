import type { PageLoad } from './$types';

/** Re-exposes the root layout dataset catalog to the workspace route. */
export const load: PageLoad = async ({ parent }) => parent();
