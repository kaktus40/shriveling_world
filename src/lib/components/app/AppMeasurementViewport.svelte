<script lang="ts">
	import type { AppMeasurementSummary } from '$lib/application/app/measurement';

	export let measurementSummary: AppMeasurementSummary | null = null;
	export let loading = false;
	export let onFocusPoint: (cityIndex: number) => void = () => undefined;

	let hovered = false;

	$: planePoints = measurementSummary?.planeFrame?.points ?? [];
	$: box = buildBox(planePoints);

	function buildBox(
		points: readonly { position: readonly [number, number] }[],
	): { minX: number; minY: number; width: number; height: number } {
		if (points.length === 0) {
			return { minX: -1, minY: -1, width: 2, height: 2 };
		}

		let minX = Infinity;
		let minY = Infinity;
		let maxX = -Infinity;
		let maxY = -Infinity;
		for (const point of points) {
			minX = Math.min(minX, point.position[0]);
			minY = Math.min(minY, point.position[1]);
			maxX = Math.max(maxX, point.position[0]);
			maxY = Math.max(maxY, point.position[1]);
		}

		const spanX = Math.max(1, maxX - minX);
		const spanY = Math.max(1, maxY - minY);
		const marginX = spanX * 0.18;
		const marginY = spanY * 0.18;
		return {
			minX: minX - marginX,
			minY: minY - marginY,
			width: spanX + marginX * 2,
			height: spanY + marginY * 2,
		};
	}

	function focusCity(cityIndex: number | null): void {
		if (cityIndex == null) {
			return;
		}
		onFocusPoint(cityIndex);
	}
</script>

<section
	class:expanded={hovered}
	class="measurement-viewport"
	role="group"
	aria-label="Measurement viewport"
	on:mouseenter={() => (hovered = true)}
	on:mouseleave={() => (hovered = false)}
>
	<header class="head">
		<div>
			<p class="eyebrow">Tools</p>
			<h2>Measurement viewport</h2>
		</div>
		<div class="metrics">
			<span>{measurementSummary?.centralAngleDegrees == null ? 'A/O/B pending' : measurementSummary.centralAngleDegrees.toFixed(2) + '°'}</span>
			<span>{measurementSummary?.angleAtBDegrees == null ? 'A/B/C pending' : measurementSummary.angleAtBDegrees.toFixed(2) + '°'}</span>
		</div>
	</header>

	{#if measurementSummary?.planeFrame}
		<svg
			class="plane"
			viewBox={`${box.minX} ${box.minY} ${box.width} ${box.height}`}
			preserveAspectRatio="xMidYMid meet"
		>
			<defs>
				<marker id="arrow" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto" markerUnits="strokeWidth">
					<path d="M0,0 L10,5 L0,10 z" fill="rgba(136,214,210,0.9)" />
				</marker>
			</defs>
			{#if measurementSummary.planeFrame.points.length > 1}
				{#each measurementSummary.planeFrame.points.slice(1) as point, index}
					<line
						x1="0"
						y1="0"
						x2={point.position[0]}
						y2={point.position[1]}
						class={`ray ray-${index}`}
						marker-end="url(#arrow)"
					/>
				{/each}
			{/if}
			{#each measurementSummary.planeFrame.points as point}
				<!-- svelte-ignore a11y-no-static-element-interactions -->
				<!-- svelte-ignore a11y-click-events-have-key-events -->
				<g class={`point point-${point.label.toLowerCase()}`} on:click={() => focusCity(point.cityIndex)}>
					<circle cx={point.position[0]} cy={point.position[1]} r={point.kind === 'origin' ? 0.12 : 0.22} />
					<text x={point.position[0] + 0.14} y={point.position[1] - 0.14}>{point.label}</text>
				</g>
			{/each}
		</svg>
	{:else}
		<div class="empty">
			<p>Select at least two cities to display the A/B/Earth-center plane.</p>
			<span>{loading ? 'Waiting for compute' : 'Ready'}</span>
		</div>
	{/if}
</section>

<style>
	.measurement-viewport {
		position: fixed;
		right: 5.25rem;
		bottom: 1rem;
		z-index: 3;
		width: min(24rem, calc(100vw - 7rem));
		height: min(18rem, calc(100vh - 14rem));
		padding: 0.8rem 0.9rem;
		border-radius: 1rem;
		background: rgba(8, 12, 16, 0.76);
		border: 1px solid rgba(138, 168, 178, 0.18);
		backdrop-filter: blur(18px);
		color: #e5efef;
		box-shadow: 0 1rem 2rem rgba(0, 0, 0, 0.28);
		pointer-events: auto;
		display: flex;
		flex-direction: column;
		gap: 0.55rem;
	}

	.measurement-viewport:hover,
	.expanded {
		background: rgba(8, 12, 16, 0.88);
		border-color: rgba(138, 168, 178, 0.32);
	}

	.head {
		display: flex;
		justify-content: space-between;
		gap: 0.75rem;
		align-items: flex-start;
	}

	.eyebrow {
		margin: 0 0 0.08rem;
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

	.metrics {
		display: grid;
		gap: 0.2rem;
		justify-items: end;
	}

	.metrics span {
		padding: 0.26rem 0.48rem;
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.06);
		color: #bbd2d5;
		font-size: 0.74rem;
	}

	.plane {
		width: 100%;
		flex: 1;
		min-height: 10rem;
		background:
			radial-gradient(circle at 50% 50%, rgba(24, 127, 132, 0.15), transparent 18rem),
			linear-gradient(180deg, rgba(6, 10, 12, 0.86), rgba(5, 8, 10, 0.96));
		border-radius: 0.9rem;
		border: 1px solid rgba(138, 168, 178, 0.12);
	}

	.ray {
		stroke: rgba(136, 214, 210, 0.75);
		stroke-width: 0.08;
		fill: none;
	}

	.point {
		cursor: pointer;
	}

	.point circle {
		fill: #88d6d2;
		stroke: rgba(4, 9, 12, 0.9);
		stroke-width: 0.06;
	}

	.point text {
		fill: #f2f7f7;
		font-size: 0.45px;
		paint-order: stroke;
		stroke: rgba(4, 9, 12, 0.75);
		stroke-width: 0.12px;
	}

	.point.point-o circle {
		fill: #f0d78d;
	}

	.point.point-a circle {
		fill: #88d6d2;
	}

	.point.point-b circle {
		fill: #d78d48;
	}

	.point.point-c circle {
		fill: #b87df0;
	}

	.empty {
		display: grid;
		place-items: center;
		text-align: center;
		padding: 0.9rem;
		border-radius: 0.9rem;
		border: 1px dashed rgba(138, 168, 178, 0.2);
		color: #b6c8cb;
	}

	.empty p {
		margin: 0;
	}

	.empty span {
		margin-top: 0.35rem;
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: #88d6d2;
	}
</style>
