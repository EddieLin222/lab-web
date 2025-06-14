import { Engine, type IFluidRenderingRenderObject, Observer, FluidRenderingObject, Scene, ArcRotateCamera, Vector3, Color3, VertexBuffer, AbstractEngine, FluidRenderer, FluidRenderingObjectCustomParticles, Tools, type Nullable, Mesh, Matrix, Quaternion, TmpVectors, PointerDragBehavior, MeshBuilder, PBRMaterial, Texture, CSG, CSG2, GroundMesh, SceneLoader, type ISceneLoaderAsyncResult, Plane, PostProcess, Camera, KeyboardInfo, PassPostProcess, RenderTargetTexture, KeyboardEventTypes, AbstractMesh, HemisphericLight, FreeCamera, Color4, ShaderMaterial, Vector2, Effect, StandardMaterial, type RenderTargetTextureOptions, Material, Vector4, ActionManager, TransformNode } from '@babylonjs/core'

// URL to your (CORS enabled) water normal texture
const url = "https://raw.githubusercontent.com/Orikson/Assets/main/";
const waterUrl = url + "WaterNormalTiling.png";
const islandUrl = url + "bronze_environment_combined.glb";

// Constants
const width = 50

export class Playground {
    public static CreateScene(scene: Scene, engine: Engine, canvas: HTMLCanvasElement): Scene {
        const initialTime = Date.now();

        // Initialize camera
        const camera = new ArcRotateCamera("camera", Math.PI / 3, Math.PI / 3, 10, Vector3.Zero());
        camera.wheelPrecision = 50;
        camera.minZ = 0.01;
        camera.maxZ = 1000;
        // camera.attachControl(canvas, true);

        // Initialize light
        const light = new HemisphericLight("light1", new Vector3(0, 1, 0), scene);
        light.intensity = 0.7;

        // Buffer size
        const buffSize = 2048;

        // Initialize intersection camera and shader
        const intersectionCam = new FreeCamera("intersectionCam", new Vector3(0, 20, 0), scene);
        intersectionCam.setTarget(Vector3.Zero());
        intersectionCam.mode = Camera.ORTHOGRAPHIC_CAMERA;
        intersectionCam.orthoBottom = -width/2;
        intersectionCam.orthoTop = width/2;
        intersectionCam.orthoLeft = -width/2;
        intersectionCam.orthoRight = width/2;
        intersectionCam.minZ = 20;
        intersectionCam.maxZ = 100;

        let intersectionTex = new RenderTargetTexture(
            "intersectionTex", 
            buffSize, 
            scene,
            {
                samplingMode: Engine.TEXTURE_BILINEAR_SAMPLINGMODE
            }
        );
        intersectionTex.activeCamera = intersectionCam;
        intersectionTex.clearColor = new Color4(0, 0, 0, 0);

        const ibackMat = new ShaderMaterial(
            "backMat_instances",
            scene,
            { 
                vertex: "intersection", 
                fragment: "intersection"
            }, 
            { 
                attributes: ["position"], 
                uniforms: ["world", "viewProjection"],
                defines: ['INSTANCES']
            }
        );
        ibackMat.backFaceCulling = false;
        
        const backMat = new ShaderMaterial(
            "backMat",
            scene,
            { 
                vertex: "intersection", 
                fragment: "intersection"
            }, 
            { 
                attributes: ["position"], 
                uniforms: ["world", "viewProjection"]
            }
        );
        backMat.backFaceCulling = false;


        // Create scene objects
        const s1 = CreateSphere("s1", new Color3(1, 0.5, 0), {diameter: 2, segments: 32}, scene);
        s1.position = new Vector3(1, 0, -1);

        const s2 = s1.createInstance("s2")
        s2.position = new Vector3(1.25, 0, 1.5);
        s2.scaling = new Vector3(0.25, 0.25, 0.25);

        /*const s1 = CreateSphere("s1", new BABYLON.Color3(1, 0.5, 0), {diameter: 2, segments: 32}, scene);
        s1.position = new BABYLON.Vector3(1, 0, -1);

        const s2 = CreateSphere("s2", new BABYLON.Color3(0.5, 1, 0), {diameter: 0.5, segments: 32}, scene);
        s2.position = new BABYLON.Vector3(1.25, 0, 1.5);
        */

        intersectionTex.renderList = [];

        SceneLoader.ImportMeshAsync("", '/3d-models/', 'worlds-man-animation.glb', scene).then(v => {
            scene.collisionsEnabled = true;
            const container = new TransformNode("playerRoot", scene);
            v.meshes
            .filter(m => m.name !== "__root__")
            .forEach(m => m.parent = container);

            container.position = new Vector3(0, 0.3, 0);
            container.scaling = new Vector3(1, 1, 1);
            container.rotation = new Vector3(0, 3, 0);
        
            const walkAnim = v.animationGroups.find(anim => anim.name === "walk");
            const idleAnim = v.animationGroups.find(anim => anim.name === "idle");
            
            scene.onAfterRenderObservable.addOnce(() => {
                v.animationGroups.forEach(anim => anim.stop());
                idleAnim?.play(true); // ✅ 初始站立
            });

            
            // === 建立 emitter 材質 ===
            const emitterMat = new StandardMaterial("invisible", scene);
            emitterMat.alpha = 0.001; // ✅ 避免 Babylon 優化省略 pixel
            emitterMat.disableDepthWrite = true;  // 不寫入深度
            emitterMat.forceDepthWrite = false;
            emitterMat.needDepthPrePass = false;
            emitterMat.emissiveColor = new Color3(0, 0, 0); // 無發光

            // === 設定 intersection 專用 camera 的 layerMask（與主攝影機分離）
            intersectionCam.layerMask = 0x10000000;

            // === 建立左右腳的 ripple emitter ===
            const leftFootEmitter = MeshBuilder.CreateSphere("leftFootRipple", { diameter: 0.3 }, scene);
            leftFootEmitter.material = emitterMat;
            leftFootEmitter.isPickable = false;
            leftFootEmitter.checkCollisions = false;
            leftFootEmitter.receiveShadows = false;
            leftFootEmitter.doNotSyncBoundingInfo = true;
            leftFootEmitter.layerMask = 0x10000000; // ✅ 僅對 intersectionCam 可見
            leftFootEmitter.visibility = 1; // 保持預設 1，讓 alpha 運作正常
            leftFootEmitter.parent = container;
            leftFootEmitter.position = new Vector3(-0.3, -0.2, 0); // 可微調位置至腳底

            const rightFootEmitter = leftFootEmitter.clone("rightFootRipple");
            rightFootEmitter.position = new Vector3(0.3, -0.2, 0); // 相對另一腳
            rightFootEmitter.layerMask = 0x10000000;

            // === 加入 renderList 並設定材質 ===
            const emitters = [leftFootEmitter, rightFootEmitter];
            intersectionTex.renderList?.push(...emitters);
            intersectionTex.setMaterialForRendering(emitters, backMat);


            // ========= ✅ 新增：建立左右腳 ripple emitter =========
            // const emitterMat = new StandardMaterial("invisible", scene);
            // emitterMat.alpha = 1; // 不可見
            // emitterMat.disableDepthWrite = true;  // ✅ 不寫入深度
            // emitterMat.forceDepthWrite = false;   // ✅ 不強迫寫入
            // emitterMat.needDepthPrePass = false;  // ✅ 無需深度前通過測試

            // const leftFootEmitter = MeshBuilder.CreateSphere("leftFootRipple", { diameter: 0.3 }, scene);
            // leftFootEmitter.material = emitterMat;
            // leftFootEmitter.isPickable = false;
            // leftFootEmitter.parent = container;
            // leftFootEmitter.position = new Vector3(-0.3, -0.2, 0); // 調整腳底位置

            // const rightFootEmitter = leftFootEmitter.clone("rightFootRipple");
            // rightFootEmitter.position = new Vector3(0.2, -0.2, 0);

            // const emitterList = [leftFootEmitter, rightFootEmitter]

            // intersectionTex.renderList?.push(...emitterList);
            // intersectionTex.setMaterialForRendering(emitterList, backMat);


            // ========= ✅ END 新增 ripple emitter =========

        
            const inputMap: Record<string, boolean> = {};
            scene.actionManager = new ActionManager(scene);
            scene.onKeyboardObservable.add((kbInfo) => {
                const key = kbInfo.event.key.toLowerCase();
                if (kbInfo.type === KeyboardEventTypes.KEYDOWN) {
                    inputMap[key] = true;
                } else if (kbInfo.type === KeyboardEventTypes.KEYUP) {
                    inputMap[key] = false;
                }
            });
        
            scene.onBeforeRenderObservable.add(() => {
                let moved = false;
        
                if (inputMap["arrowright"]) {
                    container.rotation = new Vector3(0, 1.5, 0);
                    container.position.x -= 0.005
                    moved = true;
                }
                if (inputMap["arrowleft"]) {
                    container.rotation = new Vector3(0, -1.5, 0);
                    container.position.x += 0.005
                    moved = true;
                }
                if (inputMap["arrowup"]) {
                    container.rotation = new Vector3(0, 0, 0);
                    container.position.z -= 0.005
                    moved = true;
                }
                if (inputMap["arrowdown"]) {
                    container.rotation = new Vector3(0, 9.5, 0);
                    container.position.z += 0.005
                    moved = true;
                }
        
                if (moved) {
                    if (!walkAnim?.isPlaying) walkAnim?.play(true);
                    idleAnim?.stop();
                } else {
                    if (!idleAnim?.isPlaying) idleAnim?.play(true);
                    walkAnim?.stop();
                }
            });
        });
        

        //const ground = BABYLON.MeshBuilder.CreateBox("ground", {width: width, height: 0.5, depth: width}, scene);
        //ground.position.y = -0.75;

        // Create our water object
        const water = MeshBuilder.CreateGround("water", {width: width, height: width}, scene);
        const waterClone = water.clone("waterClone");
        waterClone.position.y = -1;
        const waterCloneMat = new StandardMaterial("waterCloneMat", scene);
        waterCloneMat.disableDepthWrite = true;
        waterCloneMat.alpha = 0;
        const waterMaterial = new ShaderMaterial(
            "water_mat",
            scene,
            {
                vertex: "water",
                fragment: "water"
            },
            {
                attributes: ["position", "normal", "uv"], 
                uniforms: [
                    "worldViewProjection", "time", "cameraPosition", 
                    "color1", "color2", "emission", "ripples", "water", 
                    "resolution", 
                ], 
                samplers: ["intersectionSampler", "normalMap"],
                needAlphaBlending: true,
            }
        );
        waterMaterial.disableDepthWrite = true;
        water.material = waterMaterial;

        // Load normal map
        const normalMap = new Texture(waterUrl, scene);
        normalMap.updateSamplingMode(2)
        normalMap.onLoadObservable.add(() => {
            waterMaterial.setTexture("normalMap", normalMap);
        });

        // Initialize shader values
        waterMaterial.setVector3(
            "color1", 
            new Vector3(0, 60/256, 100/256)
        );
        waterMaterial.setVector3(
            "color2",
            new Vector3(25/256, 140/256, 140/256)
        );
        waterMaterial.setFloat("emission", 0);
        waterMaterial.setFloat("ripples", 1);
        waterMaterial.setFloat("water", 1);
        waterMaterial.setFloat("minZ", camera.minZ);
        waterMaterial.setFloat("maxZ", camera.maxZ);
        waterMaterial.setVector2(
            "resolution", 
            new Vector2(
                engine.getRenderWidth(), 
                engine.getRenderHeight()
            )
        );
        
        // Update shader values each frame
        scene.onBeforeRenderObservable.add(() => {
            const curTime = (Date.now() - initialTime) / 1000;
            waterMaterial.setFloat("time", curTime);
            waterMaterial.setVector3("cameraPosition", camera.position);

            // Update sphere position
            s2.position.x = 1.25 + Math.cos(curTime);
        });

        // Initialize ripples texture and materials
        const ripples = new PingPongRTT("ripples", buffSize, scene, {
            samplingMode: Engine.TEXTURE_BILINEAR_SAMPLINGMODE
        });
        ripples.addMesh(waterClone);
        ripples.activeCamera = intersectionCam;

        let rippleMaterial = new ShaderMaterial(
            "rippleMat",
            scene,
            {
                vertex: "dissipation",
                fragment: "dissipation"
            }, 
            {
                attributes: ["position"],
                uniforms: ["worldViewProjection", "iResolution", "iDepth", "coords"],
                samplers: ["textureSampler", "intersectionSampler"]
            }
        );
        ripples.setMaterialForRendering(waterClone, rippleMaterial);
        
        // Initialize intersection 
  
        intersectionTex.renderList.push(s1, s2);
        intersectionTex.setMaterialForRendering(
            intersectionTex.renderList, 
            intersectionTex.renderList.map((v, i, a) => {
                if (v.isAnInstance) {
                    return ibackMat
                }
                return backMat
            })
        );
        rippleMaterial.setTexture("intersectionSampler", intersectionTex);
        rippleMaterial.setVector2("iResolution", new Vector2(1/buffSize, 1/buffSize));
        rippleMaterial.setFloat("iDepth", 1/20);
        rippleMaterial.setArray2("coords", coords);
        
        // Update ripple texture right before the water is rendered by the main scene
        water.onBeforeRenderObservable.add(() => {
            intersectionTex.render();

            rippleMaterial.setTexture("textureSampler", ripples.inactiveRTT);
            ripples.render();

            waterMaterial.setTexture("intersectionSampler", ripples.inactiveRTT);
        });

        return scene;
    }
}

/************
== Shaders ==
************/
Effect.ShadersStore["waterVertexShader"] = `
precision highp float;

attribute vec3 position;
attribute vec3 normal;
attribute vec2 uv;

uniform mat4 worldViewProjection;

varying vec4 vPosition;
varying vec3 vNormal;
varying mat3 vNormalMat;
varying vec2 vUV;

void main(void) {
    vPosition = vec4(position, 1.);
    vNormal = normal;
    vUV = uv;
    
    // For non-flat non-y-axis-oriented surfaces, you'll have to compute this matrix differently
    vNormalMat = mat3(vec3(1., 0., 0.), vec3(0., 0., 1.), normal);
    
    gl_Position = worldViewProjection * vec4(position, 1.);
}
`;

Effect.ShadersStore["waterFragmentShader"] = `
precision highp float;

varying vec4 vPosition;
varying vec3 vNormal;
varying mat3 vNormalMat;
varying vec2 vUV;

uniform sampler2D intersectionSampler;
uniform sampler2D normalMap;

uniform float time;
uniform float emission;
uniform float ripples;
uniform float water;
uniform float minZ;
uniform float maxZ;

uniform vec2 resolution;

uniform vec3 color1;
uniform vec3 color2;

uniform vec3 cameraPosition;

#include<perlinNoise>
#include<lighting>

void main(void) {
    vec2 flowDir1 = normalize(vec2(1., 1.));
    vec2 flowDir2 = vec2(1., 0.) * 0.7527;
    vec2 uv1 = vUV * 0.5 + time * 0.002 * flowDir1 + vec2(0.2297, 0.3138);
    vec2 uv2 = vUV * 0.5 + time * 0.002 * flowDir2;

    vec3 normal_1 = texture2D(normalMap, uv1 * 10.).xyz * 2. - 1.;
    vec3 color_1 = mix(color1, color2, octave(uv1 * 20., 1) * 0.5 + 0.5);
    
    vec3 normal_2 = texture2D(normalMap, uv2 * 5.).xyz * 2. - 1.;
    vec3 color_2 = mix(color1, color2, octave(uv2 * 20., 1) * 0.5 + 0.5);
    
    vec3 normal_d = normalize(mix(normal_1, normal_2, 0.5));
    
    vec3 normal = vNormalMat * normal_d;
    vec3 color = mix(color_1, color_2, 0.5);

    vec3 lightPos = vec3(-2, 2, -1) * 100.;

    vec3 result = directional(
        normalize(cameraPosition - vPosition.xyz),
        normalize(vec3(1, 2, 0)),
        vPosition.xyz,
        normal,
        color,
        2048.
    );
    vec3 result2 = directional(
        normalize(cameraPosition - vPosition.xyz),
        normalize(vec3(0, 2, 1)),
        vPosition.xyz,
        normal,
        color,
        2048.
    );
    vec3 result3 = directional(
        normalize(cameraPosition - vPosition.xyz),
        normalize(vec3(-1, 3, -1)),
        vPosition.xyz,
        normal,
        color,
        2048.
    );
    result = (0.8*result + 0.6*result2 + result3) * 0.6;

    vec4 diffuse = vec4(result, 0.8) * water;
    vec4 emissive = vec4(1., 1., 1., 1.);

    float ndl = clamp((0.918 - normal.y) * 100., 0., 1.);
    ndl = pow(ndl, 10.);

    vec4 fluidColor = mix(diffuse, emissive, ndl);

    // Ripples
    vec4 intersection = texture2D(intersectionSampler, 1. - vUV);
    float tmp = 
        (cos(
            20.*pow(1.-intersection.x, 2.) - 3.*time
        ) * (1. - 0.25 * intersection.x) + 
        pow(intersection.x, 2.)) * 0.5 + 0.5;
    float ripple = 
        round(0.5 + intersection.x) *
        floor(
            (tmp + 
            octave(vUV*40., 4)*2.-0.75) * 
            intersection.x + 
            0.9 + 
            pow(intersection.x + 0.1, 2.)
        ) * 
        ripples;
    if (intersection.w == 1.) {
        ripple = 0.;
    }
    
    // Composite
    gl_FragColor = fluidColor + vec4(ripple);
}
`;

Effect.ShadersStore["intersectionVertexShader"] = `
precision highp float;

attribute vec3 position;
#include<instancesDeclaration>

uniform mat4 viewProjection;

void main(void) {
#include<instancesVertex>

    mat4 iwvp = viewProjection * finalWorld;

    gl_Position = iwvp * vec4(position, 1.);
}
`;

Effect.ShadersStore["intersectionFragmentShader"] = `
precision highp float;

void main(void) {
    if (gl_FrontFacing) {
        gl_FragColor = vec4(0.);
        return;
    } 
    gl_FragColor = vec4(1);
}
`;

Effect.ShadersStore["dissipationVertexShader"] = `
precision highp float;

attribute vec3 position;
uniform mat4 worldViewProjection;

void main(void) {
    gl_Position = worldViewProjection * vec4(position, 1.);
}
`;

Effect.ShadersStore["dissipationFragmentShader"] = `
precision highp float;

// This is the previous dissipation shader pass
uniform sampler2D textureSampler;

// This is the set that represent the interior of a cross section of a mesh
uniform sampler2D intersectionSampler;

// Inverse resolution
uniform vec2 iResolution;

// This is how far the distance fade effect should spread
// i.e. 1/20
uniform float iDepth;

// Sample relative normalized coordinates
uniform vec2 coords[8];

void main(void) {
    vec2 uv = gl_FragCoord.xy * iResolution;
    vec4 iso = texture2D(intersectionSampler, uv);

    if (iso.x == 1.) {
        gl_FragColor = vec4(1.);
        return;
    }

    float m = 0.;
    for (int i = 0; i < 8; i ++) {
        m = max(m, 
            texture2D(textureSampler, uv + iResolution * coords[i]).x
        );
    }

    float res = max(0., m - iDepth);
    gl_FragColor = vec4(vec3(res), 0.);
}
`;

/********************
== Include shaders ==
********************/
Effect.IncludesShadersStore["perlinNoise"] = `
// 2D deterministic random sample
float random1(vec2 uv) {
    return fract(sin(dot(uv.xy, vec2(12.9898, 78.233))) * 43758.5453123);
}
vec2 random2(vec2 uv) {
    float n = random1(uv);
    return vec2(n, random1(n * vec2(
        fract(sin(dot(uv.xy, vec2(25.29671, 9572.257846)))), 
        fract(sin(dot(uv.yx, vec2(784.20364, 10592.3725))))
    )));
}

// Quintic spline
vec2 fade(vec2 t) {
    return t*t*t*(t*(t*6.0 - 15.0) + 10.0);
}

vec2 grad(vec2 p) {
    vec2 bob = random2(p);
    float a = bob.x * 2. * 3.14159 + (1.0 + bob.y);
    return vec2(sin(a), cos(a));
}

float perlin(vec2 uv) {
    vec2 p0 = floor(uv);
    vec2 p1 = p0 + vec2(1., 0.);
    vec2 p2 = p0 + vec2(0., 1.);
    vec2 p3 = p0 + 1.;
    
    vec2 t = fade(uv-p0);
    
    vec2 g0 = grad(p0);
  	vec2 g1 = grad(p1);
  	vec2 g2 = grad(p2);
  	vec2 g3 = grad(p3);
    
  	float p0p1 = (1. - t.x) * dot(g0, (uv - p0)) + t.x * dot(g1, (uv - p1)); 
  	float p2p3 = (1. - t.x) * dot(g2, (uv - p2)) + t.x * dot(g3, (uv - p3)); 
  	
    return (1.0 - t.y) * p0p1 + t.y * p2p3;
}

// max 16
float octave(vec2 uv, int detail) {
    float total = 0.;
    for (int i = 0; i < 16; i ++) {
        if (i >= detail) break;
        float tmp = float(i);
        total += perlin(uv * pow(2., tmp)) / pow(2., tmp);
    }
    return total;
}

// credit to Inigo Quilez
// https://www.shadertoy.com/view/lsf3WH
float noise(vec2 st) {
    vec2 i = floor(st);
    vec2 f = fract(st);
    vec2 u = f*f*(3.0-2.0*f);
    return mix( mix( random1( i + vec2(0.0,0.0) ),
                     random1( i + vec2(1.0,0.0) ), u.x),
                mix( random1( i + vec2(0.0,1.0) ),
                     random1( i + vec2(1.0,1.0) ), u.x), u.y);
}
`;

Effect.IncludesShadersStore["lighting"] = `
vec3 phong(vec3 cameraDir, vec3 lightPos, vec3 position, vec3 normal, vec3 color, float glossiness) {
	vec3 lightDir = normalize(lightPos - position);

    float ndl = max(0., dot(normal, lightDir));

    vec3 angleW = normalize(cameraDir + lightDir);
    float specComp = max(0., dot(normal, angleW));
    specComp = pow(specComp, max(1., glossiness));

    return color * ndl + vec3(specComp);
}

vec3 hemi(vec3 cameraDir, vec3 lightDir, vec3 position, vec3 normal, vec3 upColor, vec3 downColor, float glossiness) {
	float ndl = dot(normal, lightDir) * 0.5 + 0.5;

    vec3 angleW = normalize(cameraDir + lightDir);
    float specComp = max(0., dot(normal, angleW));
    specComp = pow(specComp, max(1., glossiness));

	return mix(downColor, upColor, ndl);// + vec3(specComp);
}

vec3 directional(vec3 cameraDir, vec3 lightDir, vec3 position, vec3 normal, vec3 color, float glossiness) {
    float ndl = max(0., dot(normal, lightDir));

    vec3 angleW = normalize(cameraDir + lightDir);
    float specComp = max(0., dot(normal, angleW));
    specComp = pow(specComp, max(1., glossiness));

    return color * ndl + vec3(specComp);
}
`;

/*********************
== Helper functions ==
*********************/
function CreateSphere(
    name: string, 
    color: Color3, 
    options?: {
        segments?: number;
        diameter?: number;
        diameterX?: number;
        diameterY?: number;
        diameterZ?: number;
        arc?: number;
        slice?: number;
        sideOrientation?: number;
        frontUVs?: Vector4;
        backUVs?: Vector4;
        updatable?: boolean; 
    }, 
    scene?: Scene
) {
    let mat = new StandardMaterial(name + "_material", scene);
    mat.diffuseColor = color;
    let sphere = MeshBuilder.CreateSphere(name, options, scene);
    sphere.material = mat;
    return sphere;
}

/**********************************
== Ping-pong RenderTargetTexture ==
**********************************/
class PingPongRTT {
    private rtt1: RenderTargetTexture;
    private rtt2: RenderTargetTexture;
    private toggle: boolean = true;

    constructor(
        name: string, 
        size: number | 
            { width: number; height: number; layers?: number; } | 
            { ratio: number; }, 
        scene?: Scene, 
        options?: RenderTargetTextureOptions
    ) {
        this.rtt1 = new RenderTargetTexture(name + "1", size, scene, options);
        this.rtt2 = new RenderTargetTexture(name + "2", size, scene, options);
        this.rtt1.clearColor = new Color4(0, 0, 0, 0);
        this.rtt2.clearColor = new Color4(0, 0, 0, 0);
        this.rtt1.wrapR = 0;
        this.rtt1.wrapU = 0;
        this.rtt1.wrapV = 0;
        this.rtt2.wrapR = 0;
        this.rtt2.wrapU = 0;
        this.rtt2.wrapV = 0;
    }

    get activeRTT(): RenderTargetTexture {
        return this.toggle ? this.rtt1 : this.rtt2;
    }

    get inactiveRTT(): RenderTargetTexture {
        return this.toggle ? this.rtt2 : this.rtt1;
    }

    set activeCamera(camera: Camera) {
        this.rtt1.activeCamera = camera;
        this.rtt2.activeCamera = camera;
    }

    render() {
        this.activeRTT.render();
        this.swap();
    }

    swap(): void {
        this.toggle = !this.toggle;
    }

    addMesh(...meshes: AbstractMesh[]) {
        this.rtt1.renderList?.push(...meshes);
        this.rtt2.renderList?.push(...meshes);
    }

    setMaterialForRendering(mesh: AbstractMesh | AbstractMesh[], material?: Material | Material[]) {
        this.rtt1.setMaterialForRendering(mesh, material);
        this.rtt2.setMaterialForRendering(mesh, material);
    }
}

/**************
== Constants ==
**************/
// It ends up being important that we sample an equal distribution around
//  each "dissipated" point in the distance textures. If not, we see
//  visible streaking in cardinal or ordinal directions
const coords: number[] = [];
for (let i = 0; i < 8; i ++) {
    coords.push(Math.cos(Math.PI * i / 4), Math.sin(Math.PI * i / 4));
}

