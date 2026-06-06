/** PI shared by TypeScript reference code and WGSL ports. */
export const PI = Math.PI;

/** Two PI, used by angular wrapping and azimuth sampling. */
export const TWO_PI = 2 * Math.PI;

/** Half PI, used by spherical coordinate conversions. */
export const HALF_PI = Math.PI / 2;

/** Mean Earth radius used by the project for spherical calculations, in meters. */
export const EARTH_RADIUS_METERS = 6_371_000;

/**
 * Angular tolerance used when CPU reference code must match Float32 GPU math.
 *
 * One microradian corresponds to approximately 6.4 meters on Earth.
 */
export const FLOAT32_ANGULAR_EPSILON_RADIANS = 1e-6;
