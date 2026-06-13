<script lang="ts">
	import { buildNed2EcefMatrix } from '$lib/shared/spherical';
	import { buildRawConeLocalNedDirection } from '$lib/domain/precompute';

	export let cityCoordinatesText = '';
	export let cityLinksText = '';
	export let coneLengthMeters = 1000;

	let canvas: HTMLCanvasElement | null = null;

	$: drawPreview();

	function drawPreview(): void {
		const element = canvas;
		if (!element) {
			return;
		}
		const context = element.getContext('2d');
		if (!context) {
			return;
		}
		const { width, height } = resizeCanvas(element);
		context.clearRect(0, 0, width, height);
		context.fillStyle = '#0a1016';
		context.fillRect(0, 0, width, height);
		context.strokeStyle = 'rgba(138,168,178,0.22)';
		context.strokeRect(0, 0, width, height);

		const cities = parseCities(cityCoordinatesText);
		if (cities.length === 0) {
			context.fillStyle = '#9fb1b7';
			context.fillText('No synthetic cities yet', 18, 28);
			return;
		}

		const matrices = cities.map(({ lon, lat }) => buildNed2EcefMatrix([lon, lat]));
		const points = matrices.map((matrix) => [matrix[12], matrix[13], matrix[14]] as const);
		const features = cities.flatMap((city, cityIndex) =>
			parseLinkRow(cityLinksText.split(/\r?\n/)[cityIndex] ?? '').map((link) => {
				const matrix = matrices[cityIndex];
				const [north, east, down] = buildRawConeLocalNedDirection(link.azimuthRadians, link.alphaRadians, coneLengthMeters);
				return {
					origin: points[cityIndex],
					end: [
						matrix[0] * north + matrix[4] * east + matrix[8] * down + matrix[12],
						matrix[1] * north + matrix[5] * east + matrix[9] * down + matrix[13],
						matrix[2] * north + matrix[6] * east + matrix[10] * down + matrix[14],
					] as const,
				};
			}),
		);

		const normalized = points.concat(features.flatMap((feature) => [feature.origin, feature.end]));
		const bounds = computeBounds(normalized);
		const project = (point: readonly [number, number, number]): [number, number] => {
			const centered: [number, number, number] = [
				point[0] - bounds.center[0],
				point[1] - bounds.center[1],
				point[2] - bounds.center[2],
			];
			const rotated = rotatePoint(centered, 0.8, -0.4);
			const scale = Math.min(width, height) / (bounds.radius * 2.3 || 1);
			const perspective = 1 / (1 + rotated[2] / (bounds.radius * 3 + 1));
			return [width / 2 + rotated[0] * scale * perspective, height / 2 - rotated[1] * scale * perspective];
		};

		context.lineWidth = 1.5;
		for (const feature of features) {
			const [x0, y0] = project(feature.origin);
			const [x1, y1] = project(feature.end);
			context.strokeStyle = '#8ae0dc';
			context.beginPath();
			context.moveTo(x0, y0);
			context.lineTo(x1, y1);
			context.stroke();
		}

		for (const point of points) {
			const [x, y] = project(point);
			context.fillStyle = '#e5b26a';
			context.beginPath();
			context.arc(x, y, 3.5, 0, Math.PI * 2);
			context.fill();
		}
	}

	function resizeCanvas(element: HTMLCanvasElement): { width: number; height: number } {
		const ratio = window.devicePixelRatio || 1;
		const width = element.clientWidth || 640;
		const height = element.clientHeight || 360;
		if (element.width !== width * ratio || element.height !== height * ratio) {
			element.width = width * ratio;
			element.height = height * ratio;
		}
		const context = element.getContext('2d');
		if (context) {
			context.setTransform(ratio, 0, 0, ratio, 0, 0);
			context.font = '12px IBM Plex Mono, monospace';
		}
		return { width, height };
	}

	function parseCities(text: string): Array<{ lon: number; lat: number }> {
		return text
			.split(/\r?\n/)
			.map((line) => line.trim())
			.filter(Boolean)
			.map((line) => {
				const [lonText, latText] = line.split(/[,\s]+/).filter(Boolean);
				return { lon: Number(lonText), lat: Number(latText) };
			})
			.filter((entry) => Number.isFinite(entry.lon) && Number.isFinite(entry.lat));
	}

	function parseLinkRow(row: string): Array<{ azimuthRadians: number; alphaRadians: number }> {
		return row
			.split(/[;|]/)
			.map((token) => token.trim())
			.filter(Boolean)
			.map((token) => {
				const parts = token.includes('@') ? token.split('@', 2)[1] : token;
				const [azimuthText, alphaText] = parts.split(':').map((part) => part.trim());
				return { azimuthRadians: Number(azimuthText), alphaRadians: Number(alphaText) };
			})
			.filter((entry) => Number.isFinite(entry.azimuthRadians) && Number.isFinite(entry.alphaRadians));
	}

	function computeBounds(points: readonly (readonly [number, number, number])[]): {
		center: readonly [number, number, number];
		radius: number;
	} {
		let minX = Infinity;
		let minY = Infinity;
		let minZ = Infinity;
		let maxX = -Infinity;
		let maxY = -Infinity;
		let maxZ = -Infinity;
		for (const [x, y, z] of points) {
			minX = Math.min(minX, x);
			minY = Math.min(minY, y);
			minZ = Math.min(minZ, z);
			maxX = Math.max(maxX, x);
			maxY = Math.max(maxY, y);
			maxZ = Math.max(maxZ, z);
		}
		const center: [number, number, number] = [(minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2];
		const radius = Math.max(maxX - minX, maxY - minY, maxZ - minZ) / 2 || 1;
		return { center, radius };
	}

	function rotatePoint(point: readonly [number, number, number], yaw: number, pitch: number): [number, number, number] {
		const cosYaw = Math.cos(yaw);
		const sinYaw = Math.sin(yaw);
		const cosPitch = Math.cos(pitch);
		const sinPitch = Math.sin(pitch);
		const x = point[0] * cosYaw - point[2] * sinYaw;
		const z = point[0] * sinYaw + point[2] * cosYaw;
		const y = point[1];
		return [x, y * cosPitch - z * sinPitch, y * sinPitch + z * cosPitch];
	}
</script>

<canvas bind:this={canvas} class="preview-canvas" aria-label="Synthetic 3D preview"></canvas>

<style>
	.preview-canvas {
		width: 100%;
		height: 24rem;
		border-radius: 1rem;
		border: 1px solid rgba(138, 168, 178, 0.2);
		background: #0a1016;
		display: block;
	}
</style>
