#version 300 es
precision highp float;
precision lowp isampler2D;
#define PI 3.1415926535897932384626433832795
#define EPSILON  0.0000001

uniform sampler2D u_finalCones; // x= town y= degrees

uniform float threeRadius;
uniform float earthRadius;
uniform vec3 referenceEquiRectangular;
uniform float standardParallel1;
uniform float standardParallel2;
uniform int projectionInit;
uniform int projectionEnd;
uniform float percentProjection;
uniform int conesShape;
uniform float zCoeff;

#pragma glslify: displayConversions = require(../../common/shaders/displayConversions.glsl)

in vec2 pos; // x=town y=degrees (0 to 360 and 361=summit)
layout(location = 0) out vec4 displayedPosition;
layout(location = 1) out vec2 uvs;

void main() {

    int townNumber = int(pos.x);
    int azimut = int(pos.y);
    vec3 vertex = texelFetch(u_finalCones, ivec2(townNumber, azimut), 0).xyz;
    float radius = length(vertex);
    vec3 cartoPosition = vec3(0.0);
    cartoPosition.z = radius - earthRadius;
    if(radius > 0.0) {
        cartoPosition.x = atan(temp.y, temp.x);
        float sinus = sin(cartoPosition.x);
        if(abs(sinus) > 0.000000000001) {
            cartoPosition.y = atan(temp.z, temp.y / sinus);
        } else {
            cartoPosition.y = atan(temp.z, temp.x / cos(cartoPosition.x));
        }
    }
    displayedPosition.xyz = displayConversions(vertex, threeRadius, earthRadius, referenceEquiRectangular, standardParallel1, standardParallel2, projectionInit, projectionEnd, percentProjection, conesShape, zCoeff);
    uvs = vec2(cartoPosition.x / (2.0 * PI) + 0.5, cartoPosition.y / PI + 0.5);
}