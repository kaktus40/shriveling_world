#version 300 es
precision highp float;
precision lowp isampler2D;
#define PI 3.1415926535897932384626433832795

uniform sampler2D u_towns;

#pragma glslify: import('../../common/shaders/sphericalCalculus.glsl')
in vec2 pos; // x=angle y=town
layout(location = 0) out vec4 output0;
layout(location = 1) out vec4 output1;
layout(location = 2) out vec4 output2;

void main() {
    if(abs(pos.x - pos.y) > .5) {
        vec2 townA = texelFetch(u_towns, ivec2(pos.x, 0), 0).xy;
        vec2 townB = texelFetch(u_towns, ivec2(pos.y, 0), 0).xy;

        output0 = AzimutDistanceMidPoint(townA, townB);
        float elevation = -output0.y / 2.0;
        output1 = vec4(0);
        output1.xy = AzimutDistanceMidPoint(townA, output0.zw).zw;
        output1.zw = AzimutDistanceMidPoint(townB, output0.zw).zw;
        output2 = vec4(cos(elevation) * cos(output0.x), cos(elevation) * sin(output0.x), -sin(elevation), elevation); // vecteur unitaire de A vers B dans ref NED de A + elevation à l'aide de la distance! -(pi/2-(pi- distance)/2)
    } else {
        output0 = vec4(0.);
        output1 = vec4(0.);
        output2 = vec4(0.);
    }
}
