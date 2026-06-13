import type { ComputeConeIntersectionStrategy, ComputeProfile } from '$lib/compute';

export interface WorkspaceE2eApi {
	readonly setDataset: (dataset: string) => Promise<void>;
	readonly setComputeProfile: (profile: ComputeProfile) => Promise<void>;
	readonly setConeIntersectionStrategy: (strategy: ComputeConeIntersectionStrategy) => Promise<void>;
	readonly reloadWorkspace: () => Promise<void>;
	readonly reloadCompute: () => Promise<void>;
}

interface WorkspaceE2eWindow extends Window {
	__workspaceE2e?: WorkspaceE2eApi;
}

/** Installs the workspace e2e hook only in development so browser tests can drive stable state transitions. */
export function installWorkspaceE2eApi(api: WorkspaceE2eApi): () => void {
	if (!import.meta.env.DEV || typeof window === 'undefined') {
		return () => undefined;
	}

	const target = window as WorkspaceE2eWindow;
	target.__workspaceE2e = api;

	return () => {
		if (target.__workspaceE2e === api) {
			delete target.__workspaceE2e;
		}
	};
}
