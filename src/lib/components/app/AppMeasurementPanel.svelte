<script lang="ts">
	import type { AppMeasurementSelection, AppMeasurementSummary, AppMeasurementSlot } from '$lib/application/app/measurement';
	import type { WorkspaceCitySummary } from '$lib/application/workspace';

	export let selectedCityIndex = 0;
	export let selectedCity: WorkspaceCitySummary | null = null;
	export let measurementSelection: AppMeasurementSelection;
	export let measurementSummary: AppMeasurementSummary | null = null;
	export let loading = false;
	export let onSetPoint: (slot: AppMeasurementSlot) => void = () => undefined;
	export let onClearPoint: (slot: AppMeasurementSlot) => void = () => undefined;
	export let onCenterOnSelectedCity: () => void = () => undefined;
	export let onRotationChange: (degrees: number) => void = () => undefined;
	export let onReset: () => void = () => undefined;

	let hovered = false;

	const slotLabels: Record<AppMeasurementSlot, string> = {
		a: 'Point A',
		b: 'Point B',
		c: 'Point C',
	};

	function describeSlot(slot: AppMeasurementSlot): string {
		const summaryEntry = measurementSummary?.selectedCities.find((entry) => entry.slot === slot);
		if (!summaryEntry) {
			return 'Unset';
		}
		return `${summaryEntry.city.cityIndex} · ${summaryEntry.city.cityLabel}`;
	}
</script>

<section
	class:expanded={hovered}
	class="panel measurement-panel"
	role="group"
	aria-label="Measurement tools"
	on:mouseenter={() => (hovered = true)}
	on:mouseleave={() => (hovered = false)}
>
	<header class="panel-head">
		<div>
			<p class="eyebrow">Tools</p>
			<h2>Measurement</h2>
		</div>
		<div class="actions">
			<button type="button" class="action" on:click={onCenterOnSelectedCity} disabled={loading || !selectedCity}>
				Center city
			</button>
			<button type="button" class="action" on:click={onReset} disabled={loading}>Reset tools</button>
		</div>
	</header>

	<div class="teaser">
	<span>{selectedCity ? `${selectedCityIndex} · ${selectedCity.cityLabel}` : 'No city selected'}</span>
		<span>
			{measurementSummary?.centralAngleDegrees == null
				? 'Central angle pending'
				: `A/O/B: ${measurementSummary.centralAngleDegrees.toFixed(2)}°`}
		</span>
		<span>
			{measurementSummary?.angleAtBDegrees == null
				? 'Three-point angle pending'
				: `A/B/C: ${measurementSummary.angleAtBDegrees.toFixed(2)}°`}
		</span>
	</div>

	{#if hovered}
		<div class="slots">
			{#each (['a', 'b', 'c'] as AppMeasurementSlot[]) as slot}
				<div class="slot-row">
					<div class="slot-meta">
						<div class="slot-name">{slotLabels[slot]}</div>
						<div class="slot-value">{describeSlot(slot)}</div>
					</div>
					<div class="slot-actions">
						<button type="button" class="action subtle" disabled={loading} on:click={() => onSetPoint(slot)}>
							Use current
						</button>
						<button type="button" class="action subtle" disabled={loading} on:click={() => onClearPoint(slot)}>
							Clear
						</button>
					</div>
				</div>
			{/each}
		</div>

		<label class="rotation">
			<span>Local rotation</span>
			<input
				type="range"
				min="0"
				max="360"
				step="1"
				value={measurementSelection.localRotationDegrees}
				disabled={loading}
				on:input={(event) => onRotationChange(Number((event.currentTarget as HTMLInputElement).value))}
			/>
			<strong>{measurementSelection.localRotationDegrees.toFixed(0)}°</strong>
		</label>

		<div class="summary">
			{#if measurementSummary?.planeFrame}
				<span>{measurementSummary.planeFrame.points.length} plane markers</span>
				<span>Plane A/B/O ready</span>
			{:else}
				<span>Set at least A and B to show the plane</span>
			{/if}
			<span>
				Focus: {
					measurementSelection.focusCityIndex == null
						? 'none'
						: `${measurementSelection.focusCityIndex}`
				}
			</span>
		</div>
	{/if}
</section>

<style>
	.panel {
		pointer-events: auto;
		width: min(30rem, calc(100vw - 2rem));
		margin: 0 1rem 1rem;
		padding: 0.9rem 1rem;
		border-radius: 1rem;
		border: 1px solid rgba(138, 168, 178, 0.2);
		background: rgba(8, 12, 16, 0.72);
		backdrop-filter: blur(18px);
		box-shadow: 0 1rem 2rem rgba(0, 0, 0, 0.28);
		display: grid;
		gap: 0.65rem;
		color: #e5efef;
		transition:
			transform 160ms ease,
			background 160ms ease,
			border-color 160ms ease;
	}

	.panel:hover,
	.expanded {
		background: rgba(8, 12, 16, 0.84);
		border-color: rgba(138, 168, 178, 0.35);
		transform: translateY(-1px);
	}

	.panel-head {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 0.75rem;
	}

	.eyebrow {
		margin: 0 0 0.1rem;
		font-size: 0.72rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: #88d6d2;
	}

	h2 {
		margin: 0;
		font-size: 1rem;
		letter-spacing: 0.03em;
	}

	.actions,
	.slot-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.45rem;
	}

	.action {
		border: 1px solid rgba(138, 168, 178, 0.3);
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.04);
		color: inherit;
		padding: 0.45rem 0.8rem;
		font: inherit;
		cursor: pointer;
	}

	.action.subtle {
		padding: 0.35rem 0.65rem;
	}

	.action:hover {
		background: rgba(255, 255, 255, 0.08);
	}

	.teaser,
	.summary {
		display: flex;
		flex-wrap: wrap;
		gap: 0.45rem;
	}

	.teaser span,
	.summary span {
		padding: 0.3rem 0.55rem;
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.06);
		color: #bbd2d5;
		font-size: 0.82rem;
	}

	.slots {
		display: grid;
		gap: 0.5rem;
	}

	.slot-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		padding: 0.55rem 0.65rem;
		border-radius: 0.9rem;
		background: rgba(255, 255, 255, 0.04);
		border: 1px solid rgba(138, 168, 178, 0.12);
	}

	.slot-meta {
		display: grid;
		gap: 0.15rem;
	}

	.slot-name {
		font-size: 0.72rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: #88d6d2;
	}

	.slot-value {
		color: #e5efef;
		font-size: 0.86rem;
	}

	.rotation {
		display: grid;
		gap: 0.35rem;
	}

	.rotation span {
		font-size: 0.72rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: #8fb4b9;
	}

	.rotation input[type='range'] {
		width: 100%;
		accent-color: #88d6d2;
	}

	.rotation strong {
		font-size: 0.85rem;
		color: #dce9ea;
	}
</style>
