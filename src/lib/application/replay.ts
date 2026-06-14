/** Schedules one replay pass without piling up repeated UI changes. */
export type ReplayTaskScheduler = (task: () => void) => void;

/** Controls a coalesced replay request for a long-lived runtime. */
export interface ReplayScheduler {
	request(): void;
	dispose(): void;
}

/** Creates a coalesced replay scheduler with a browser-friendly default timer. */
export function createReplayScheduler(
	run: () => Promise<void> | void,
	scheduleTask: ReplayTaskScheduler = defaultScheduleReplayTask,
): ReplayScheduler {
	let disposed = false;
	let running = false;
	let scheduled = false;
	let dirty = false;

	function flush(): void {
		if (disposed) {
			return;
		}
		scheduled = false;
		if (running) {
			dirty = true;
			return;
		}
		if (!dirty) {
			return;
		}
		dirty = false;
		running = true;
		void Promise.resolve(run())
			.catch(() => undefined)
			.finally(() => {
				running = false;
				if (dirty && !disposed) {
					schedule();
				}
			});
	}

	function schedule(): void {
		if (disposed || scheduled || running) {
			return;
		}
		scheduled = true;
		scheduleTask(flush);
	}

	return {
		request(): void {
			if (disposed) {
				return;
			}
			dirty = true;
			schedule();
		},
		dispose(): void {
			disposed = true;
			dirty = false;
		},
	};
}

function defaultScheduleReplayTask(task: () => void): void {
	if (typeof requestAnimationFrame === 'function') {
		requestAnimationFrame(() => task());
		return;
	}
	queueMicrotask(task);
}
