#version 300 es

precision highp float;
precision highp int;

#define PI 3.1415926535897932384626433832795
#define TWO_PI 6.283185307179586476925286766559
#define EPSILON 1e-6

uniform sampler2D u_cityMatrices;
uniform isampler2D u_cityContourIndexes;
uniform sampler2D u_contourNVectors;
uniform isampler2D u_contourOffsets;
uniform isampler2D u_contourSizes;
uniform sampler2D u_azimuthIntervals;
uniform vec4 u_uniforms;

out vec4 tf_boundaryAngular;
out vec4 tf_boundaryEcef;

vec3 readContourNVector(int pointIndex) {
	return texelFetch(u_contourNVectors, ivec2(pointIndex, 0), 0).xyz;
}

vec2 lonLatFromNVector(vec3 nvector) {
	vec3 normalized = normalize(nvector);
	float latitude = atan(normalized.z, sqrt(normalized.x * normalized.x + normalized.y * normalized.y));
	float longitude = atan(normalized.y, normalized.x);
	while (longitude > PI) {
		longitude -= TWO_PI;
	}
	while (longitude < -PI) {
		longitude += TWO_PI;
	}
	return vec2(longitude, latitude);
}

float shiftAngleNear(float angleRadians, float referenceRadians) {
	float shifted = angleRadians;
	while (shifted - referenceRadians > PI) {
		shifted -= TWO_PI;
	}
	while (referenceRadians - shifted > PI) {
		shifted += TWO_PI;
	}
	return shifted;
}

bool isAngleInsideContinuousInterval(float angleRadians, float minRadians, float maxRadians) {
	float centerRadians = (minRadians + maxRadians) * 0.5;
	float shifted = shiftAngleNear(angleRadians, centerRadians);
	return shifted >= minRadians && shifted <= maxRadians;
}

vec3 greatCircleFromBearing(vec3 townNvector, vec3 north, vec3 east, float azimuthRadians) {
	vec3 direction = normalize(north * cos(azimuthRadians) + east * sin(azimuthRadians));
	return normalize(cross(townNvector, direction));
}

float initialBearingRadians(vec3 north, vec3 east, vec3 targetNvector) {
	float sine = dot(targetNvector, east);
	float cosine = dot(targetNvector, north);
	float bearing = atan(sine, cosine);
	return bearing < 0.0 ? bearing + TWO_PI : bearing;
}

float angularDistanceRadians(vec3 a, vec3 b) {
	return acos(clamp(dot(normalize(a), normalize(b)), -1.0, 1.0));
}

vec3 intersectGreatCircleWithSegment(vec3 greatCircleNormal, vec3 segmentStart, vec3 segmentEnd) {
	vec3 bounds = segmentEnd - segmentStart;
	float denominator = dot(bounds, greatCircleNormal);
	if (abs(denominator) <= EPSILON) {
		return vec3(0.0);
	}
	float ratio = -dot(segmentStart, greatCircleNormal) / denominator;
	if (ratio < 0.0 || ratio > 1.0) {
		return vec3(0.0);
	}
	return normalize(segmentStart + bounds * ratio);
}

void main() {
	uint flatIndex = uint(gl_InstanceID);
	uint cityCount = uint(u_uniforms.y);
	uint azimuthIntervalCount = uint(u_uniforms.z);
	uint contourCount = uint(u_uniforms.w);

	if (cityCount == 0u || azimuthIntervalCount == 0u) {
		tf_boundaryAngular = vec4(0.0);
		tf_boundaryEcef = vec4(0.0);
		gl_Position = vec4(0.0, 0.0, 0.0, 1.0);
		return;
	}

	uint cityIndex = flatIndex / azimuthIntervalCount;
	uint azimuthIndex = flatIndex - cityIndex * azimuthIntervalCount;
	if (cityIndex >= cityCount || azimuthIndex >= azimuthIntervalCount) {
		tf_boundaryAngular = vec4(0.0);
		tf_boundaryEcef = vec4(0.0);
		gl_Position = vec4(0.0, 0.0, 0.0, 1.0);
		return;
	}

	int matrixBase = int(cityIndex);
	vec3 townNvector = normalize(texelFetch(u_cityMatrices, ivec2(3, matrixBase), 0).xyz);
	vec3 north = texelFetch(u_cityMatrices, ivec2(0, matrixBase), 0).xyz;
	vec3 east = texelFetch(u_cityMatrices, ivec2(1, matrixBase), 0).xyz;
	ivec2 intervalCoords = ivec2(int(azimuthIndex), 0);
	vec2 interval = texelFetch(u_azimuthIntervals, intervalCoords, 0).rg;
	float minRadians = interval.x;
	float maxRadians = interval.y;
	vec3 greatCircleNormal = greatCircleFromBearing(townNvector, north, east, (minRadians + maxRadians) * 0.5);
	int contourIndex = texelFetch(u_cityContourIndexes, ivec2(int(cityIndex), 0), 0).r;
	if (contourIndex < 0 || uint(contourIndex) >= contourCount) {
		vec2 townLonLat = lonLatFromNVector(townNvector);
		tf_boundaryAngular = vec4(townLonLat.x, townLonLat.y, -1.0, 0.0);
		tf_boundaryEcef = vec4(0.0);
		gl_Position = vec4(0.0, 0.0, 0.0, 1.0);
		return;
	}

	int contourOffset = texelFetch(u_contourOffsets, ivec2(contourIndex, 0), 0).r;
	int contourSize = texelFetch(u_contourSizes, ivec2(contourIndex, 0), 0).r;
	if (contourSize < 3) {
		vec2 townLonLat = lonLatFromNVector(townNvector);
		tf_boundaryAngular = vec4(townLonLat.x, townLonLat.y, -1.0, 0.0);
		tf_boundaryEcef = vec4(0.0);
		gl_Position = vec4(0.0, 0.0, 0.0, 1.0);
		return;
	}

	float bestDistance = 1e30;
	vec3 bestCandidate = vec3(0.0);
	for (int segmentIndex = 0; segmentIndex < contourSize; segmentIndex++) {
		vec3 start = readContourNVector(contourOffset + segmentIndex);
		vec3 end = readContourNVector(contourOffset + ((segmentIndex + 1) % contourSize));
		vec3 candidate = intersectGreatCircleWithSegment(greatCircleNormal, start, end);
		if (candidate.x == 0.0 && candidate.y == 0.0 && candidate.z == 0.0) {
			continue;
		}
		float candidateAzimuth = initialBearingRadians(north, east, candidate);
		if (!isAngleInsideContinuousInterval(candidateAzimuth, minRadians, maxRadians)) {
			continue;
		}
		float distance = angularDistanceRadians(candidate, townNvector);
		if (distance < bestDistance) {
			bestDistance = distance;
			bestCandidate = candidate;
		}
	}

	if (bestDistance < 1e29) {
		vec2 bestLonLat = lonLatFromNVector(bestCandidate);
		tf_boundaryAngular = vec4(bestLonLat.x, bestLonLat.y, bestDistance, 1.0);
		tf_boundaryEcef = vec4(bestCandidate * u_uniforms.x, 1.0);
	} else {
		vec2 townLonLat = lonLatFromNVector(townNvector);
		tf_boundaryAngular = vec4(townLonLat.x, townLonLat.y, -1.0, 0.0);
		tf_boundaryEcef = vec4(0.0);
	}

	gl_Position = vec4(0.0, 0.0, 0.0, 1.0);
}
