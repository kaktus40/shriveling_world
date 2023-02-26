<script lang="ts">
	import { onMount } from 'svelte';
	import '@babylonjs/core/Debug/debugLayer';
	import '@babylonjs/inspector';
	import {
		Engine,
		Scene,
		ArcRotateCamera,
		Vector3,
		HemisphericLight,
		Color3,
		Color4,
		StandardMaterial,
		Texture,
	} from '@babylonjs/core';
	import { initBabylon } from './controller';

	export let imageUrl: string;

	let myCanvas: HTMLCanvasElement;
	let scene: Scene;
	export let earthMaterial: StandardMaterial;
	export let debugMaterial: StandardMaterial;

	$: {
		if (imageUrl && earthMaterial) {
			earthMaterial.diffuseTexture = new Texture(imageUrl, scene);
		}
	}

	onMount(async () => {
		const engine = new Engine(myCanvas, true);
		scene = new Scene(engine);
		scene.ambientColor = new Color3(1, 1, 1);
		scene.clearColor = new Color4(1, 1, 1, 1);

		new HemisphericLight('hemiLight', new Vector3(0, 0, 1), scene);

		// new DirectionalLight('hemi', new Vector3(1, 0, 0), scene);

		const camera = new ArcRotateCamera('camera1', 0, 0, 0, new Vector3(0, 0, 0), scene);
		camera.setPosition(new Vector3(20, 0, 0));
		camera.zoomToMouseLocation = true;

		camera.attachControl(myCanvas, true);

		engine.runRenderLoop(() => {
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
		// myCanvas.addEventListener('click', () => {
		// 	const pickResult = scene.pick(scene.pointerX, scene.pointerY);
		// 	if (pickResult.hit) {
		// 		console.log(pickResult.pickedMesh.name);
		// 	}
		// });

		earthMaterial = new StandardMaterial('earthMaterial', scene);

		earthMaterial.backFaceCulling = false;
		debugMaterial = new StandardMaterial('debugMaterial', scene);
		debugMaterial.backFaceCulling = false;
		debugMaterial.diffuseColor = Color3.Magenta();
		debugMaterial.alpha = 0.3;
		initBabylon(scene, earthMaterial, debugMaterial);
	});
</script>

<canvas bind:this={myCanvas} />

<style>
	canvas {
		width: 50vw;
		height: 100vh;
	}
</style>
