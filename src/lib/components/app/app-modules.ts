/** Canonical app modules exposed by the edge dock. */
export const APP_MODULE_KEYS = ['scene', 'query', 'measurement'] as const;

/** One module exposed by the application edge dock. */
export type AppModuleKey = (typeof APP_MODULE_KEYS)[number];

/** Stable metadata for one edge-dock module button. */
export interface AppModuleDescriptor {
	readonly key: AppModuleKey;
	readonly label: string;
	readonly title: string;
}

/** Canonical module metadata used by the app shell dock. */
export const APP_MODULES: readonly AppModuleDescriptor[] = [
	{ key: 'scene', label: 'Scene', title: 'Dataset, camera, and labels' },
	{ key: 'query', label: 'Query', title: 'Query builder and matching cities' },
	{ key: 'measurement', label: 'Measure', title: 'Angle and measurement tools' },
];
