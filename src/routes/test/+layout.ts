import type { LayoutLoad } from './$types';
import { loadBundledDatasetNames } from '$lib/application/validation';

/** Loads the list of bundled datasets shared by every validation route. */
export const load: LayoutLoad = async ({ fetch }) => ({
	datasets: await loadBundledDatasetNames(fetch),
});
