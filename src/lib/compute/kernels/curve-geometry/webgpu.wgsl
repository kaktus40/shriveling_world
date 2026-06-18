struct CurveGeometryUniforms {
        values: vec4<f32>, // earthRadius, pointsPerCurve, curvePositionCode, coefficient
        projection: vec4<f32>, // startModeIndex, endModeIndex, percent, globeRadius
        projection_settings_a: vec4<f32>, // refLon, refLat, refHeight, zCoeff
        projection_settings_b: vec4<f32>, // standardParallel1, standardParallel2, 0, 0
}

@group(0) @binding(0) var<storage, read> curve_control_points_ecef: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read> curve_theta_radians: array<f32>;
@group(0) @binding(2) var<storage, read> curve_speed_ratio: array<f32>;
@group(0) @binding(3) var<storage, read> curve_ids: array<u32>;
@group(0) @binding(4) var<uniform> uniforms: CurveGeometryUniforms;
@group(0) @binding(5) var<storage, read_write> curve_vertex_positions: array<vec4<f32>>;

fn read_curve_point(curve_index: u32, point_index: u32) -> vec3<f32> {
        let base = curve_index * 4u + point_index;
        return curve_control_points_ecef[base].xyz;
}

fn lift_curve_point(point: vec3<f32>, curve_height_meters: f32, earth_radius_meters: f32) -> vec3<f32> {
        return normalize(point) * (earth_radius_meters + curve_height_meters);
}

fn sample_cubic_bezier(
        p0: vec3<f32>,
        p1: vec3<f32>,
        p2: vec3<f32>,
        p3: vec3<f32>,
        t: f32,
) -> vec3<f32> {
        let minus_t = 1.0 - t;
        let minus_t_squared = minus_t * minus_t;
        let t_squared = t * t;
        return
                minus_t * minus_t_squared * p0 +
                3.0 * minus_t_squared * t * p1 +
                3.0 * minus_t * t_squared * p2 +
                t * t_squared * p3;
}

fn compute_curve_height_meters(
        speed_ratio: f32,
        theta_radians: f32,
        curve_position_code: f32,
        coefficient: f32,
        earth_radius_meters: f32,
) -> f32 {
        let semi_theta = theta_radians * 0.5;
        let sin_semi_theta = sin(semi_theta);
        let cos_semi_theta = cos(semi_theta);
        let ratio = (speed_ratio * theta_radians) * 0.5;
        let second_term = sqrt(max(0.0, ratio * ratio - sin_semi_theta * sin_semi_theta));
        let om_prime = (cos_semi_theta + second_term) * earth_radius_meters * coefficient;
        let height = om_prime - earth_radius_meters;
        if (curve_position_code == 0.0) {
                return height;
        }
        return -height;
}

@compute @workgroup_size(1, 1, 1)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
        let sample_index = global_id.x;
        let curve_index = global_id.y;
        let points_per_curve = u32(uniforms.values.y);
        let samples_per_curve = points_per_curve + 1u;
        if (sample_index > points_per_curve) {
                return;
        }

        if (curve_ids[curve_index] == 0xffffffffu) {
                return;
        }

        let theta_radians = curve_theta_radians[curve_index];
        let speed_ratio = curve_speed_ratio[curve_index];
        let earth_radius_meters = uniforms.values.x;
        let curve_position_code = uniforms.values.z;
        let coefficient = uniforms.values.w;
        let curve_height_meters = compute_curve_height_meters(
                speed_ratio,
                theta_radians,
                curve_position_code,
                coefficient,
                earth_radius_meters,
        );

        let control_offset = curve_index * 4u;
        let point_a = curve_control_points_ecef[control_offset + 0u].xyz;
        let point_p = lift_curve_point(curve_control_points_ecef[control_offset + 1u].xyz, curve_height_meters, earth_radius_meters);
        let point_q = lift_curve_point(curve_control_points_ecef[control_offset + 2u].xyz, curve_height_meters, earth_radius_meters);
        let point_b = curve_control_points_ecef[control_offset + 3u].xyz;

        let t = select(0.0, f32(sample_index) / f32(points_per_curve), points_per_curve > 0u);
        let position = sample_cubic_bezier(point_a, point_p, point_q, point_b, t);
        
        let projected = project_display_from_ecef(
                position,
                uniforms.projection.w, // globeRadius
                earth_radius_meters,
                uniforms.projection_settings_a.xyz,
                uniforms.projection_settings_a.w,
                uniforms.projection_settings_b.x,
                i32(uniforms.projection.x),
                i32(uniforms.projection.y),
                uniforms.projection.z,
                uniforms.projection_settings_b.y,
        );
        let output_index = curve_index * samples_per_curve + sample_index;
        curve_vertex_positions[output_index] = vec4<f32>(projected, 1.0);
}
