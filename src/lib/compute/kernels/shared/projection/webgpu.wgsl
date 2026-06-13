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
