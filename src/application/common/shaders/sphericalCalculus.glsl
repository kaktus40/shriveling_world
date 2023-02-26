vec2 ToCartographic(in vec3 nVector) {
  float phi = atan(nVector.z, sqrt(nVector.x * nVector.x + nVector.y * nVector.y));
  float lambda = atan(nVector.y, nVector.x);
  lambda = mod(mod((lambda - PI), 2. * PI) + 2. * PI, 2. * PI) - PI;
  return vec2(lambda, phi);
}

// see http://www.movable-type.co.uk/scripts/latlong-vectors.html
vec3 ToNVector(in vec2 coordLonLat) {
  vec3 resultat = vec3(0.0);
  float phi = coordLonLat.y;
  float lambda = coordLonLat.x;

  float cPhi = cos(phi);
  float sPhi = sin(phi);
  float cLambda = cos(lambda);
  float sLambda = sin(lambda);

  resultat.x = cPhi * cLambda;
  resultat.y = cPhi * sLambda;
  resultat.z = sPhi;

  return resultat;
}

vec4 LatLonH2ECEF(in vec2 coordLonLat) {
  vec3 tmp = ToNVector(coordLonLat);
  return vec4(tmp.x, tmp.y, tmp.z, 1.);
}

mat4 MatECEF2NED(in vec2 coordLonLat) {
  mat4 resultat = mat4(.0);
  float cosLong = cos(coordLonLat.x);
  float sinLong = sin(coordLonLat.x);
  float cosLat = cos(coordLonLat.y);
  float sinLat = cos(coordLonLat.y);
  resultat[0] = vec4(-cosLong * sinLat, -sinLong, -cosLong * cosLat, .0);
  resultat[1] = vec4(-sinLong * sinLat, cosLong, -sinLong * cosLat, 0.);
  resultat[2] = vec4(cosLat, 0, -sinLat, 0.);
  resultat[3] = vec4(-cosLong * cosLat, -sinLong * cosLat, -sinLat, 1.);
  return resultat;
}

// see http://www.movable-type.co.uk/scripts/latlong.html
// see http://www.movable-type.co.uk/scripts/latlong-vectors.html

// x=long=lambda,y=lat=phi in rad!! output: azimut +distance + midpoint long lat in rad!
vec4 AzimutDistanceMidPoint(in vec2 from, in vec2 to) {
  vec4 resultat = vec4(0.0);
  float lon1 = from.x;
  float lat1 = from.y;
  float lon2 = to.x;
  float lat2 = to.y;

  float DLong = lon2 - lon1;
  float DLat = lat2 - lat1;

  float a = pow(sin(DLat / 2.0), 2.0) + cos(lat1) * cos(lat2) * pow(sin(DLong / 2.0), 2.0);
  resultat.y = (2.0 * atan(sqrt(a), sqrt(1.0 - a)));
  resultat.x = mod((atan(sin(DLong) * cos(lat2), cos(lat1) * sin(lat2) - sin(lat1) * cos(lat2) * cos(DLong))) + 2. * PI, 2. * PI);

  vec2 B = vec2(cos(lat2) * cos(DLong), cos(lat2) * sin(DLong));
  resultat.w = (atan(sin(lat1) + sin(lat2), sqrt(pow(cos(lat1) + B.x, 2.0) + pow(B.y, 2.0))));
  resultat.z = mod((lon1 + atan(B.y, cos(lat1) + B.x)) + 3. * PI, 2. * PI) - PI;

  return resultat;
}

vec2 DestinationPoint(in vec2 p, float bearing, float dist) {
  float sPhi = sin(p.y);
  float cPhi = cos(p.y);
  float sDelta = sin(dist);
  float cDelta = cos(dist);
  float sTheta = sin(bearing);
  float cTheta = cos(bearing);

  float phi2 = asin(sPhi * cDelta + cPhi * sDelta * cTheta);
  float lambda2 = p.x + atan(sTheta * sDelta * cPhi, sDelta - sPhi * sin(phi2));
  lambda2 = mod(mod((lambda2 - PI), 2. * PI) + 2. * PI, 2. * PI) - PI;
  return vec2(lambda2, phi2);
}

vec3 DestinationPoint(in vec3 p, float bearing, float dist) {
  vec3 N = vec3(0, 0, 1);
  vec3 de = normalize(cross(N, p));
  vec3 dn = cross(p, de);
  vec3 deSTheta = sin(bearing) * de;
  vec3 dnCTheta = cos(bearing) * dn;
  vec3 d = dnCTheta + deSTheta;
  return normalize(cos(dist) * p + sin(dist) * d);
}

vec3 GreatCircle(in vec3 coord1, in vec3 coord2) {
  return normalize(cross(coord1, coord2));
}

void LocalReferential(in vec3 coord, out vec3 north, out vec3 east) {
  east = normalize(vec3(-coord.y, coord.x, 0.));
  north = normalize(cross(coord, east));
}

vec3 GreatCircle(in vec3 coord, in float theta) {
  float cTheta = cos(theta);
  float sTheta = sin(theta);
  vec3 east;
  vec3 north;
  LocalReferential(coord, north, east);
  return normalize(cross(coord, cTheta * north + sTheta * east));
  // return normalize(sTheta * north - cTheta * east);
}

float NDistance(in vec3 a, in vec3 b) {
  return acos(dot(a, b));
}

//https://math.stackexchange.com/questions/3330175/north-bearing-between-two-points-in-cartesian-space
vec2 InitBearingElevation(in vec3 coord1, in vec3 coord2) {
  vec3 east;
  vec3 north;
  LocalReferential(coord1, north, east);
  float sTheta = dot(coord2, east);
  float cTheta = dot(coord2, north);
  float theta = mod(atan(sTheta, cTheta) + 2. * PI, 2. * PI);
  return vec2(theta);
}

vec2 InitBearingElevation(in vec3 north, in vec3 east, in vec3 coord) {
  float sTheta = dot(coord, east);
  float cTheta = dot(coord, north);
  float theta = mod(atan(sTheta, cTheta) + 2. * PI, 2. * PI);
  return vec2(theta);
}

vec3 IntermediatePoint(in vec3 coord1, in vec3 coord2, in float f) {
  return normalize((1.0 - f) * coord1 + f * coord2);
}

vec3 MidPoint(in vec3 coord1, in vec3 coord2) {
  return IntermediatePoint(coord1, coord2, .5);
}

vec2 AzimutDistance(in vec3 from, in vec3 to) {
  vec2 resultat = vec2(0.0);
  vec2 fromC = ToCartographic(from);
  vec2 toC = ToCartographic(to);

  float DLong = toC.x - fromC.x;
  float DLat = toC.y - fromC.y;
  float cLat1 = cos(fromC.y);
  float sLat1 = sin(fromC.y);
  float cLat2 = cos(toC.y);
  float sLat2 = sin(toC.y);

  float a = pow(sin(DLat / 2.0), 2.0) + cLat1 * cLat2 * pow(sin(DLong / 2.0), 2.0);
  resultat.y = 2.0 * atan(sqrt(a), sqrt(1.0 - a));
  resultat.x = mod(atan(sin(DLong) * cLat2, cLat1 * sLat2 - sLat1 * cLat2 * cos(DLong)) + 2. * PI, 2. * PI);

  return resultat;
}

vec3 Triangulation(in vec3 a, in float thetaA, in vec3 b, in float thetaB) {

  vec3 north = vec3(0, 0, 1);
  vec3 dae = normalize(cross(north, a));
  vec3 dan = normalize(cross(a, dae));
  vec3 da = cos(thetaA) * dan + dae * sin(thetaA);
  vec3 ca = GreatCircle(a, da);

  vec3 dbe = normalize(cross(north, b));
  vec3 dbn = normalize(cross(b, dbe));
  vec3 db = cos(thetaA) * dbn + dbe * sin(thetaB);
  vec3 cb = GreatCircle(b, db);

  return normalize(cross(ca, cb));
}

// https://stackoverflow.com/questions/10236848/is-angle-in-between-two-angles/42424631#42424631
// c between a and b modulo
bool Beetwen(in float a, in float b, in float g) {
  if(a <= b) {
    if(b - a <= PI) {
      return a <= g && g <= b;
    } else {
      return b <= g || g <= a;
    }
  } else {
    if(a - b <= PI) {
      return b <= g && g <= a;
    } else {
      return a <= g || g <= b;
    }
  }
}
