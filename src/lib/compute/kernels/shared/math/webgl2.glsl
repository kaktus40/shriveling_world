#define PI 3.1415926535897932384626433832795
#define TWO_PI 6.283185307179586476925286766559
#define ANGULAR_EPSILON 1e-6

float positive_angle(float angleRadians) {
	float remainder = mod(angleRadians, TWO_PI);
	if (remainder < 0.0) {
		remainder += TWO_PI;
	}
	return remainder;
}

int positive_mod_i32(int value, int modulus) {
	int remainder = value % modulus;
	if (remainder < 0) {
		remainder += modulus;
	}
	return remainder;
}

float signed_angle_delta(float angleRadians) {
	return positive_angle(angleRadians + PI) - PI;
}

float shift_angle_near(float angleRadians, float referenceRadians) {
	float shifted = angleRadians;
	while (shifted - referenceRadians > PI) {
		shifted -= TWO_PI;
	}
	while (referenceRadians - shifted > PI) {
		shifted += TWO_PI;
	}
	return shifted;
}

bool is_angle_inside_continuous_interval(float angleRadians, float minRadians, float maxRadians) {
	float centerRadians = (minRadians + maxRadians) * 0.5;
	float shifted = shift_angle_near(angleRadians, centerRadians);
	return shifted >= minRadians && shifted <= maxRadians;
}

vec2 lonlat_from_nvector(vec3 nvector) {
	vec3 normalized = normalize(nvector);
	float latitude = atan(normalized.z, length(normalized.xy));
	float longitude = atan(normalized.y, normalized.x);
	return vec2(positive_angle(longitude + PI) - PI, latitude);
}

vec3 great_circle_from_bearing(vec3 townNVector, vec3 north, vec3 east, float azimuthRadians) {
	vec3 direction = normalize(north * cos(azimuthRadians) + east * sin(azimuthRadians));
	return normalize(cross(townNVector, direction));
}

float initial_bearing_radians(vec3 north, vec3 east, vec3 targetNVector) {
	float sine = dot(targetNVector, east);
	float cosine = dot(targetNVector, north);
	float bearing = atan(sine, cosine);
	return positive_angle(bearing);
}

float angular_distance_radians(vec3 a, vec3 b) {
	return acos(clamp(dot(normalize(a), normalize(b)), -1.0, 1.0));
}

bool isPreferredIntersection(
	float distanceMeters,
	uint neighborCityIndex,
	uint faceIndex,
	float bestDistanceMeters,
	uint winningNeighborCityIndex,
	uint winningFaceIndex
) {
	return (
		distanceMeters < bestDistanceMeters ||
		(
			distanceMeters == bestDistanceMeters &&
			winningNeighborCityIndex != 0xffffffffu &&
			(
				neighborCityIndex < winningNeighborCityIndex ||
				(neighborCityIndex == winningNeighborCityIndex && faceIndex < winningFaceIndex)
			)
		)
	);
}
