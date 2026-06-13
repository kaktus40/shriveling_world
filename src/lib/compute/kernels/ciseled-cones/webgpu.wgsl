const UNUSED_INDEX: u32 = 0xffffffffu;

struct CiseledConeUniforms {
	counts: vec4<u32>,
	heuristics: vec4<f32>,
}

struct FaceIntersectionState {
	bestDistanceMeters: f32,
	winningNeighborCityIndex: u32,
	winningFaceIndex: u32,
}

@group(0) @binding(0) var<storage, read> city_matrices: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read> overlap_candidates: array<u32>;
@group(0) @binding(2) var<storage, read> overlap_candidate_counts: array<u32>;
@group(0) @binding(3) var<storage, read> raw_cone_rim_ecef: array<vec4<f32>>;
@group(0) @binding(4) var<storage, read> city_pair_invariants: array<vec4<f32>>;
@group(0) @binding(5) var<storage, read> cone_alpha_radians: array<f32>;
@group(0) @binding(6) var<uniform> uniforms: CiseledConeUniforms;
@group(0) @binding(7) var<storage, read_write> cone_intersection_distance_meters: array<f32>;
@group(0) @binding(8) var<storage, read_write> ciseled_cone_rim_ecef: array<vec4<f32>>;

fn read_city_summit(city_index: u32) -> vec3<f32> {
	let matrix_base = city_index * 4u;
	return city_matrices[matrix_base + 3u].xyz;
}

fn read_raw_rim(city_index: u32, sample_index: u32) -> vec3<f32> {
	let azimuth_sample_count = uniforms.counts.y;
	let rim_index = city_index * azimuth_sample_count + sample_index;
	return raw_cone_rim_ecef[rim_index].xyz;
}

fn read_city_pair_invariants(city_a_index: u32, city_b_index: u32) -> vec4<f32> {
	let pair_index = city_a_index * uniforms.counts.x + city_b_index;
	return city_pair_invariants[pair_index];
}

fn read_cone_alpha(city_index: u32, sample_index: u32) -> f32 {
	let azimuth_sample_count = uniforms.counts.y;
	return cone_alpha_radians[city_index * azimuth_sample_count + sample_index];
}

fn is_fast_face(city_index: u32, face_index: u32, road_alpha_radians: f32, alpha_epsilon_radians: f32) -> bool {
	let azimuth_sample_count = uniforms.counts.y;
	let next_face_index = (face_index + 1u) % azimuth_sample_count;
	return read_cone_alpha(city_index, face_index) < road_alpha_radians - alpha_epsilon_radians ||
		read_cone_alpha(city_index, next_face_index) < road_alpha_radians - alpha_epsilon_radians;
}

fn is_on_directed_corridor(
	face_index: i32,
	start_face_index: i32,
	end_face_index: i32,
	direction: i32,
	face_count: i32,
) -> bool {
	let corridor_length = if (direction > 0) {
		positive_mod_i32(end_face_index - start_face_index, face_count)
	} else {
		positive_mod_i32(start_face_index - end_face_index, face_count)
	};
	let corridor_distance = if (direction > 0) {
		positive_mod_i32(face_index - start_face_index, face_count)
	} else {
		positive_mod_i32(start_face_index - face_index, face_count)
	};
	return corridor_distance <= corridor_length;
}

fn is_priority_face(
	city_index: u32,
	face_index: u32,
	start_face_index: i32,
	end_face_index: i32,
	direction: i32,
	face_count: i32,
	road_alpha_radians: f32,
	alpha_epsilon_radians: f32,
	bilateral_neighborhood_face_count: u32,
) -> bool {
	if (is_on_directed_corridor(i32(face_index), start_face_index, end_face_index, direction, face_count)) {
		return true;
	}

	let before_start_face_index = positive_mod_i32(start_face_index - direction, face_count);
	let after_end_face_index = positive_mod_i32(end_face_index + direction, face_count);
	if (face_index == u32(before_start_face_index) || face_index == u32(after_end_face_index)) {
		return true;
	}

	for (var distance: u32 = 1u; distance <= bilateral_neighborhood_face_count; distance = distance + 1u) {
		let lower_face_index = positive_mod_i32(start_face_index - i32(distance), face_count);
		let upper_face_index = positive_mod_i32(start_face_index + i32(distance), face_count);
		if (
			(face_index == u32(lower_face_index) || face_index == u32(upper_face_index)) &&
			is_fast_face(city_index, face_index, road_alpha_radians, alpha_epsilon_radians)
		) {
			return true;
		}
	}

	return false;
}

fn intersect_candidate_face(
	ray_origin: vec3<f32>,
	ray_direction: vec3<f32>,
	neighbor_city_index: u32,
	face_index: u32,
	neighbor_summit: vec3<f32>,
	best_distance_meters: f32,
	winning_neighbor_city_index: u32,
	winning_face_index: u32,
) -> FaceIntersectionState {
	let azimuth_sample_count = uniforms.counts.y;
	let next_face_index = (face_index + 1u) % azimuth_sample_count;
	let rim0 = read_raw_rim(neighbor_city_index, face_index);
	let rim1 = read_raw_rim(neighbor_city_index, next_face_index);
	let distance_meters = intersect_ray_triangle_double_sided(
		ray_origin,
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
		return FaceIntersectionState(
			distance_meters,
			neighbor_city_index,
			face_index,
		);
	}
	return FaceIntersectionState(best_distance_meters, winning_neighbor_city_index, winning_face_index);
}

@compute @workgroup_size(1, 1, 1)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
	let sample_index = global_id.x;
	let city_index = global_id.y;
	let city_count = uniforms.counts.x;
	let azimuth_sample_count = uniforms.counts.y;
	let neighbor_limit = uniforms.counts.z;
	let road_alpha_radians = uniforms.heuristics.x;
	let bilateral_neighborhood_face_count = u32(uniforms.heuristics.y + 0.5);
	let alpha_epsilon_radians = uniforms.heuristics.z;

	if (city_index >= city_count || sample_index >= azimuth_sample_count) {
		return;
	}

	let ray_index = city_index * azimuth_sample_count + sample_index;
	let ray_origin = read_city_summit(city_index);
	let raw_rim = raw_cone_rim_ecef[ray_index].xyz;
	var ray_direction = raw_rim - ray_origin;
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
	let sample_step_radians = TWO_PI / f32(azimuth_sample_count);

	let phi_a_radians = f32(sample_index) * sample_step_radians;
	let candidate_count = min(overlap_candidate_counts[city_index], neighbor_limit);
	for (var candidate_index: u32 = 0u; candidate_index < candidate_count; candidate_index = candidate_index + 1u) {
		let neighbor_index = overlap_candidates[city_index * neighbor_limit + candidate_index];
		if (neighbor_index == UNUSED_INDEX) {
			continue;
		}

		let city_pair = read_city_pair_invariants(city_index, neighbor_index);
		let gamma_ab_radians = city_pair.x;
		let gamma_ba_radians = city_pair.y;
		let phi_b0_radians = positive_angle(gamma_ba_radians - signed_angle_delta(phi_a_radians - gamma_ab_radians));
		let start_face_index = i32(min(floor(phi_b0_radians / sample_step_radians), f32(azimuth_sample_count - 1u)));
		let end_face_index = i32(min(floor(positive_angle(gamma_ba_radians) / sample_step_radians), f32(azimuth_sample_count - 1u)));
		let direction = if (signed_angle_delta(gamma_ba_radians - phi_b0_radians) < 0.0) { -1 } else { 1 };
		let face_count = i32(azimuth_sample_count);
		let neighbor_summit = read_city_summit(neighbor_index);
		let before_start_face_index = positive_mod_i32(start_face_index - direction, face_count);
		let after_end_face_index = positive_mod_i32(end_face_index + direction, face_count);

		var corridor_face_index = start_face_index;
		for (var visited: u32 = 0u; visited < azimuth_sample_count; visited = visited + 1u) {
			let next_face_index = u32(positive_mod_i32(corridor_face_index + direction, face_count));
			let state = intersect_candidate_face(
				ray_origin,
				ray_direction,
				neighbor_index,
				u32(corridor_face_index),
				neighbor_summit,
				best_distance_meters,
				winning_neighbor_city_index,
				winning_face_index,
			);
			best_distance_meters = state.bestDistanceMeters;
			winning_neighbor_city_index = state.winningNeighborCityIndex;
			winning_face_index = state.winningFaceIndex;
			if (corridor_face_index == end_face_index) {
				break;
			}
			corridor_face_index = i32(next_face_index);
		}

		if (u32(before_start_face_index) != u32(start_face_index)) {
			let state = intersect_candidate_face(
				ray_origin,
				ray_direction,
				neighbor_index,
				u32(before_start_face_index),
				neighbor_summit,
				best_distance_meters,
				winning_neighbor_city_index,
				winning_face_index,
			);
			best_distance_meters = state.bestDistanceMeters;
			winning_neighbor_city_index = state.winningNeighborCityIndex;
			winning_face_index = state.winningFaceIndex;
		}

		if (u32(after_end_face_index) != u32(end_face_index) && u32(after_end_face_index) != u32(before_start_face_index)) {
			let state = intersect_candidate_face(
				ray_origin,
				ray_direction,
				neighbor_index,
				u32(after_end_face_index),
				neighbor_summit,
				best_distance_meters,
				winning_neighbor_city_index,
				winning_face_index,
			);
			best_distance_meters = state.bestDistanceMeters;
			winning_neighbor_city_index = state.winningNeighborCityIndex;
			winning_face_index = state.winningFaceIndex;
		}

		for (var distance: u32 = 1u; distance <= bilateral_neighborhood_face_count; distance = distance + 1u) {
			let lower_face_index = positive_mod_i32(start_face_index - i32(distance), face_count);
			let upper_face_index = positive_mod_i32(start_face_index + i32(distance), face_count);
			if (
				u32(lower_face_index) != u32(before_start_face_index) &&
				u32(lower_face_index) != u32(after_end_face_index) &&
				is_fast_face(neighbor_index, u32(lower_face_index), road_alpha_radians, alpha_epsilon_radians) &&
				!is_on_directed_corridor(lower_face_index, start_face_index, end_face_index, direction, face_count)
			) {
				let lower_state = intersect_candidate_face(
					ray_origin,
					ray_direction,
					neighbor_index,
					u32(lower_face_index),
					neighbor_summit,
					best_distance_meters,
					winning_neighbor_city_index,
					winning_face_index,
				);
				best_distance_meters = lower_state.bestDistanceMeters;
				winning_neighbor_city_index = lower_state.winningNeighborCityIndex;
				winning_face_index = lower_state.winningFaceIndex;
			}
			if (
				upper_face_index != lower_face_index &&
				u32(upper_face_index) != u32(before_start_face_index) &&
				u32(upper_face_index) != u32(after_end_face_index) &&
				is_fast_face(neighbor_index, u32(upper_face_index), road_alpha_radians, alpha_epsilon_radians) &&
				!is_on_directed_corridor(upper_face_index, start_face_index, end_face_index, direction, face_count)
			) {
				let upper_state = intersect_candidate_face(
					ray_origin,
					ray_direction,
					neighbor_index,
					u32(upper_face_index),
					neighbor_summit,
					best_distance_meters,
					winning_neighbor_city_index,
					winning_face_index,
				);
				best_distance_meters = upper_state.bestDistanceMeters;
				winning_neighbor_city_index = upper_state.winningNeighborCityIndex;
				winning_face_index = upper_state.winningFaceIndex;
			}
		}

		for (var face_index: u32 = 0u; face_index < azimuth_sample_count; face_index = face_index + 1u) {
			if (
				is_priority_face(
					neighbor_index,
					face_index,
					start_face_index,
					end_face_index,
					direction,
					face_count,
					road_alpha_radians,
					alpha_epsilon_radians,
					bilateral_neighborhood_face_count,
				)
			) {
				continue;
			}

			let state = intersect_candidate_face(
				ray_origin,
				ray_direction,
				neighbor_index,
				face_index,
				neighbor_summit,
				best_distance_meters,
				winning_neighbor_city_index,
				winning_face_index,
			);
			best_distance_meters = state.bestDistanceMeters;
			winning_neighbor_city_index = state.winningNeighborCityIndex;
			winning_face_index = state.winningFaceIndex;
		}
	}

	cone_intersection_distance_meters[ray_index] = best_distance_meters;
	if (winning_neighbor_city_index != UNUSED_INDEX) {
		ciseled_cone_rim_ecef[ray_index] = vec4<f32>(ray_origin + ray_direction * best_distance_meters, 1.0);
	} else {
		ciseled_cone_rim_ecef[ray_index] = vec4<f32>(raw_rim, 1.0);
	}
}
