import type { LayoutLoad } from './$types';
import { loadBundledDatasetNames } from '$lib/testing/datasets';

/** Loads the list of bundled datasets shared by every validation route. */
export const load: LayoutLoad = async ({ fetch }) => ({
	datasets: await loadBundledDatasetNames(fetch),
});
