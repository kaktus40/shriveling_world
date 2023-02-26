<script lang="ts">
	import { CONFIGURATION } from '../../application/common/configuration';
	import 'normalize.css';
	import 'svelte-material-ui/bare.css';
	import { onMount } from 'svelte';

	import {
		Engine,
		Scene,
		ArcRotateCamera,
		Vector3,
		HemisphericLight,
		Color3,
		Color4,
		DirectionalLight,
	} from '@babylonjs/core';
	import '@babylonjs/core/Debug/debugLayer';
	import '@babylonjs/inspector';

	import type { MenuComponentDev } from '@smui/menu';
	import Menu from '@smui/menu';
	import List, { Item, Text } from '@smui/list';
	import Button, { Label } from '@smui/button';
	import Switch from '@smui/switch';
	import FormField from '@smui/form-field';
	import Slider from '@smui/slider';

	import { init as initCountry, countries as countriesOrigin, Country } from '../../application/country/countryMesh';
	import { unzip } from '../../application/bigBoard/addons/fileManager';
	import { generateEarthMaterial, earthMaterial } from '../../application/country/earthMaterial';

	let wired = false;
	let percent = 1;

	let myCanvas: HTMLCanvasElement;
	let scene: Scene;

	let menu: MenuComponentDev;
	let datasets: string[] = [];
	let countries: Country[] = [];

	$: {
		if (earthMaterial()) earthMaterial().wireframe = wired;
	}

	$: {
		countries.forEach((c) => (c.extruded = percent));
	}

	fetch(`datasets/datasets.json`)
		.then((r) => r.json())
		.then(async (a) => (datasets = await a));

	async function addSet(name) {
		const zip = await fetch('datasets/' + name).then((raw) => raw.arrayBuffer().then((buf) => new Uint8Array(buf)));
		unzip(zip);
		countries = countriesOrigin;
	}

	onMount(async () => {
		const engine = new Engine(myCanvas, true);
		scene = new Scene(engine);
		// scene.ambientColor = new Color3(1, 1, 1);
		scene.clearColor = new Color4(1, 1, 1, 1);
		initCountry(scene);
		generateEarthMaterial(scene);

		const hemi = new HemisphericLight('hemiLight', new Vector3(0, 0, 1), scene);

		// new DirectionalLight('hemi', new Vector3(1, 0, 0), scene);

		const camera = new ArcRotateCamera('camera1', 0, 0, 0, new Vector3(0, 0, 0), scene);
		camera.setPosition(new Vector3(150, 0, 0));
		camera.zoomToMouseLocation = true;

		camera.attachControl(myCanvas, true);

		engine.runRenderLoop(() => {
			CONFIGURATION.tick();
			scene.render();
		});
		myCanvas.addEventListener('keydown', (ev) => {
			// Shift+Ctrl+Alt+I
			if (ev.shiftKey && ev.ctrlKey && ev.altKey && ev.keyCode === 73) {
				if (scene.debugLayer.isVisible()) {
					scene.debugLayer.hide();
				} else {
					scene.debugLayer.show();
				}
			}
			switch (ev.key) {
				case '+':
					camera.radius -= 0.1;
					break;
				case '-':
					camera.radius += 0.1;
					break;

				default:
					break;
			}
		});
		window.addEventListener('resize', function () {
			engine.resize();
		});
	});
</script>

<main><canvas bind:this={myCanvas} /></main>

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

	<Slider bind:value={percent} min={1} max={100} step={0.1} input$aria-label="Continuous slider" />
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
	canvas {
		width: 80%;
		height: 80%;
	}
</style>
