const TWO_PI: f32 = 6.283185307179586;
const RAY_TRIANGLE_DETERMINANT_EPSILON: f32 = 1e-7;
const RAY_ORIGIN_EPSILON_METERS: f32 = 1e-5;
const UNUSED_INDEX: u32 = 0xffffffffu;

struct CiseledConeUniforms {
	values: vec4<u32>,
}

@group(0) @binding(0) var<storage, read> city_matrices: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read> overlap_candidates: array<u32>;
@group(0) @binding(2) var<storage, read> overlap_candidate_counts: array<u32>;
@group(0) @binding(3) var<storage, read> raw_cone_rim_ecef: array<vec4<f32>>;
@group(0) @binding(4) var<uniform> uniforms: CiseledConeUniforms;
@group(0) @binding(5) var<storage, read_write> cone_intersection_distance_meters: array<f32>;
@group(0) @binding(6) var<storage, read_write> ciseled_cone_rim_ecef: array<vec4<f32>>;

fn read_city_summit(city_index: u32) -> vec3<f32> {
	let matrix_base = city_index * 4u;
	return city_matrices[matrix_base + 3u].xyz;
}

fn read_raw_rim(city_index: u32, sample_index: u32) -> vec3<f32> {
	let azimuth_sample_count = uniforms.values.y;
	let rim_index = city_index * azimuth_sample_count + sample_index;
	return raw_cone_rim_ecef[rim_index].xyz;
}

fn intersect_ray_triangle_double_sided(
	ray_origin: vec3<f32>,
	ray_direction: vec3<f32>,
	vertex0: vec3<f32>,
	vertex1: vec3<f32>,
	vertex2: vec3<f32>,
	maximum_distance_meters: f32,
) -> f32 {
	let edge1 = vertex1 - vertex0;
	let edge2 = vertex2 - vertex0;
	let p = cross(ray_direction, edge2);
	let determinant = dot(edge1, p);
	if (abs(determinant) <= RAY_TRIANGLE_DETERMINANT_EPSILON) {
		return -1.0;
	}

	let inverse_determinant = 1.0 / determinant;
	let translated = ray_origin - vertex0;
	let u = dot(translated, p) * inverse_determinant;
	if (u < 0.0 || u > 1.0) {
		return -1.0;
	}

	let q = cross(translated, edge1);
	let v = dot(ray_direction, q) * inverse_determinant;
	if (v < 0.0 || u + v > 1.0) {
		return -1.0;
	}

	let distance_meters = dot(edge2, q) * inverse_determinant;
	if (distance_meters > RAY_ORIGIN_EPSILON_METERS && distance_meters <= maximum_distance_meters) {
		return distance_meters;
	}
	return -1.0;
}

fn is_preferred_intersection(
	distance_meters: f32,
	neighbor_city_index: u32,
	face_index: u32,
	best_distance_meters: f32,
	winning_neighbor_city_index: u32,
	winning_face_index: u32,
) -> bool {
	return distance_meters < best_distance_meters ||
		(distance_meters == best_distance_meters &&
			winning_neighbor_city_index != UNUSED_INDEX &&
			(neighbor_city_index < winning_neighbor_city_index ||
				(neighbor_city_index == winning_neighbor_city_index && face_index < winning_face_index)));
}

@compute @workgroup_size(1, 1, 1)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
	let sample_index = global_id.x;
	let city_index = global_id.y;
	let city_count = uniforms.values.x;
	let azimuth_sample_count = uniforms.values.y;
	let neighbor_limit = uniforms.values.z;

	if (city_index >= city_count || sample_index >= azimuth_sample_count) {
		return;
	}

	let ray_index = city_index * azimuth_sample_count + sample_index;
	let summit = read_city_summit(city_index);
	let raw_rim = raw_cone_rim_ecef[ray_index].xyz;
	var ray_direction = raw_rim - summit;
	let raw_distance_meters = length(ray_direction);
	if (!(raw_distance_meters > RAY_ORIGIN_EPSILON_METERS)) {
		cone_intersection_distance_meters[ray_index] = 0.0;
		ciseled_cone_rim_ecef[ray_index] = vec4<f32>(raw_rim, 1.0);
		return;
	}
	ray_direction = ray_direction / raw_distance_meters;

	var best_distance_meters = raw_distance_meters;
	var winning_neighbor_city_index = UNUSED_INDEX;
	var winning_face_index = UNUSED_INDEX;

	let candidate_count = overlap_candidate_counts[city_index];
	for (var candidate_index: u32 = 0u; candidate_index < candidate_count; candidate_index = candidate_index + 1u) {
		let neighbor_city_index = overlap_candidates[city_index * neighbor_limit + candidate_index];
		let neighbor_summit = read_city_summit(neighbor_city_index);

		for (var face_index: u32 = 0u; face_index < azimuth_sample_count; face_index = face_index + 1u) {
			let next_face_index = (face_index + 1u) % azimuth_sample_count;
			let rim0 = read_raw_rim(neighbor_city_index, face_index);
			let rim1 = read_raw_rim(neighbor_city_index, next_face_index);
			let distance_meters = intersect_ray_triangle_double_sided(
				summit,
				ray_direction,
				neighbor_summit,
				rim0,
				rim1,
				best_distance_meters,
			);
			if (
				distance_meters > 0.0 &&
				is_preferred_intersection(
					distance_meters,
					neighbor_city_index,
					face_index,
					best_distance_meters,
					winning_neighbor_city_index,
					winning_face_index,
				)
			) {
				best_distance_meters = distance_meters;
				winning_neighbor_city_index = neighbor_city_index;
				winning_face_index = face_index;
			}
		}
	}

	cone_intersection_distance_meters[ray_index] = best_distance_meters;
	if (winning_neighbor_city_index != UNUSED_INDEX) {
		ciseled_cone_rim_ecef[ray_index] = vec4<f32>(summit + ray_direction * best_distance_meters, 1.0);
	} else {
		ciseled_cone_rim_ecef[ray_index] = vec4<f32>(raw_rim, 1.0);
	}
}
