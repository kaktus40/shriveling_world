import type { LayoutLoad } from './$types';
import { loadDatasetCatalog } from '$lib/application/workspace';

export const prerender = true;

/** Loads the shared dataset catalog for the migration shell. */
export const load: LayoutLoad = async ({ fetch }) => ({
	datasets: await loadDatasetCatalog(fetch),
});
