<script lang="ts">
	import 'normalize.css';
	import 'svelte-material-ui/bare.css';
	import BabylonMap from '../components/babylon.svelte';
	import Ol from '../components/ol.svelte';

	import type Map from 'ol/Map';
	import { onMount } from 'svelte';

	import type { MenuComponentDev } from '@smui/menu';
	import Menu from '@smui/menu';
	import List, { Item, Text } from '@smui/list';
	import Button, { Label } from '@smui/button';
	import Switch from '@smui/switch';
	import FormField from '@smui/form-field';
	import Textfield from '@smui/textfield';
	import Slider from '@smui/slider';
	import Select, { Option } from '@smui/select';

	import { Merger } from './../../application/bigBoard/merger';
	import type { StandardMaterial } from '@babylonjs/core';
	import { inflate } from 'pako';
	import type { IListFile } from '../../application/definitions/project';
	import {
		generateTowns,
		showGeojson,
		activateTown,
		updateCountryResolution,
		updateTownResolution,
	} from '../components/controller';

	let wired = false;
	let countryResolution = 5;
	let gg: GeoJSON.FeatureCollection;
	let townResolution = 1;
	let percent = 0;

	let menu: MenuComponentDev;
	let datasets: string[] = [];
	let merger = new Merger();
	let imageUrl: string;
	let map: Map;
	let earthMaterial: StandardMaterial;
	let debugMaterial: StandardMaterial;
	let nbPoints = 5;
	let templatePoints: { [show: string]: number };

	fetch(`datasets/datasets.json`)
		.then((r) => r.json())
		.then(async (a) => (datasets = await a));

	$: {
		updateCountryResolution(countryResolution);
	}
	$: {
		updateTownResolution(townResolution);
	}

	$: {
		if (earthMaterial) {
			earthMaterial.wireframe = wired;
			debugMaterial.wireframe = wired;
		}
	}

	$: {
		templatePoints = {};
		for (let i = 1; i < nbPoints; i++) {
			templatePoints[i + '/' + nbPoints] = i / nbPoints;
		}
		for (let i = 1; i <= nbPoints; i++) {
			templatePoints[i] = i;
		}
		templatePoints = templatePoints;
	}

	$: {
		if (merger.state === 'complete') {
			generateTowns(merger.Cities);
			activateTown();
		}
	}

	async function addSet(name) {
		const zip = await fetch('datasets/' + name).then(async (raw) =>
			raw.arrayBuffer().then((buf) => new Uint8Array(buf))
		);
		const unzipped = JSON.parse(new TextDecoder('utf-8').decode(inflate(zip))) as IListFile[];
		merger.clear();
		unzipped.forEach((file) => {
			const fileName = file.name.toLowerCase();
			if (fileName.endsWith('.geojson')) {
				gg = JSON.parse(file.text) as GeoJSON.FeatureCollection;
				showGeojson(gg);
			} else if (fileName.endsWith('.csv')) {
				merger.addFile(file.text);
				if (merger.state === 'ready') {
					merger.merge();
				}
			}
			if (merger.state === 'complete') {
				generateTowns(merger.Cities);
			}
		});
	}

	fetch('assets/earthmap4k.jpg')
		.then((res) => res.blob())
		.then((blob) => {
			imageUrl = URL.createObjectURL(blob);
		});
</script>

<main>
	<Ol {imageUrl} bind:map />
	<BabylonMap {imageUrl} bind:earthMaterial bind:debugMaterial />
</main>

<div class="dataset">
	<Button on:click={() => menu.setOpen(true)}>
		<Label>Datasets</Label>
	</Button>
	<Menu bind:this={menu}>
		<List>
			{#each datasets as dataset, i}
				<Item on:SMUI:action={() => addSet(dataset)}>
					<Text>{dataset}</Text>
				</Item>
			{/each}
		</List>
	</Menu>
</div>
<div class="commands">
	<FormField>
		<Switch bind:checked={wired} />
		<span slot="label">Wired</span>
	</FormField>
	<Select bind:value={townResolution} label="résolution villes">
		{#each Object.entries(templatePoints) as [name, value]}
			<Option {value}>{name}</Option>
		{/each}
	</Select>
	<Textfield
		bind:value={countryResolution}
		label="résolution pays"
		type="number"
		input$step="0.05"
		input$min="1"
		input$max="10"
	/>
	<Slider bind:value={percent} min={-10} max={10} step={0.001} input$aria-label="Continuous slider" />
</div>

<style>
	main {
		display: flex;
		justify-content: center;
		align-items: left;
		flex-direction: row;
		width: 100vw;
		height: 100vh;
	}
	.dataset {
		position: absolute;
		top: 100px;
		z-index: 3;
		color: wheat;
		text-shadow: 2px 2px 4px black;
		cursor: pointer;
	}
	.commands {
		position: absolute;
		top: 100px;
		right: 50px;
		z-index: 3;
		color: wheat;
		text-shadow: 2px 2px 4px black;
		cursor: pointer;
		display: flex;
		justify-content: center;
		align-items: left;
		flex-direction: column;
	}
</style>
