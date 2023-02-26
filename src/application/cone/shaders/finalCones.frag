#version 300 es
precision highp float;
precision lowp isampler2D;
#define PI 3.1415926535897932384626433832795
#define EPSILON  0.0000001

uniform sampler2D u_townsBoundaries; // x= degrees y= town

uniform isampler2D u_AcceptLimits; // x= 0 y= town (0 or 1)

uniform sampler2D u_ciseledCones; // x= town y= degrees

#pragma glslify: import('../../common/shaders/rayIntersectTriangle.glsl')
in vec2 pos; // x=town y=degrees (0 to 360 and 361=summit)
layout(location = 0) out vec4 finalPosition;
const float deg2rad = PI / 180.;
const float rad2deg = 180. / PI;

void main() {

    int townNumber = int(pos.x);
    int azimut = int(pos.y);
    vec3 summit = texelFetch(u_ciseledCones, ivec2(townNumber, 360), 0).xyz;

    if(azimut == 360) {
        finalPosition.xyz = summit;
    } else {
        vec3 finalVertex = texelFetch(u_ciseledCones, ivec2(townNumber, azimut), 0).xyz;
        int acceptLimit = texelFetch(u_AcceptLimits, ivec2(0, townNumber), 0).x;
        if(acceptLimit != 0) {
            float candidateLength = length(finalVertex - summit);
            vec3 D = normalize(finalVertex - summit);
            vec3 eartCenter = vec3(.0);
            vec3 tempVertex, vertex0, vertex1;
            float tempLength;
            // boucle sur les limit du pays
            azimut += 360;
            vertex0 = texelFetch(u_townsBoundaries, ivec2(mod(azimut - 2, 360), townNumber), 0).xyz;
            for(int j = -1; j <= 1; j++) {
                vertex1 = texelFetch(u_rawCones, ivec2(mod(azimut + j, 360), townNumber) 0).xyz;
                if(RayIntersectsTriangle(eartCenter, vertex0, vertex1, summit, D, tempVertex, tempLength) && tempLength < candidateLength) {
                    candidateLength = tempLength;
                    finalVertex = tempVertex;
                }
                vertex0 = vertex1;
            }
        }
        finalPosition.xyz = finalVertex;
    }
}
