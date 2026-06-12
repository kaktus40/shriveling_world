struct FinalConeUniforms {
	values: vec4<f32>,
}

@group(0) @binding(0) var<storage, read> ciseled_cone_rim_ecef: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read> town_boundary_angular: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> town_boundary_ecef: array<vec4<f32>>;
@group(0) @binding(3) var<uniform> uniforms: FinalConeUniforms;
@group(0) @binding(4) var<storage, read_write> final_cone_geometry_ecef: array<vec4<f32>>;

@compute @workgroup_size(1, 1, 1)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
	let sample_index = global_id.x;
	let city_index = global_id.y;
	let city_count = u32(uniforms.values.y);
	let azimuth_sample_count = u32(uniforms.values.z);
	if (city_index >= city_count || sample_index >= azimuth_sample_count) {
		return;
	}

	let ray_index = city_index * azimuth_sample_count + sample_index;
	let angular_offset = ray_index * 4u;
	let ciseled = ciseled_cone_rim_ecef[ray_index];
	let boundary_angular = town_boundary_angular[ray_index];
	let boundary = town_boundary_ecef[ray_index];
	let ciseled_distance = length(ciseled.xyz);
	let boundary_distance = boundary_angular.z * uniforms.values.x;
	var final_rim = ciseled;
	if (boundary_angular.w > 0.0 && boundary_distance > 0.0 && boundary_distance < ciseled_distance) {
		final_rim = vec4<f32>(boundary.xyz, 1.0);
	}
	final_cone_geometry_ecef[ray_index] = final_rim;
}
