<script lang="ts">
	import { APP_MODULES, type AppModuleKey } from './app-modules';

	export let activeModule: AppModuleKey | null = null;
	export let onSelect: (module: AppModuleKey) => void = () => undefined;
</script>

<nav class="dock" aria-label="Application modules">
	{#each APP_MODULES as module}
		<button
			type="button"
			class:active={activeModule === module.key}
			class="dock-button"
			title={module.title}
			aria-label={module.title}
			aria-pressed={activeModule === module.key}
			on:click={() => onSelect(module.key)}
		>
			{#if module.key === 'scene'}
				<svg viewBox="0 0 24 24" aria-hidden="true">
					<circle cx="12" cy="12" r="8.25" />
					<path d="M4.3 12h15.4" />
					<path d="M12 3.75a16 16 0 0 1 0 16.5" />
					<path d="M12 3.75a16 16 0 0 0 0 16.5" />
				</svg>
			{:else if module.key === 'query'}
				<svg viewBox="0 0 24 24" aria-hidden="true">
					<circle cx="11" cy="11" r="5.75" />
					<path d="M15.5 15.5 20.25 20.25" />
				</svg>
			{:else}
				<svg viewBox="0 0 24 24" aria-hidden="true">
					<path d="M5 18.5V5.5" />
					<path d="M9 16.5V7.5" />
					<path d="M13 19V4.5" />
					<path d="M17 14V9" />
					<path d="M5 18.5h12" />
					<path d="M9 7.5l4 4 3-2" />
				</svg>
			{/if}
			<span class="module-label">{module.label}</span>
		</button>
	{/each}
</nav>

<style>
	.dock {
		position: fixed;
		left: 0.75rem;
		top: calc(var(--app-year-rail-height, 4.75rem) + 0.35rem);
		z-index: 5;
		display: grid;
		gap: 0.5rem;
		pointer-events: auto;
	}

	.dock-button {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		width: 2.8rem;
		height: 2.8rem;
		padding: 0;
		border-radius: 999px;
		border: 1px solid rgba(138, 168, 178, 0.24);
		background: rgba(8, 12, 16, 0.78);
		backdrop-filter: blur(12px);
		color: #dbe8e7;
		box-shadow: 0 0.75rem 1.5rem rgba(0, 0, 0, 0.2);
		overflow: hidden;
		transition:
			width 150ms ease,
			background 150ms ease,
			border-color 150ms ease,
			transform 150ms ease;
	}

	.dock-button:hover,
	.dock-button:focus-visible,
	.dock-button.active {
		width: 10.5rem;
		background: rgba(8, 12, 16, 0.92);
		border-color: rgba(138, 168, 178, 0.4);
		transform: translateX(0.1rem);
	}

	svg {
		flex: 0 0 auto;
		width: 1.15rem;
		height: 1.15rem;
		margin-left: 0.82rem;
		stroke: currentColor;
		stroke-width: 1.7;
		fill: none;
		stroke-linecap: round;
		stroke-linejoin: round;
	}

	.module-label {
		font-size: 0.74rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		white-space: nowrap;
		opacity: 0;
		transform: translateX(-0.4rem);
		transition:
			opacity 140ms ease,
			transform 140ms ease;
	}

	.dock-button:hover .module-label,
	.dock-button:focus-visible .module-label,
	.dock-button.active .module-label {
		opacity: 1;
		transform: translateX(0);
	}
</style>
