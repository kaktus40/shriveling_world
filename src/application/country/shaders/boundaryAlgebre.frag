#version 300 es
precision highp float;
precision lowp isampler2D;
#define PI 3.1415926535897932384626433832795

uniform sampler2D u_countries;
uniform sampler2D u_towns;
uniform isampler2D u_countryLimits;
uniform float subdivision;
uniform float earthRadius;

const float deg2rad = PI / 180.;
const float rad2deg = 180. / PI;
const float epsilon = 1e-10;

#pragma glslify: import('../../common/shaders/sphericalCalculus.glsl')
in vec2 pos; // x=angle y=town
layout(location = 0) out vec4 output0;
layout(location = 1) out vec4 output1;

void main() {
    vec3 town = texelFetch(u_towns, ivec2(pos.y, 0), 0).xyz;
    vec2 towny = deg2rad * town.xy;
    vec3 townNvector = ToNVector(towny);
    int countryPosition = int(town.z);
    float townBearing = deg2rad * float(int(pos.x)) / subdivision;
    float bearingMin = mod(townBearing - 1. / subdivision + 2. * PI, 2. * PI);
    float bearingMax = mod(townBearing + 1. / subdivision, 2. * PI);
    vec3 north;
    vec3 east;
    LocalReferential(townNvector, north, east);
    vec3 townCircle = GreatCircle(townNvector, townBearing);

    int countryLimitLoop = texelFetch(u_countryLimits, ivec2(countryPosition, 0), 0).x - 1;

    vec3 boundaryPoints[2] = vec3[](vec3(0.0), vec3(0.0));
    boundaryPoints[0] = ToNVector(deg2rad * texelFetch(u_countries, ivec2(0, countryPosition), 0).xy);
    vec3 intersect, bounds;
    vec3 candidate = vec3(townNvector);
    float distiCandidate = 99.;
    float denom, k, az, disty;

    for(int i = 0; i < countryLimitLoop; i++) {
        boundaryPoints[1] = ToNVector(deg2rad * texelFetch(u_countries, ivec2(i + 1, countryPosition), 0).xy);

        bounds = boundaryPoints[1] - boundaryPoints[0];
        // OI is in townCircle plane and OI is beetween boundaryPoints[0]  and boundaryPoints[1] 
        denom = dot(bounds, townCircle);
        if(abs(denom) > epsilon) {
            //townCircle plane and bounds can intersect
            k = -dot(boundaryPoints[0], townCircle) / denom;
            if(k >= 0. && k <= 1.) {
                intersect = normalize(boundaryPoints[0] + k * bounds);
                disty = NDistance(intersect, townNvector);
                az = InitBearingElevation(north, east, intersect).x;
                if(Beetwen(bearingMin, bearingMax, az)) {
                    if(disty < distiCandidate) {
                        distiCandidate = disty;
                        candidate = intersect;
                    }
                }
            }
        } else {
            //townCircle plane and bounds are parallels
        }
        boundaryPoints[0] = boundaryPoints[1];
    }
    output0 = rad2deg * vec4(ToCartographic(candidate), distiCandidate, 0);
    output1.xyz = earthRadius * candidate;
}
