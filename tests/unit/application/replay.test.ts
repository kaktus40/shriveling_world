import { strict as assert } from 'node:assert';
import { describe, test } from 'vitest';
import { createReplayScheduler } from '$lib/application/replay';

describe('replay scheduler', () => {
	test('coalesces repeated requests into one replay pass', () => {
		const scheduledTasks: Array<() => void> = [];
		let runCount = 0;
		const scheduler = createReplayScheduler(
			() => {
				runCount += 1;
			},
			(task) => {
				scheduledTasks.push(task);
			},
		);

		scheduler.request();
		scheduler.request();

		assert.equal(scheduledTasks.length, 1);
		scheduledTasks.shift()?.();
		assert.equal(runCount, 1);
	});

	test('queues one more replay pass when a request arrives during execution', async () => {
		const scheduledTasks: Array<() => void> = [];
		let runCount = 0;
		let resolveRun: (() => void) | null = null;
		const scheduler = createReplayScheduler(
			() =>
				new Promise<void>((resolve) => {
					runCount += 1;
					resolveRun = resolve;
				}),
			(task) => {
				scheduledTasks.push(task);
			},
		);

		scheduler.request();
		scheduledTasks.shift()?.();
		assert.equal(runCount, 1);

		scheduler.request();
		assert.equal(scheduledTasks.length, 0);

		resolveRun?.();
		await Promise.resolve();
		await Promise.resolve();
		assert.equal(scheduledTasks.length, 1);
		scheduledTasks.shift()?.();
		resolveRun?.();
		await Promise.resolve();
		await Promise.resolve();
		assert.equal(runCount, 2);
	});
});
