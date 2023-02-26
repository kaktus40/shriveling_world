<script lang="ts">
	import { onMount } from 'svelte';
	import 'ol/ol.css';
	import ImageLayer from 'ol/layer/Image';
	import Map from 'ol/Map';
	import Projection from 'ol/proj/Projection';
	import Static from 'ol/source/ImageStatic';
	import View from 'ol/View';
	import { getCenter } from 'ol/extent';
	import { Vector as VectorSource } from 'ol/source';
	import { Vector as VectorLayer } from 'ol/layer';
	import { initOl, activateFeature } from './controller';

	let mapElement: HTMLDivElement;
	export let map: Map;
	export let imageUrl: string;
	const extent = [-180, -90, 180, 90];
	const projection = new Projection({
		code: 'xkcd-image',
		units: 'pixels',
		extent: extent,
	});
	$: {
		if (imageUrl && map && map.getLayers.length < 2) {
			map.getLayers().insertAt(
				0,
				new ImageLayer({
					source: new Static({
						url: imageUrl,
						projection: projection,
						imageExtent: extent,
					}),
				})
			);
		}
	}

	onMount(async () => {
		const vectorSource = new VectorSource();

		initOl(vectorSource);

		const vectorLayer = new VectorLayer({
			source: vectorSource,
		});

		map = new Map({
			layers: [vectorLayer],
			target: mapElement,
			view: new View({
				projection: projection,
				center: getCenter(extent),
				zoom: 2,
				maxZoom: 15,
			}),
		});

		map.on('click', function (evt) {
			map.forEachFeatureAtPixel(evt.pixel, activateFeature);
		});

		// change mouse cursor when over marker
		map.on('pointermove', function (e) {
			const pixel = map.getEventPixel(e.originalEvent);
			const hit = map.hasFeatureAtPixel(pixel, { layerFilter: (a) => a === vectorLayer });
			mapElement.style.cursor = hit ? 'pointer' : '';
		});
	});
</script>

<div bind:this={mapElement} class="map" />

<style>
	.map {
		width: 50vw;
		height: 100vh;
	}
</style>
