const RAY_TRIANGLE_DETERMINANT_EPSILON: f32 = 1e-7;
const RAY_ORIGIN_EPSILON_METERS: f32 = 1e-5;

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
