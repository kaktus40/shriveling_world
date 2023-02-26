<script lang="ts">
	import { onMount } from 'svelte';
	import type { IListFile } from '../../application/definitions/project';
	import { BigBoard } from '../../application/bigBoard/bigBoard';
	import 'normalize.css';
	let bigBoard;
	let board: HTMLElement;
	let dat: HTMLElement;
	let datasets: string[] = [];
	import { onDestroy } from 'svelte';
	fetch(`datasets/datasets.json`)
		.then((r) => r.json())
		.then(async (a) => (datasets = await a));
	async function addSet(event) {
		const name = event.target.dataset.name;
		if (name !== undefined) {
			const zip = await fetch('datasets/' + name).then(async (raw) =>
				raw.arrayBuffer().then((buf) => new Uint8Array(buf))
			);
			bigBoard.unzip(zip);
		}
	}

	onMount(async () => {
		// const BigBoard = (await import('../../application/bigBoard/bigBoard')).default;
		bigBoard = new BigBoard(board, dat);
		window.bigBoard = bigBoard;
	});
</script>

<div bind:this={board} class="app" />
<div class="dataset" on:click={addSet}>
	{#each datasets as dataset, i}
		<div data-name={dataset}>{dataset}</div>
	{/each}
</div>
<div class="dat" bind:this={dat} />

<style>
	h1 {
		text-align: center;
		margin: 0 auto;
	}

	h1 {
		font-size: 2.8em;
		text-transform: uppercase;
		font-weight: 700;
		margin: 0 0 0.5em 0;
	}

	@media (min-width: 480px) {
		h1 {
			font-size: 4em;
		}
	}

	.app {
		background: #000;
		color: #fff;
		padding: 0;
		margin: 0;
		font-weight: bold;
		overflow: hidden;
	}

	.dataset {
		position: absolute;
		top: 100px;
		z-index: 3;
		color: wheat;
		text-shadow: 2px 2px 4px black;
		cursor: pointer;
	}

	.dataset > div {
		font-size: inherit;
		transition: font-size 1s;
	}

	.dataset > div:hover {
		font-size: x-large;
		transition: font-size 1s;
	}

	.dat {
		top: 50px;
		z-index: 3;
		position: absolute;
		right: 0px;
	}
</style>
