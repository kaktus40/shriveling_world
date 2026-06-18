const PI: f32 = 3.141592653589793;
const TWO_PI: f32 = 6.283185307179586;
const ANGULAR_EPSILON: f32 = 1e-6;

fn positive_angle(angle_radians: f32) -> f32 {
	var remainder = angle_radians % TWO_PI;
	if (remainder < 0.0) {
		remainder = remainder + TWO_PI;
	}
	return remainder;
}

fn positive_mod_i32(value: i32, modulus: i32) -> i32 {
	var remainder = value % modulus;
	if (remainder < 0) {
		remainder = remainder + modulus;
	}
	return remainder;
}

fn signed_angle_delta(angle_radians: f32) -> f32 {
	return positive_angle(angle_radians + PI) - PI;
}

fn shift_angle_near(angle_radians: f32, reference_radians: f32) -> f32 {
	var shifted = angle_radians;
	loop {
		if (shifted - reference_radians <= PI) {
			break;
		}
		shifted = shifted - TWO_PI;
	}
	loop {
		if (reference_radians - shifted <= PI) {
			break;
		}
		shifted = shifted + TWO_PI;
	}
	return shifted;
}

fn is_angle_inside_continuous_interval(angle_radians: f32, min_radians: f32, max_radians: f32) -> bool {
	let center_radians = (min_radians + max_radians) * 0.5;
	let shifted = shift_angle_near(angle_radians, center_radians);
	return shifted >= min_radians && shifted <= max_radians;
}

fn lonlat_from_nvector(nvector: vec3<f32>) -> vec2<f32> {
	let normalized = normalize(nvector);
	let latitude = atan2(normalized.z, sqrt(normalized.x * normalized.x + normalized.y * normalized.y));
	let longitude = atan2(normalized.y, normalized.x);
	return vec2<f32>(positive_angle(longitude + PI) - PI, latitude);
}

fn great_circle_from_bearing(town_nvector: vec3<f32>, north: vec3<f32>, east: vec3<f32>, azimuth_radians: f32) -> vec3<f32> {
	let direction = normalize(north * cos(azimuth_radians) + east * sin(azimuth_radians));
	return normalize(cross(town_nvector, direction));
}

fn initial_bearing_radians(north: vec3<f32>, east: vec3<f32>, target_nvector: vec3<f32>) -> f32 {
	let sine = dot(target_nvector, east);
	let cosine = dot(target_nvector, north);
	let bearing = atan2(sine, cosine);
	return positive_angle(bearing);
}

fn angular_distance_radians(a: vec3<f32>, b: vec3<f32>) -> f32 {
	return acos(clamp(dot(normalize(a), normalize(b)), -1.0, 1.0));
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
		(
			distance_meters == best_distance_meters &&
			winning_neighbor_city_index != 0xffffffffu &&
			(
				neighbor_city_index < winning_neighbor_city_index ||
				(neighbor_city_index == winning_neighbor_city_index && face_index < winning_face_index)
			)
		);
}
const PI: f32 = 3.1415926535897932384626433832795;
const ECKERT_CONST: f32 = 2.26750802723822639138;
const ECKERT_ITERATION: i32 = 40;

fn delta_eckert(theta: f32, phi: f32) -> f32 {
	return -(theta + sin(theta) - 2.57079632679489661923 * sin(phi)) /
		(1.0 + cos(theta));
}

fn project_globe(pos: vec3<f32>, globe_radius: f32, earth_radius: f32) -> vec3<f32> {
	let radius = (earth_radius + pos.z) / earth_radius * globe_radius;
	return vec3<f32>(
		cos(pos.x) * radius * cos(pos.y),
		sin(pos.y) * radius,
		sin(pos.x) * radius * cos(pos.y),
	);
}

fn project_equirectangular(pos: vec3<f32>, globe_radius: f32, earth_radius: f32, reference: vec3<f32>, zz_coeff: f32) -> vec3<f32> {
	return vec3<f32>(
		(pos.x - reference.x) * cos(reference.y) * globe_radius,
		(pos.y - reference.y) * globe_radius,
		(pos.z - reference.z) / earth_radius * globe_radius * zz_coeff,
	);
}

fn project_mercator(pos: vec3<f32>, globe_radius: f32, earth_radius: f32, lambda0: f32, zz_coeff: f32) -> vec3<f32> {
	let clamped_latitude = clamp(pos.y, -1.48352986419518, 1.48352986419518);
	return vec3<f32>(
		(pos.x - lambda0) * globe_radius,
		log(tan(PI / 4.0 + clamped_latitude / 2.0)) * globe_radius,
		pos.z / earth_radius * globe_radius * zz_coeff,
	);
}

fn project_winkel_tripel(pos: vec3<f32>, globe_radius: f32, earth_radius: f32, reference: vec3<f32>, zz_coeff: f32) -> vec3<f32> {
	let cos_phi = cos(pos.y);
	let sin_phi = sin(pos.y);
	let alpha = acos(cos_phi * cos(pos.x / 2.0));
	let cardinal_alpha = select(sin(alpha) / alpha, 1.0, abs(alpha) < 0.0000001);
	return vec3<f32>(
		(((pos.x - reference.x) * cos(reference.y)) +
			(2.0 * cos_phi * sin(pos.x / 2.0)) / cardinal_alpha) *
			(globe_radius / 2.0),
		((pos.y - reference.y) + sin_phi / cardinal_alpha) * (globe_radius / 2.0),
		(pos.z - reference.z) / earth_radius * globe_radius * zz_coeff,
	);
}

fn project_eckert_vi(pos: vec3<f32>, globe_radius: f32, earth_radius: f32, reference: vec3<f32>, zz_coeff: f32) -> vec3<f32> {
	var theta = reference.y;
	for (var i: i32 = 0; i < ECKERT_ITERATION; i = i + 1) {
		theta = theta + delta_eckert(theta, pos.y);
	}
	return vec3<f32>(
		(pos.x - reference.x) * (1.0 + cos(theta)) / ECKERT_CONST * globe_radius,
		2.0 * theta / ECKERT_CONST * globe_radius,
		(pos.z - reference.z) / earth_radius * globe_radius * zz_coeff,
	);
}

fn project_van_der_grinten_i(pos: vec3<f32>, globe_radius: f32, earth_radius: f32, reference: vec3<f32>, zz_coeff: f32) -> vec3<f32> {
	var result = vec3<f32>(0.0);
	result.z = (pos.z - reference.z) / earth_radius * globe_radius * zz_coeff;
	let theta = asin(abs(2.0 * pos.y / PI));
	if (abs(pos.x - reference.x) < 0.000001 || abs(theta - PI / 2.0) < 0.000001) {
		result.y = sign(pos.y) * PI * globe_radius * tan(theta / 2.0);
	} else if (abs(pos.y) < 0.000001) {
		result.x = (pos.x - reference.x) * globe_radius;
	} else {
		let delta = pos.x - reference.x;
		let A = 0.5 * abs(PI / delta - delta / PI);
		let sin_theta = sin(theta);
		let cos_theta = cos(theta);
		let G = cos_theta / (sin_theta + cos_theta - 1.0);
		let P = G * (2.0 / sin_theta - 1.0);
		let Q = A * A + G;
		let A2 = A * A;
		let P2 = P * P;
		let denominateur = P2 + A2;
		result.x = sign(delta) * PI * globe_radius / denominateur *
			(A * (G - P2) + sqrt(max(0.0, (A * (G - P2)) * (A * (G - P2)) - (P2 + A2) * (G * G - P2))));
		result.y = sign(pos.y) * PI * globe_radius / denominateur *
			abs(P * Q - A * sqrt(max(0.0, (A2 + 1.0) * denominateur - Q * Q)));
	}
	return result;
}

fn project_conic_equidistant(pos: vec3<f32>, globe_radius: f32, earth_radius: f32, reference: vec3<f32>, standard_parallel1: f32, standard_parallel2: f32, zz_coeff: f32) -> vec3<f32> {
	let n = (cos(standard_parallel1) - cos(standard_parallel2)) /
		(standard_parallel2 - standard_parallel1);
	let G = cos(standard_parallel1) / n + standard_parallel1;
	let rho0 = G - reference.y;
	let theta = n * (pos.x - reference.x);
	let rho = G - pos.y;
	return vec3<f32>(
		rho * sin(theta) * globe_radius,
		(rho0 - rho * cos(theta)) * globe_radius,
		(pos.z - reference.z) / earth_radius * globe_radius * zz_coeff,
	);
}

fn project_display(
	pos: vec3<f32>,
	globe_radius: f32,
	earth_radius: f32,
	reference: vec3<f32>,
	standard_parallel1: f32,
	standard_parallel2: f32,
	projection_init: i32,
	projection_end: i32,
	percent: f32,
	zz_coeff: f32,
) -> vec3<f32> {
	var init_vec: vec3<f32>;
	var end_vec: vec3<f32>;
	if (projection_init == 0) {
		init_vec = project_globe(pos, globe_radius, earth_radius);
	} else if (projection_init == 1) {
		init_vec = project_equirectangular(pos, globe_radius, earth_radius, reference, zz_coeff);
	} else if (projection_init == 2) {
		init_vec = project_mercator(pos, globe_radius, earth_radius, reference.x, zz_coeff);
	} else if (projection_init == 3) {
		init_vec = project_winkel_tripel(pos, globe_radius, earth_radius, reference, zz_coeff);
	} else if (projection_init == 4) {
		init_vec = project_eckert_vi(pos, globe_radius, earth_radius, reference, zz_coeff);
	} else if (projection_init == 5) {
		init_vec = project_van_der_grinten_i(pos, globe_radius, earth_radius, reference, zz_coeff);
	} else {
		init_vec = project_conic_equidistant(pos, globe_radius, earth_radius, reference, standard_parallel1, standard_parallel2, zz_coeff);
	}
	if (projection_init == projection_end) {
		return init_vec;
	}
	if (projection_end == 0) {
		end_vec = project_globe(pos, globe_radius, earth_radius);
	} else if (projection_end == 1) {
		end_vec = project_equirectangular(pos, globe_radius, earth_radius, reference, zz_coeff);
	} else if (projection_end == 2) {
		end_vec = project_mercator(pos, globe_radius, earth_radius, reference.x, zz_coeff);
	} else if (projection_end == 3) {
		end_vec = project_winkel_tripel(pos, globe_radius, earth_radius, reference, zz_coeff);
	} else if (projection_end == 4) {
		end_vec = project_eckert_vi(pos, globe_radius, earth_radius, reference, zz_coeff);
	} else if (projection_end == 5) {
		end_vec = project_van_der_grinten_i(pos, globe_radius, earth_radius, reference, zz_coeff);
	} else {
		end_vec = project_conic_equidistant(pos, globe_radius, earth_radius, reference, standard_parallel1, standard_parallel2, zz_coeff);
	}
	return mix(init_vec, end_vec, percent / 100.0);
}

fn ecef_to_geographic(pos: vec3<f32>, earth_radius: f32) -> vec3<f32> {
	let radius = length(pos);
	if (radius <= 0.0) {
		return vec3<f32>(0.0, 0.0, 0.0);
	}
	let longitude = atan2(pos.y, pos.x);
	let latitude = asin(clamp(pos.z / radius, -1.0, 1.0));
	return vec3<f32>(longitude, latitude, radius - earth_radius);
}

fn project_display_from_ecef(
	pos: vec3<f32>,
	globe_radius: f32,
	earth_radius: f32,
	reference: vec3<f32>,
	standard_parallel1: f32,
	standard_parallel2: f32,
	projection_init: i32,
	projection_end: i32,
	percent: f32,
	zz_coeff: f32,
) -> vec3<f32> {
	let geographic = ecef_to_geographic(pos, earth_radius);
	return project_display(
		geographic,
		globe_radius,
		earth_radius,
		reference,
		standard_parallel1,
		standard_parallel2,
		projection_init,
		projection_end,
		percent,
		zz_coeff,
	);
}
struct FinalConeUniforms {
	values: vec4<f32>,
	projection: vec4<f32>,
	projection_settings_a: vec4<f32>,
	projection_settings_b: vec4<f32>,
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
	let projected = project_display_from_ecef(
		final_rim.xyz,
		uniforms.values.w,
		uniforms.values.x,
		uniforms.projection_settings_a.xyz,
		uniforms.projection_settings_a.w,
		uniforms.projection_settings_b.x,
		i32(uniforms.projection.x),
		i32(uniforms.projection.y),
		uniforms.projection.z,
		uniforms.projection_settings_b.y,
	);
	final_cone_geometry_ecef[ray_index] = vec4<f32>(projected, 1.0);
}
