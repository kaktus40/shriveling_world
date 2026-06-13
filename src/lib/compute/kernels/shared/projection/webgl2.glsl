#define PI 3.1415926535897932384626433832795
#define ECKERT_CONST 2.26750802723822639138
#define ECKERT_ITERATION 40

const float exckert_delta_const = 2.57079632679489661923;

float delta_eckert(in float theta, in float phi) {
	return -(theta + sin(theta) - exckert_delta_const * sin(phi)) /
		(1.0 + cos(theta));
}

vec3 project_globe(in vec3 pos, in float globeRadius, in float earthRadius) {
	float radius = (earthRadius + pos.z) / earthRadius * globeRadius;
	vec3 resultat = vec3(0.0);
	resultat.x = cos(pos.x) * radius * cos(pos.y);
	resultat.y = sin(pos.y) * radius;
	resultat.z = sin(pos.x) * radius * cos(pos.y);
	return resultat;
}

vec3 project_equirectangular(in vec3 pos, in float globeRadius, in float earthRadius, in vec3 reference, in float zzCoeff) {
	vec3 resultat = vec3(0.0);
	resultat.x = (pos.x - reference.x) * cos(reference.y) * globeRadius;
	resultat.y = (pos.y - reference.y) * globeRadius;
	resultat.z = (pos.z - reference.z) / earthRadius * globeRadius * zzCoeff;
	return resultat;
}

vec3 project_mercator(in vec3 pos, in float globeRadius, in float earthRadius, in float lambda0, in float zzCoeff) {
	vec3 resultat = vec3(0.0);
	resultat.x = (pos.x - lambda0) * globeRadius;
	resultat.y = log(tan(PI / 4.0 + pos.y / 2.0)) * globeRadius;
	resultat.z = pos.z / earthRadius * globeRadius * zzCoeff;
	return resultat;
}

vec3 project_winkel_tripel(in vec3 pos, in float globeRadius, in float earthRadius, in vec3 reference, in float zzCoeff) {
	vec3 resultat = vec3(0.0);
	float cosPhi = cos(pos.y);
	float sinPhi = sin(pos.y);
	float alpha = acos(cosPhi * cos(pos.x / 2.0));
	float cardinalAlpha = abs(alpha) < 0.0000001 ? 1.0 : sin(alpha) / alpha;
	resultat.x = ((pos.x - reference.x) * cos(reference.y) +
		2.0 * cosPhi * sin(pos.x / 2.0) / cardinalAlpha) * globeRadius / 2.0;
	resultat.y = ((pos.y - reference.y) + sinPhi / cardinalAlpha) * globeRadius / 2.0;
	resultat.z = (pos.z - reference.z) / earthRadius * globeRadius * zzCoeff;
	return resultat;
}

vec3 project_eckert_vi(in vec3 pos, in float globeRadius, in float earthRadius, in vec3 reference, in float zzCoeff) {
	vec3 resultat = vec3(0.0);
	float theta = reference.y;
	for(int i = 0; i < ECKERT_ITERATION; i++) {
		theta += delta_eckert(theta, pos.y);
	}
	resultat.x = (pos.x - reference.x) * (1.0 + cos(theta)) / ECKERT_CONST * globeRadius;
	resultat.y = 2.0 * theta / ECKERT_CONST * globeRadius;
	resultat.z = (pos.z - reference.z) / earthRadius * globeRadius * zzCoeff;
	return resultat;
}

vec3 project_van_der_grinten_i(in vec3 pos, in float globeRadius, in float earthRadius, in vec3 reference, in float zzCoeff) {
	vec3 resultat = vec3(0.0);
	resultat.z = (pos.z - reference.z) / earthRadius * globeRadius * zzCoeff;
	float theta = asin(abs(2.0 * pos.y / PI));
	if(abs(pos.x - reference.x) < 0.000001 || abs(theta - PI / 2.0) < 0.000001) {
		resultat.y = sign(pos.y) * PI * globeRadius * tan(theta / 2.0);
	} else if(abs(pos.y) < 0.000001) {
		resultat.x = (pos.x - reference.x) * globeRadius;
	} else {
		float A = .5 * abs(PI / (pos.x - reference.x) - (pos.x - reference.x) / PI);
		float sinTheta = sin(theta);
		float cosTheta = cos(theta);
		float G = cosTheta / (sinTheta + cosTheta - 1.0);
		float P = G * (2.0 / sinTheta - 1.0);
		float Q = A * A + G;
		float A_A = A * A;
		float P_P = P * P;
		float denominateur = P_P + A_A;
		resultat.x = sign(pos.x - reference.x) * PI * globeRadius / denominateur *
			(A * (G - P_P) +
			sqrt(pow(A * (G - P_P), 2.0) - (P_P + A_A) * (G * G - P_P)));
		resultat.y = sign(pos.y) * PI * globeRadius / denominateur *
			abs(P * Q - A * sqrt((A_A + 1.0) * denominateur - Q * Q));
	}
	return resultat;
}

vec3 project_conic_equidistant(in vec3 pos, in float globeRadius, in float earthRadius, in vec3 reference, in float standardParallel1, in float standardParallel2, in float zzCoeff) {
	vec3 resultat = vec3(0.0);
	float n = (cos(standardParallel1) - cos(standardParallel2)) /
		(standardParallel2 - standardParallel1);
	float G = cos(standardParallel1) / n + standardParallel1;
	float rho0 = G - reference.y;
	float theta = n * (pos.x - reference.x);
	float rho = G - pos.y;
	resultat.x = rho * sin(theta) * globeRadius;
	resultat.y = (rho0 - rho * cos(theta)) * globeRadius;
	resultat.z = (pos.z - reference.z) / earthRadius * globeRadius * zzCoeff;
	return resultat;
}

vec3 project_display(in vec3 pos, in float globeRadius, in float earthRadius, in vec3 reference, in float standardParallel1, in float standardParallel2, in int projectionInit, in int projectionEnd, in float percent, in float zzCoeff) {
	vec3 initVec;
	vec3 endVec;
	if(projectionInit == 0) {
		initVec = project_globe(pos, globeRadius, earthRadius);
	} else if(projectionInit == 1) {
		initVec = project_equirectangular(pos, globeRadius, earthRadius, reference, zzCoeff);
	} else if(projectionInit == 2) {
		initVec = project_mercator(pos, globeRadius, earthRadius, reference.x, zzCoeff);
	} else if(projectionInit == 3) {
		initVec = project_winkel_tripel(pos, globeRadius, earthRadius, reference, zzCoeff);
	} else if(projectionInit == 4) {
		initVec = project_eckert_vi(pos, globeRadius, earthRadius, reference, zzCoeff);
	} else if(projectionInit == 5) {
		initVec = project_van_der_grinten_i(pos, globeRadius, earthRadius, reference, zzCoeff);
	} else {
		initVec = project_conic_equidistant(pos, globeRadius, earthRadius, reference, standardParallel1, standardParallel2, zzCoeff);
	}
	if(projectionInit == projectionEnd) {
		return initVec;
	}
	if(projectionEnd == 0) {
		endVec = project_globe(pos, globeRadius, earthRadius);
	} else if(projectionEnd == 1) {
		endVec = project_equirectangular(pos, globeRadius, earthRadius, reference, zzCoeff);
	} else if(projectionEnd == 2) {
		endVec = project_mercator(pos, globeRadius, earthRadius, reference.x, zzCoeff);
	} else if(projectionEnd == 3) {
		endVec = project_winkel_tripel(pos, globeRadius, earthRadius, reference, zzCoeff);
	} else if(projectionEnd == 4) {
		endVec = project_eckert_vi(pos, globeRadius, earthRadius, reference, zzCoeff);
	} else if(projectionEnd == 5) {
		endVec = project_van_der_grinten_i(pos, globeRadius, earthRadius, reference, zzCoeff);
	} else {
		endVec = project_conic_equidistant(pos, globeRadius, earthRadius, reference, standardParallel1, standardParallel2, zzCoeff);
	}
	return mix(initVec, endVec, percent / 100.0);
}

vec3 ecef_to_geographic(in vec3 pos, in float earthRadius) {
	float radius = length(pos);
	if(radius <= 0.0) {
		return vec3(0.0, 0.0, 0.0);
	}
	float longitude = atan(pos.y, pos.x);
	float latitude = asin(clamp(pos.z / radius, -1.0, 1.0));
	return vec3(longitude, latitude, radius - earthRadius);
}

vec3 project_display_from_ecef(in vec3 pos, in float globeRadius, in float earthRadius, in vec3 reference, in float standardParallel1, in float standardParallel2, in int projectionInit, in int projectionEnd, in float percent, in float zzCoeff) {
	vec3 geographic = ecef_to_geographic(pos, earthRadius);
	return project_display(geographic, globeRadius, earthRadius, reference, standardParallel1, standardParallel2, projectionInit, projectionEnd, percent, zzCoeff);
}

#pragma glslify: export(project_display)
