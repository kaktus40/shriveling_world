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
