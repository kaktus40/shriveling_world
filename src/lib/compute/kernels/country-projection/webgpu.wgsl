struct CountryProjectionUniforms {
        projection: vec4<f32>,
        projection_settings_a: vec4<f32>,
        projection_settings_b: vec4<f32>,
        extrusion_settings: vec4<f32>, // x: mixFactor, y: zCoeff
}

@group(0) @binding(0) var<storage, read> input_vertices: array<vec4<f32>>; // [lon, lat, height, 0]
@group(0) @binding(1) var<uniform> uniforms: CountryProjectionUniforms;
@group(0) @binding(2) var<storage, read_write> output_vertices: array<vec3<f32>>;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let index = global_id.x;
    if (index >= arrayLength(&input_vertices)) { return; }

    let input = input_vertices[index];
    let lon = input.x;
    let lat = input.y;
    let height = input.z * uniforms.extrusion_settings.x; // apply mixFactor

    // Assuming we have access to a projection function similar to final-cones
    // The projection logic needs to be included via shared shader source.
    let projected = project_display_from_ecef(
        vec3<f32>(lon, lat, height),
        1.0, // globeRadius placeholder
        6371e3, // earthRadius
        uniforms.projection_settings_a.xyz,
        uniforms.projection_settings_a.w,
        uniforms.projection_settings_b.x,
        i32(uniforms.projection.x),
        i32(uniforms.projection.y),
        uniforms.projection.z,
        uniforms.projection_settings_b.y
    );
    
    output_vertices[index] = projected;
}
