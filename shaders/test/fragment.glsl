

uniform sampler2D uTexture;
uniform float uTime;

varying vec2 vUv;

// float random(vec2 st) {
//     return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
// }

vec2 random2(vec2 p) {
    return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))) * 43758.5453);
}

vec3 voronoiColor(vec2 uv, float time, out float edgeFactor) {
  vec2 g = floor(uv);
  vec2 f = fract(uv);

  float minDist = 8.0;
  float secondMinDist = 8.0;
  vec2 nearestPoint;

  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
        vec2 offset = vec2(float(i), float(j));
        vec2 randomOffset = random2(g + offset);
        vec2 r = offset - f + randomOffset;
        float d = dot(r, r);

        if (d < minDist) {
            secondMinDist = minDist;
            minDist = d;
            nearestPoint = g + offset + randomOffset;
        } else if (d < secondMinDist) {
            secondMinDist = d;
        }
    }
  }

  edgeFactor = smoothstep(0.0, 0.03, secondMinDist - minDist);

  vec2 motion = sin(nearestPoint * 3.14 + time) * 0.02;
  vec2 sampleUv = vUv + motion;

  return texture2D(uTexture, sampleUv).rgb;
}


void main()
{
    vec2 uv = vUv * 2.0; // 板塊數量
    float edge;
    vec3 color = voronoiColor(uv, uTime, edge);

    vec3 lineColor = vec3(1.0);
    color = mix(lineColor, color, edge);

    gl_FragColor = vec4(color, 1.0);
    // float strength = random(vUv);
    // gl_FragColor = vec4(strength, strength, strength, 1.0);
}