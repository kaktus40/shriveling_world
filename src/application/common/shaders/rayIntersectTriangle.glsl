
// see https://fr.wikipedia.org/wiki/Algorithme_d%27intersection_de_M%C3%B6ller%E2%80%93Trumbore
bool RayIntersectsTriangle(in vec3 vertex0, in vec3 vertex1, in vec3 vertex2, in vec3 O, in vec3 D, out vec3 resultat, out float t) {

    vec3 edge1, edge2, P, T, Q;
    float denominateur, facteur, u, v;
    edge1 = vertex1 - vertex0;
    edge2 = vertex2 - vertex0;
    P = cross(D, edge2);
    denominateur = dot(edge1, P);
    if(abs(denominateur) < EPSILON) {
        return false;    // Le rayon est parallèle au triangle.
    }
    facteur = 1.0 / denominateur;
    T = O - vertex0;
    u = facteur * dot(T, P);
    if(u < 0.0 || u > 1.0) {
        return false;
    }
    Q = cross(T, edge1);
    v = facteur * dot(D, Q);
    if(v < 0.0 || u + v > 1.0) {
        return false;
    }

        // On calcule t pour savoir ou le point d'intersection se situe sur la ligne.
    t = facteur * dot(edge2, Q);
    if(t > EPSILON) // Intersection avec le rayon
    {
        outIntersectionPoint = O + D * t;
        return true;
    } else // On a bien une intersection de droite, mais pas de rayon.
        return false;
}