<script lang="ts">
	import { APP_REPRESENTATION_MODES, type AppRepresentationMode } from '$lib/application/app';

	export let representationStart: AppRepresentationMode = 'globe';
	export let representationEnd: AppRepresentationMode = 'network';
	export let representationPercent = 50;
	export let loading = false;
	export let onRepresentationStartChange: (value: AppRepresentationMode) => void = () => undefined;
	export let onRepresentationEndChange: (value: AppRepresentationMode) => void = () => undefined;
	export let onRepresentationPercentChange: (value: number) => void = () => undefined;

	const representationModeLabels: Record<AppRepresentationMode, string> = {
		globe: 'Globe',
		network: 'Network',
	};

	let hovered = false;

	function updatePercent(value: number): void {
		onRepresentationPercentChange(Math.max(0, Math.min(100, value)));
	}
</script>

<section
	class:expanded={hovered}
	class="representation-rail"
	role="group"
	aria-label="Representation control"
	on:mouseenter={() => (hovered = true)}
	on:mouseleave={() => (hovered = false)}
>
	<div class="head">
		<p class="eyebrow">Display</p>
		<h2>Representation</h2>
	</div>

	<div class="mode mode-start">
		<label>
			<span>Start</span>
			<select
				value={representationStart}
				disabled={loading}
				on:change={(event) =>
					onRepresentationStartChange((event.currentTarget as HTMLSelectElement).value as AppRepresentationMode)}
			>
				{#each APP_REPRESENTATION_MODES as mode}
					<option value={mode}>{representationModeLabels[mode]}</option>
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
			value={representationPercent}
			disabled={loading}
			on:input={(event) => updatePercent(Number((event.currentTarget as HTMLInputElement).value))}
		/>
		<div class="percent">{representationPercent}%</div>
	</div>

	<div class="mode mode-end">
		<label>
			<span>End</span>
			<select
				value={representationEnd}
				disabled={loading}
				on:change={(event) =>
					onRepresentationEndChange((event.currentTarget as HTMLSelectElement).value as AppRepresentationMode)}
			>
				{#each APP_REPRESENTATION_MODES as mode}
					<option value={mode}>{representationModeLabels[mode]}</option>
				{/each}
			</select>
		</label>
	</div>
</section>

<style>
	.representation-rail {
		position: fixed;
		right: 0;
		top: 0;
		z-index: 4;
		height: 100vh;
		width: 4.5rem;
		padding: 1rem 0.55rem;
		display: grid;
		grid-template-rows: auto auto 1fr auto;
		gap: 0.75rem;
		background: linear-gradient(270deg, rgba(8, 12, 16, 0.76), rgba(8, 12, 16, 0.26));
		border-left: 1px solid rgba(138, 168, 178, 0.18);
		backdrop-filter: blur(14px);
		pointer-events: auto;
		opacity: 0.82;
		transition:
			opacity 160ms ease,
			background 160ms ease,
			border-color 160ms ease;
	}

	.representation-rail:hover,
	.expanded {
		opacity: 1;
		background: linear-gradient(270deg, rgba(8, 12, 16, 0.9), rgba(8, 12, 16, 0.42));
		border-color: rgba(138, 168, 178, 0.34);
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
		padding: 0.35rem 0.4rem;
		border-radius: 0.65rem;
		border: 1px solid rgba(138, 168, 178, 0.2);
		background: rgba(10, 16, 21, 0.92);
		color: #eef6f6;
		font: inherit;
	}

	.slider {
		display: grid;
		justify-items: center;
		align-content: center;
		gap: 0.45rem;
	}

	input[type='range'] {
		width: 1.25rem;
		height: calc(100vh - 11rem);
		max-height: 46rem;
		min-height: 18rem;
		appearance: slider-vertical;
		writing-mode: bt-lr;
		-webkit-appearance: slider-vertical;
		accent-color: #d78d48;
	}

	.percent {
		margin-top: 0.25rem;
	}
</style>
