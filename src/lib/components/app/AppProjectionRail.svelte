<script lang="ts">
	import {
		APP_PROJECTION_LABELS,
		APP_PROJECTION_MODES,
		type AppProjectionMode,
	} from '$lib/application/app';

	export let projectionStart: AppProjectionMode = 'none';
	export let projectionEnd: AppProjectionMode = 'equirectangular';
	export let projectionPercent = 50;
	export let loading = false;
	export let onProjectionStartChange: (value: AppProjectionMode) => void = () => undefined;
	export let onProjectionEndChange: (value: AppProjectionMode) => void = () => undefined;
	export let onProjectionPercentChange: (value: number) => void = () => undefined;

	function updatePercent(value: number): void {
		onProjectionPercentChange(Math.max(0, Math.min(100, value)));
	}
</script>

<section class="projection-rail" role="group" aria-label="Projection control">
	<div class="head">
		<p class="eyebrow">Display</p>
		<h2>Projection</h2>
	</div>

	<div class="mode mode-start">
		<label>
			<span>Start</span>
			<select
				value={projectionStart}
				disabled={loading}
				on:change={(event) =>
					onProjectionStartChange((event.currentTarget as HTMLSelectElement).value as AppProjectionMode)}
			>
				{#each APP_PROJECTION_MODES as mode}
					<option value={mode}>{APP_PROJECTION_LABELS[mode]}</option>
				{/each}
			</select>
		</label>
	</div>

	<div class="slider">
		<input
			type="range"
			min="0"
			max="100"
			step="1"
			value={projectionPercent}
			disabled={loading}
			on:input={(event) => updatePercent(Number((event.currentTarget as HTMLInputElement).value))}
		/>
		<div class="percent">{projectionPercent}%</div>
	</div>

	<div class="mode mode-end">
		<label>
			<span>End</span>
			<select
				value={projectionEnd}
				disabled={loading}
				on:change={(event) =>
					onProjectionEndChange((event.currentTarget as HTMLSelectElement).value as AppProjectionMode)}
			>
				{#each APP_PROJECTION_MODES as mode}
					<option value={mode}>{APP_PROJECTION_LABELS[mode]}</option>
				{/each}
			</select>
		</label>
	</div>
</section>

<style>
	.projection-rail {
		position: fixed;
		right: 0;
		top: 0;
		z-index: 4;
		height: 100vh;
		width: var(--app-projection-rail-width, 12.25rem);
		padding: 1rem 0.8rem 1rem 0.9rem;
		display: grid;
		grid-template-rows: auto auto 1fr auto;
		align-items: start;
		gap: 0.75rem;
		background: linear-gradient(270deg, rgba(8, 12, 16, 0.76), rgba(8, 12, 16, 0.26));
		border-left: 1px solid rgba(138, 168, 178, 0.18);
		backdrop-filter: blur(14px);
		pointer-events: auto;
	}

	.head {
		display: grid;
		gap: 0.15rem;
		color: #e5efef;
	}

	.eyebrow {
		margin: 0;
		font-size: 0.68rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: #88d6d2;
	}

	h2 {
		margin: 0;
		font-size: 0.92rem;
		letter-spacing: 0.03em;
	}

	.mode {
		display: grid;
		align-items: center;
	}

	label {
		display: grid;
		gap: 0.25rem;
	}

	label span,
	.percent {
		color: #bbd2d5;
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}

	select {
		width: 100%;
		padding: 0.42rem 0.48rem;
		border-radius: 0.65rem;
		border: 1px solid rgba(138, 168, 178, 0.2);
		background: rgba(10, 16, 21, 0.92);
		color: #eef6f6;
		font: inherit;
		font-size: 0.76rem;
	}

	.slider {
		display: grid;
		justify-items: center;
		align-content: center;
		gap: 0.45rem;
	}

	input[type='range'] {
		width: 1.4rem;
		height: calc(100vh - 11rem);
		max-height: 46rem;
		min-height: 18rem;
		writing-mode: vertical-lr;
		direction: rtl;
		accent-color: #d78d48;
	}

	.percent {
		margin-top: 0.25rem;
	}
</style>
