import {
	createDefaultQueryTree,
	insertQueryNodeAtPath,
	moveQueryNodeAtPath,
	removeQueryNodeAtPath,
	updateQueryNodeAtPath,
	type QueryDatasetSnapshot,
	type QueryExecutionResult,
	type QueryWorkerClient,
} from './index';
import type { QueryNode } from '$lib/domain/query';

export interface QueryControllerBindings {
	getQueryWorker(): QueryWorkerClient | null;
	getQuerySnapshot(): QueryDatasetSnapshot | null;
	getQueryTree(): QueryNode | null;
	setQueryTree(next: QueryNode | null): void;
	setQueryResult(next: QueryExecutionResult | null): void;
	setQueryError(next: string): void;
}

export interface QueryController {
	run(): Promise<void>;
	scheduleRun(): void;
	reset(): void;
	update(path: number[], nextNode: QueryNode): void;
	remove(path: number[]): void;
	insert(path: number[], child: QueryNode): void;
	move(path: number[], direction: -1 | 1): void;
	dispose(): void;
}

export function createQueryController(bindings: QueryControllerBindings): QueryController {
	let queryRunTimer: ReturnType<typeof setTimeout> | null = null;

	async function run(): Promise<void> {
		const queryWorker = bindings.getQueryWorker();
		const querySnapshot = bindings.getQuerySnapshot();
		const queryTree = bindings.getQueryTree();
		if (!querySnapshot || !queryTree || !queryWorker) {
			return;
		}

		bindings.setQueryError('');
		try {
			bindings.setQueryResult(
				await queryWorker.execute({
					dataset: querySnapshot,
					query: queryTree,
				}),
			);
		} catch (error) {
			bindings.setQueryResult(null);
			bindings.setQueryError(error instanceof Error ? error.message : String(error));
		}
	}

	function scheduleRun(): void {
		const queryWorker = bindings.getQueryWorker();
		const querySnapshot = bindings.getQuerySnapshot();
		const queryTree = bindings.getQueryTree();
		if (!querySnapshot || !queryTree || !queryWorker) {
			return;
		}

		if (queryRunTimer) {
			clearTimeout(queryRunTimer);
		}

		queryRunTimer = setTimeout(() => {
			queryRunTimer = null;
			void run();
		}, 80);
	}

	function reset(): void {
		const querySnapshot = bindings.getQuerySnapshot();
		if (!querySnapshot) {
			return;
		}

		bindings.setQueryTree(createDefaultQueryTree(querySnapshot.fields));
		bindings.setQueryResult(null);
		bindings.setQueryError('');
		scheduleRun();
	}

	function mutateTree(nextTree: QueryNode | null): void {
		bindings.setQueryTree(nextTree);
		bindings.setQueryResult(null);
		bindings.setQueryError('');
		scheduleRun();
	}

	function update(path: number[], nextNode: QueryNode): void {
		const queryTree = bindings.getQueryTree();
		if (!queryTree) {
			return;
		}

		mutateTree(updateQueryNodeAtPath(queryTree, path, () => nextNode));
	}

	function remove(path: number[]): void {
		const queryTree = bindings.getQueryTree();
		if (!queryTree) {
			return;
		}

		mutateTree(removeQueryNodeAtPath(queryTree, path));
	}

	function insert(path: number[], child: QueryNode): void {
		const queryTree = bindings.getQueryTree();
		if (!queryTree) {
			return;
		}

		mutateTree(insertQueryNodeAtPath(queryTree, path, child));
	}

	function move(path: number[], direction: -1 | 1): void {
		const queryTree = bindings.getQueryTree();
		if (!queryTree) {
			return;
		}

		mutateTree(moveQueryNodeAtPath(queryTree, path, direction));
	}

	function dispose(): void {
		if (queryRunTimer) {
			clearTimeout(queryRunTimer);
			queryRunTimer = null;
		}
	}

	return {
		run,
		scheduleRun,
		reset,
		update,
		remove,
		insert,
		move,
		dispose,
	};
}
