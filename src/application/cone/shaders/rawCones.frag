#version 300 es
precision highp float;
precision lowp isampler2D;
#define PI 3.1415926535897932384626433832795

uniform sampler2D summitECEF;
uniform sampler2D u_ned2ECEF0s;
uniform sampler2D u_ned2ECEF1s;
uniform sampler2D u_ned2ECEF2s;

uniform float longueurMaxi;
uniform float earthRadius;

uniform float roadAlpha;
uniform isampler2D u_city_dict; //x=0 y=town
uniform sampler2D u_city_links; //x=0 y=town
uniform float attenuation;// secteur angulaire en radian au delà du quel on revient à roadAlpha dans le cas d'une proximité avec un angle alpha autre

in vec2 pos; // x=town y=degrees (0 to 360 and 361=summit)
layout(location = 0) out vec4 ECEFPosition;
const float deg2rad = PI / 180.;
const float twoPI = PI * 2.;

void main() {

    int townNumber = int(pos.x);
    int azimut = int(pos.y);
    float radAzimut = azimut * deg2rad;
    ivec2 cityPos = ivec2(0, townNumber);
    vec3 summit = earthRadius * texelFetch(summitECEF, cityPos, 0).xyz;
    mat3 ned2ECEF = mat3(0.0);
    ned2ECEF[0] = texelFetch(u_ned2ECEF0s, cityPos, 0).xyz;
    ned2ECEF[1] = texelFetch(u_ned2ECEF1s, cityPos, 0).xyz;
    ned2ECEF[2] = texelFetch(u_ned2ECEF2s, cityPos, 0).xyz;

    if(azimut == 360) {
        ECEFPosition.xyz = summit;
    } else {
        ivec2 townListLimits = texelFetch(u_city_dict, cityPos, 0).xy;
        float selectedAlpha = roadAlpha;
        if(townListLimits != -1) {
            vec2 tmpCityLink = texelFetch(u_city_links, ivec2(0, townListLimits.y), 0).yz;
            float tmpRadInf = tmpCityLink.x - twoPI;
            float tmpAlphaInf = tmpCityLink.y;
            tmpCityLink = texelFetch(u_city_links, ivec2(0, townListLimits.x), 0).yz;
            float tmpRadSup = tmpCityLink.x + twoPI;
            float tmpAlphaSup = tmpCityLink.y;
            for(int i = townListLimits.x; i <= townListLimits.z; i++) {
                tmpCityLink = texelFetch(u_city_links, ivec2(0, i), 0).yz;
                if(tmpCityLink.x > tmpRadInf && tmpCityLink.x <= radAzimut) {
                    tmpRadInf = tmpCityLink.x;
                    tmpAlphaInf = tmpCityLink.y;
                }
                if(tmpCityLink.x <= tmpRadSup && tmpCityLink.x > radAzimut) {
                    tmpRadSup = tmpCityLink.x;
                    tmpAlphaSup = tmpCityLink.y;
                }
            }
        // les bornes sont définies et il faut maintenant savoir si elles ne sont pas trop éloignées par rapport à l'angle d'atténuement
            if(radAzimut - tmpRadInf > attenuation) {
                tmpRadInf = radAzimut - attenuation;
                tmpAlphaInf = roadAlpha;
            }
            if(tmpRadSup - radAzimut > attenuation) {
                tmpRadSup = radAzimut + attenuation;
                tmpAlphaSup = roadAlpha;
            }
            float smStep = smoothstep(tmpRadInf, tmpRadSup, radAzimut);
            selectedAlpha = tmpAlphaInf + smStep * (tmpAlphaSup - tmpAlphaInf);
        }

        float cosEl = cos(selectedAlpha);
        float sinEl = sin(selectedAlpha);
        float cosClock = cos(radAzimut);
        float sinClock = sin(radAzimut);
        vec3 nedProjection = longueurMaxi * vec3(cosEl * cosClock, cosEl * sinClock, sinEl);
        ECEFPosition.xyz = ned2ECEF * nedProjection + summit;
    }
}
