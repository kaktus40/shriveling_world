#version 300 es

precision highp float;
precision highp int;

layout(location = 0) in vec2 a_cityLonLatRadians;

out vec4 tf_col0;
out vec4 tf_col1;
out vec4 tf_col2;
out vec4 tf_col3;

uniform float u_earthRadiusMeters;

void main() {
  float longitude = a_cityLonLatRadians.x;
  float latitude = a_cityLonLatRadians.y;
  float cosLongitude = cos(longitude);
  float sinLongitude = sin(longitude);
  float cosLatitude = cos(latitude);
  float sinLatitude = sin(latitude);

  tf_col0 = vec4(-cosLongitude * sinLatitude, -sinLongitude * sinLatitude, cosLatitude, 0.0);
  tf_col1 = vec4(-sinLongitude, cosLongitude, 0.0, 0.0);
  tf_col2 = vec4(-cosLatitude * cosLongitude, -cosLatitude * sinLongitude, -sinLatitude, 0.0);
  tf_col3 = vec4(
    u_earthRadiusMeters * cosLatitude * cosLongitude,
    u_earthRadiusMeters * cosLatitude * sinLongitude,
    u_earthRadiusMeters * sinLatitude,
    1.0
  );

  gl_Position = vec4(0.0, 0.0, 0.0, 1.0);
}
