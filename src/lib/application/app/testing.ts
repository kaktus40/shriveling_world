import type { AppCameraMode, AppProjectionMode } from './page';
import type { ComputeProfile } from '$lib/compute';

export interface AppE2eApi {
	readonly setDataset: (dataset: string) => Promise<void>;
	readonly setComputeProfile: (profile: ComputeProfile) => Promise<void>;
	readonly setYear: (year: number) => Promise<void>;
	readonly setProjection: (
		start: AppProjectionMode,
		end: AppProjectionMode,
		percent: number,
	) => Promise<void>;
	readonly setCameraMode: (mode: AppCameraMode) => Promise<void>;
}

interface AppE2eWindow extends Window {
	__appE2e?: AppE2eApi;
}

/** Installs the application e2e hook only in development so browser tests can drive stable state transitions. */
export function installAppE2eApi(api: AppE2eApi): () => void {
	if (!import.meta.env.DEV || typeof window === 'undefined') {
		return () => undefined;
	}

	const target = window as AppE2eWindow;
	target.__appE2e = api;

	return () => {
		if (target.__appE2e === api) {
			delete target.__appE2e;
		}
	};
}
