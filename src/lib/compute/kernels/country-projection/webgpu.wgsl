struct CountryProjectionUniforms {
        projection: vec4<f32>, // start, end, percent, 0
        projection_settings_a: vec4<f32>, // refLon, refLat, refHeight, zCoeff
        projection_settings_b: vec4<f32>, // standardParallel1, standardParallel2, 0, 0
        extrusion_settings: vec4<f32>, // x: mixFactor
}

// Entrée : vec3<f32> [x, y, z] (ou vec4 aligné)
@group(0) @binding(0) var<storage, read> input_vertices: array<vec4<f32>>; 
@group(0) @binding(1) var<uniform> uniforms: CountryProjectionUniforms;
// Sortie : vec3<f32> projeté (ou vec4 aligné)
@group(0) @binding(2) var<storage, read_write> output_vertices: array<vec4<f32>>;

@compute @workgroup_size(64, 1, 1)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let index = global_id.x;
    if (index >= arrayLength(&input_vertices)) { return; }

    let input = input_vertices[index];
    let height = input.z * uniforms.extrusion_settings.x; // apply mixFactor

    let projected = project_display_from_ecef(
        vec3<f32>(input.xy, height),
        1.0, 6371e3,
        uniforms.projection_settings_a.xyz,
        uniforms.projection_settings_a.w,
        uniforms.projection_settings_b.x,
        i32(uniforms.projection.x),
        i32(uniforms.projection.y),
        uniforms.projection.z,
        uniforms.projection_settings_b.y
    );
    
    // Conservation de la structure vec4 pour l'alignement mémoire, z devient le z projeté
    output_vertices[index] = vec4<f32>(projected, 1.0);
}
