<script lang="ts">
	export let yearOptions: readonly number[] = [];
	export let selectedYear = 0;
	export let loading = false;
	export let onYearChange: (value: number) => void = () => undefined;

	let hovered = false;

	$: selectedIndex = Math.max(0, yearOptions.indexOf(selectedYear));
	$: selectedLabel = yearOptions[selectedIndex] ?? selectedYear ?? '—';
	$: rangeMax = Math.max(0, yearOptions.length - 1);

	function updateYear(indexValue: number): void {
		const nextYear = yearOptions[indexValue] ?? selectedYear;
		onYearChange(nextYear);
	}
</script>

<section
	class:expanded={hovered}
	class="year-rail"
	role="group"
	aria-label="Year control"
	on:mouseenter={() => (hovered = true)}
	on:mouseleave={() => (hovered = false)}
>
	<div class="header">
		<div>
			<p class="eyebrow">Time</p>
			<h2>Year</h2>
		</div>
		<div class="summary">{selectedLabel}</div>
	</div>

	<div class="rail">
		<input
			type="range"
			min="0"
			max={rangeMax}
			step="1"
			value={selectedIndex}
			disabled={loading || yearOptions.length === 0}
			on:input={(event) => updateYear(Number((event.currentTarget as HTMLInputElement).value))}
		/>
	</div>

	<div class="footer">
		<span>{yearOptions[0] ?? selectedYear ?? '—'}</span>
		<span>{yearOptions[yearOptions.length - 1] ?? selectedYear ?? '—'}</span>
	</div>
</section>

<style>
	.year-rail {
		position: fixed;
		left: 0;
		top: 0;
		right: 0;
		z-index: 4;
		padding: 0.55rem 1rem 0.45rem;
		background: linear-gradient(180deg, rgba(8, 12, 16, 0.75), rgba(8, 12, 16, 0.34));
		border-bottom: 1px solid rgba(138, 168, 178, 0.18);
		backdrop-filter: blur(14px);
		pointer-events: auto;
		opacity: 0.88;
		transition:
			opacity 160ms ease,
			background 160ms ease,
			border-color 160ms ease;
	}

	.year-rail:hover,
	.expanded {
		opacity: 1;
		background: linear-gradient(180deg, rgba(8, 12, 16, 0.88), rgba(8, 12, 16, 0.5));
		border-color: rgba(138, 168, 178, 0.34);
	}

	.header {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 1rem;
		color: #e5efef;
	}

	.eyebrow {
		margin: 0 0 0.1rem;
		font-size: 0.68rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: #88d6d2;
	}

	h2 {
		margin: 0;
		font-size: 0.95rem;
		letter-spacing: 0.03em;
	}

	.summary {
		padding: 0.28rem 0.55rem;
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.06);
		color: #bbd2d5;
		font-size: 0.8rem;
	}

	.rail {
		margin-top: 0.4rem;
	}

	input[type='range'] {
		width: 100%;
		height: 1.75rem;
		margin: 0;
		accent-color: #88d6d2;
	}

	.footer {
		display: flex;
		justify-content: space-between;
		margin-top: 0.2rem;
		color: #aabdc1;
		font-size: 0.75rem;
	}
</style>
