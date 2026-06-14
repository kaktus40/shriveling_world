struct BoundaryUniforms {
  values: vec4<f32>,
};

struct Vec4Buffer {
  data: array<vec4<f32>>,
};

struct ScalarsBuffer {
  data: array<f32>,
};

struct IntBuffer {
  data: array<i32>,
};

@group(0) @binding(0) var<storage, read> city_matrices: Vec4Buffer;
@group(0) @binding(1) var<storage, read> city_contours: IntBuffer;
@group(0) @binding(2) var<storage, read> contour_nvectors: Vec4Buffer;
@group(0) @binding(3) var<storage, read> contour_offsets: IntBuffer;
@group(0) @binding(4) var<storage, read> contour_sizes: IntBuffer;
@group(0) @binding(5) var<storage, read> azimuth_intervals: ScalarsBuffer;
@group(0) @binding(6) var<uniform> uniforms: BoundaryUniforms;
@group(0) @binding(7) var<storage, read_write> town_boundary_angular: Vec4Buffer;
@group(0) @binding(8) var<storage, read_write> town_boundary_ecef: Vec4Buffer;

fn read_contour_nvector(point_index: u32) -> vec3<f32> {
  return contour_nvectors.data[point_index].xyz;
}

fn intersect_great_circle_with_segment(great_circle_normal: vec3<f32>, segment_start: vec3<f32>, segment_end: vec3<f32>) -> vec3<f32> {
  let bounds = segment_end - segment_start;
  let denominator = dot(bounds, great_circle_normal);
  if (abs(denominator) <= ANGULAR_EPSILON) {
    return vec3<f32>(0.0);
  }
  let ratio = -dot(segment_start, great_circle_normal) / denominator;
  if (ratio < 0.0 || ratio > 1.0) {
    return vec3<f32>(0.0);
  }
  return normalize(segment_start + bounds * ratio);
}

@compute @workgroup_size(1, 1, 1)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let azimuth_index = global_id.x;
  let city_index = global_id.y;
  let city_count = u32(uniforms.values.y);
  let azimuth_interval_count = u32(uniforms.values.z);
  let contour_count = u32(uniforms.values.w);

  if (city_index >= city_count || azimuth_index >= azimuth_interval_count) {
    return;
  }

  let interval_base = azimuth_index * 2u;
  let min_radians = azimuth_intervals.data[interval_base];
  let max_radians = azimuth_intervals.data[interval_base + 1u];
  let matrix_base = city_index * 4u;
  let town_nvector = normalize(city_matrices.data[matrix_base + 3u].xyz);
  let north = city_matrices.data[matrix_base + 0u].xyz;
  let east = city_matrices.data[matrix_base + 1u].xyz;
  let great_circle_normal = great_circle_from_bearing(town_nvector, north, east, (min_radians + max_radians) * 0.5);
  let contour_index = city_contours.data[city_index];
  let output_index = city_index * azimuth_interval_count + azimuth_index;

  if (contour_index < 0 || u32(contour_index) >= contour_count) {
    let town_lonlat = lonlat_from_nvector(town_nvector);
    town_boundary_angular.data[output_index] = vec4<f32>(town_lonlat.x, town_lonlat.y, -1.0, 0.0);
    town_boundary_ecef.data[output_index] = vec4<f32>(0.0, 0.0, 0.0, 0.0);
    return;
  }

  let contour_offset = u32(contour_offsets.data[contour_index]);
  let contour_size = u32(contour_sizes.data[contour_index]);
  if (contour_size < 3u) {
    let town_lonlat = lonlat_from_nvector(town_nvector);
    town_boundary_angular.data[output_index] = vec4<f32>(town_lonlat.x, town_lonlat.y, -1.0, 0.0);
    town_boundary_ecef.data[output_index] = vec4<f32>(0.0, 0.0, 0.0, 0.0);
    return;
  }

  var best_distance = 1e30;
  var best_candidate = vec3<f32>(0.0);
  var segment_index: u32 = 0u;
  loop {
    if (segment_index >= contour_size) {
      break;
    }
    let start = read_contour_nvector(contour_offset + segment_index);
    let end = read_contour_nvector(contour_offset + ((segment_index + 1u) % contour_size));
    let candidate = intersect_great_circle_with_segment(great_circle_normal, start, end);
    if (candidate.x != 0.0 || candidate.y != 0.0 || candidate.z != 0.0) {
      let candidate_azimuth = initial_bearing_radians(north, east, candidate);
      if (is_angle_inside_continuous_interval(candidate_azimuth, min_radians, max_radians)) {
        let distance = angular_distance_radians(candidate, town_nvector);
        if (distance < best_distance) {
          best_distance = distance;
          best_candidate = candidate;
        }
      }
    }
    segment_index = segment_index + 1u;
  }

  if (best_distance < 1e29) {
    let best_lonlat = lonlat_from_nvector(best_candidate);
    town_boundary_angular.data[output_index] = vec4<f32>(best_lonlat.x, best_lonlat.y, best_distance, 1.0);
    town_boundary_ecef.data[output_index] = vec4<f32>(best_candidate * uniforms.values.x, 1.0);
  } else {
    let town_lonlat = lonlat_from_nvector(town_nvector);
    town_boundary_angular.data[output_index] = vec4<f32>(town_lonlat.x, town_lonlat.y, -1.0, 0.0);
    town_boundary_ecef.data[output_index] = vec4<f32>(0.0, 0.0, 0.0, 0.0);
  }
}
