struct RawConeUniforms {
	roadAlphaRadians: f32,
	attenuationRadians: f32,
	shapeCode: f32,
	azimuthSampleCount: f32,
}

@group(0) @binding(0) var<storage, read> cityLinkOffsets: array<u32>;
@group(0) @binding(1) var<storage, read> cityLinkCounts: array<u32>;
@group(0) @binding(2) var<storage, read> cityLinkAzimuthRadians: array<f32>;
@group(0) @binding(3) var<storage, read> cityLinkAlphaRadians: array<f32>;
@group(0) @binding(4) var<storage, read> cityFastestTerrestrialAlphaRadians: array<f32>;
@group(0) @binding(5) var<uniform> uniforms: RawConeUniforms;
@group(0) @binding(6) var<storage, read_write> coneAlphaRadians: array<f32>;

fn selectComplexConeAlpha(cityIndex: u32, azimuthRadians: f32) -> f32 {
	let count = cityLinkCounts[cityIndex];
	if (count == 0u) {
		return uniforms.roadAlphaRadians;
	}

	let offset = cityLinkOffsets[cityIndex];
	let attenuationRadians = uniforms.attenuationRadians;
	var lowerDistance = 1e30;
	var upperDistance = 1e30;
	var lowerAlpha = uniforms.roadAlphaRadians;
	var upperAlpha = uniforms.roadAlphaRadians;

	for (var localIndex: u32 = 0u; localIndex < count; localIndex = localIndex + 1u) {
		let linkIndex = offset + localIndex;
		let linkAzimuth = cityLinkAzimuthRadians[linkIndex];
		let linkAlpha = cityLinkAlphaRadians[linkIndex];
		let candidateLowerDistance = positive_angle(azimuthRadians - linkAzimuth);
		let candidateUpperDistance = positive_angle(linkAzimuth - azimuthRadians);
		if (
			candidateLowerDistance < lowerDistance - ANGULAR_EPSILON ||
			(abs(candidateLowerDistance - lowerDistance) <= ANGULAR_EPSILON && linkAlpha < lowerAlpha)
		) {
			lowerDistance = candidateLowerDistance;
			lowerAlpha = linkAlpha;
		}
		if (
			candidateUpperDistance < upperDistance - ANGULAR_EPSILON ||
			(abs(candidateUpperDistance - upperDistance) <= ANGULAR_EPSILON && linkAlpha < upperAlpha)
		) {
			upperDistance = candidateUpperDistance;
			upperAlpha = linkAlpha;
		}
	}

	if (lowerDistance > attenuationRadians + ANGULAR_EPSILON) {
		lowerDistance = attenuationRadians;
		lowerAlpha = uniforms.roadAlphaRadians;
	} else {
		lowerDistance = min(lowerDistance, attenuationRadians);
	}
	if (upperDistance > attenuationRadians + ANGULAR_EPSILON) {
		upperDistance = attenuationRadians;
		upperAlpha = uniforms.roadAlphaRadians;
	} else {
		upperDistance = min(upperDistance, attenuationRadians);
	}

	let span = lowerDistance + upperDistance;
	let interpolation = 0.0;
	if (span > 0.0) {
		interpolation = smoothstep(0.0, span, lowerDistance);
	}
	return lowerAlpha + interpolation * (upperAlpha - lowerAlpha);
}

fn selectConeAlpha(cityIndex: u32, azimuthRadians: f32) -> f32 {
	let shapeCode = i32(uniforms.shapeCode + 0.5);
	if (shapeCode == 0) {
		return uniforms.roadAlphaRadians;
	}
	if (shapeCode == 1) {
		return cityFastestTerrestrialAlphaRadians[cityIndex];
	}
	return selectComplexConeAlpha(cityIndex, azimuthRadians);
}

@compute @workgroup_size(1, 1, 1)
fn main(@builtin(global_invocation_id) globalInvocationId: vec3<u32>) {
	let sampleIndex = globalInvocationId.x;
	let cityIndex = globalInvocationId.y;
	let azimuthSampleCount = u32(uniforms.azimuthSampleCount + 0.5);
	let azimuthRadians = (f32(sampleIndex) * TWO_PI) / uniforms.azimuthSampleCount;
	let outputIndex = cityIndex * azimuthSampleCount + sampleIndex;
	coneAlphaRadians[outputIndex] = selectConeAlpha(cityIndex, azimuthRadians);
}
