struct Params {
	earthRadiusMeters: f32,
	_padding0: vec3<f32>,
};

struct LonLatBuffer {
	values: array<vec2<f32>>,
};

struct MatrixBuffer {
	values: array<mat4x4<f32>>,
};

@group(0) @binding(0) var<storage, read> cityLonLat : LonLatBuffer;
@group(0) @binding(1) var<storage, read_write> cityMatrices : MatrixBuffer;
@group(0) @binding(2) var<uniform> params : Params;

fn build_ned_to_ecef_matrix(longitude: f32, latitude: f32, earthRadiusMeters: f32) -> mat4x4<f32> {
	let cosLongitude = cos(longitude);
	let sinLongitude = sin(longitude);
	let cosLatitude = cos(latitude);
	let sinLatitude = sin(latitude);

	let north = vec4<f32>(
		-cosLongitude * sinLatitude,
		-sinLongitude * sinLatitude,
		cosLatitude,
		0.0
	);
	let east = vec4<f32>(
		-sinLongitude,
		cosLongitude,
		0.0,
		0.0
	);
	let down = vec4<f32>(
		-cosLatitude * cosLongitude,
		-cosLatitude * sinLongitude,
		-sinLatitude,
		0.0
	);
	let translation = vec4<f32>(
		earthRadiusMeters * cosLatitude * cosLongitude,
		earthRadiusMeters * cosLatitude * sinLongitude,
		earthRadiusMeters * sinLatitude,
		1.0
	);

	return mat4x4<f32>(north, east, down, translation);
}

@compute @workgroup_size(1, 1, 1)
fn main(@builtin(global_invocation_id) globalId: vec3<u32>) {
	let cityIndex = globalId.x;
	cityMatrices.values[cityIndex] = build_ned_to_ecef_matrix(
		cityLonLat.values[cityIndex].x,
		cityLonLat.values[cityIndex].y,
		params.earthRadiusMeters
	);
}
