#define RAY_TRIANGLE_DETERMINANT_EPSILON 1e-7
#define RAY_ORIGIN_EPSILON_METERS 1e-5

float intersectRayTriangleDoubleSided(
	vec3 rayOrigin,
	vec3 rayDirection,
	vec3 vertex0,
	vec3 vertex1,
	vec3 vertex2,
	float maximumDistanceMeters
) {
	vec3 edge1 = vertex1 - vertex0;
	vec3 edge2 = vertex2 - vertex0;
	vec3 p = cross(rayDirection, edge2);
	float determinant = dot(edge1, p);
	if (abs(determinant) <= RAY_TRIANGLE_DETERMINANT_EPSILON) {
		return -1.0;
	}

	float inverseDeterminant = 1.0 / determinant;
	vec3 translated = rayOrigin - vertex0;
	float u = dot(translated, p) * inverseDeterminant;
	if (u < 0.0 || u > 1.0) {
		return -1.0;
	}

	vec3 q = cross(translated, edge1);
	float v = dot(rayDirection, q) * inverseDeterminant;
	if (v < 0.0 || u + v > 1.0) {
		return -1.0;
	}

	float distanceMeters = dot(edge2, q) * inverseDeterminant;
	if (!(distanceMeters > RAY_ORIGIN_EPSILON_METERS && distanceMeters <= maximumDistanceMeters)) {
		return -1.0;
	}

	return distanceMeters;
}
