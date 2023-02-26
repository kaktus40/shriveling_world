#version 300 es
precision highp float;
precision lowp isampler2D;
#define PI 3.1415926535897932384626433832795
#define EPSILON  0.0000001

uniform sampler2D u_rawCones; // x= town y= degrees

uniform sampler2D u_townOverLaps; // x= neighboorLimit y= town (x= townBborder,azimut,townBAzimut)

uniform int neighboorLimit;

#pragma glslify: import('../../common/shaders/rayIntersectTriangle.glsl')
in vec2 pos; // x=town y=degrees (0 to 360 and 361=summit)
layout(location = 0) out vec4 ciseledPosition;
const float deg2rad = PI / 180.;
const float rad2deg = 180. / PI;

void main() {

    int townNumber = int(pos.x);
    int azimut = int(pos.y);
    float radAzimut = azimut * deg2rad;
    vec3 summit = texelFetch(u_rawCones, ivec2(townNumber, 360), 0).xyz;

    if(azimut == 360) {
        ciseledPosition.xyz = summit;
    } else {
        vec3 finalVertex = texelFetch(u_rawCones, ivec2(townNumber, azimut), 0).xyz;
        float candidateLength = length(finalVertex - summit);
        vec3 D = normalize(finalVertex - summit);
        vec3 tempVertex, vertex0, vertex1, neighboor, townBSummit;
        float tempLength;
        int townBAzimut, townBOrder;
        // boucle sur les cones les plus proches
        for(int i = 0; i < neighboorLimit; i++) {
            neighboor = texelFetch(u_townOverLaps, ivec2(i, townNumber), 0).xyz;
            if(abs(neighboor.y - radAzimut) < 45 * deg2rad) {
                townBAzimut = int(neighboor.z * rad2deg) + 360;
                townBOrder = int(neighboor.x);
                townBSummit = texelFetch(u_rawCones, ivec2(townBOrder, 360), 0).xyz;
                vertex0 = texelFetch(u_rawCones, ivec2(townBOrder, mod(townBAzimut - 46, 360)), 0).xyz;
                for(int j = -45; j <= 45; j++) {
                    vertex1 = texelFetch(u_rawCones, ivec2(townBOrder, mod(townBAzimut + j, 360)), 0).xyz;
                    if(RayIntersectsTriangle(townBSummit, vertex0, vertex1, summit, D, tempVertex, tempLength) && tempLength < candidateLength) {
                        candidateLength = tempLength;
                        finalVertex = tempVertex;
                    }
                    vertex0 = vertex1;
                }
            }
        }
        ciseledPosition.xyz = finalVertex;
    }
}
