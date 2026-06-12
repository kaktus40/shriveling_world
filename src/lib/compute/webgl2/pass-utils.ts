import type {
	WebGl2RawConeAlphaDispatchResources,
} from './buffers';
import type { ConeShape } from '../../domain/precompute';

export function bindRawConeAlphaTextures(
	gl: WebGL2RenderingContext,
	resources: WebGl2RawConeAlphaDispatchResources,
): void {
	gl.activeTexture(gl.TEXTURE0);
	gl.bindTexture(gl.TEXTURE_2D, resources.cityLinkOffsetsTexture);
	const cityLinkOffsetsLocation = gl.getUniformLocation(resources.program, 'u_cityLinkOffsets');
	const cityLinkCountsLocation = gl.getUniformLocation(resources.program, 'u_cityLinkCounts');
	const cityLinkAzimuthLocation = gl.getUniformLocation(resources.program, 'u_cityLinkAzimuthRadians');
	const cityLinkAlphaLocation = gl.getUniformLocation(resources.program, 'u_cityLinkAlphaRadians');
	const cityFastestTerrestrialAlphaLocation = gl.getUniformLocation(
		resources.program,
		'u_cityFastestTerrestrialAlphaRadians',
	);
	if (
		!cityLinkOffsetsLocation ||
		!cityLinkCountsLocation ||
		!cityLinkAzimuthLocation ||
		!cityLinkAlphaLocation ||
		!cityFastestTerrestrialAlphaLocation
	) {
		throw new Error('WebGL2 raw-cone alpha uniform lookup failed');
	}

	gl.activeTexture(gl.TEXTURE1);
	gl.bindTexture(gl.TEXTURE_2D, resources.cityLinkCountsTexture);
	gl.uniform1i(cityLinkCountsLocation, 1);

	gl.activeTexture(gl.TEXTURE2);
	gl.bindTexture(gl.TEXTURE_2D, resources.cityLinkAzimuthTexture);
	gl.uniform1i(cityLinkAzimuthLocation, 2);

	gl.activeTexture(gl.TEXTURE3);
	gl.bindTexture(gl.TEXTURE_2D, resources.cityLinkAlphaTexture);
	gl.uniform1i(cityLinkAlphaLocation, 3);

	gl.activeTexture(gl.TEXTURE4);
	gl.bindTexture(gl.TEXTURE_2D, resources.cityFastestTerrestrialAlphaTexture);
	gl.uniform1i(cityFastestTerrestrialAlphaLocation, 4);

	gl.uniform1i(cityLinkOffsetsLocation, 0);
}

export function shapeToCode(shape: ConeShape): number {
	switch (shape) {
		case 'road':
			return 0;
		case 'fastest-terrestrial':
			return 1;
		default:
			return 2;
	}
}
