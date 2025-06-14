<template>
  <div ref="babylonCanvasContainer" class="babylon-canvas-container">
    <canvas ref="babylonCanvas" class="babylon-canvas"></canvas>
  </div>
</template>

<script lang="ts" setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { Engine, type IFluidRenderingRenderObject, Observer, FluidRenderingObject, Scene, ArcRotateCamera, Vector3, Color3, VertexBuffer, AbstractEngine, FluidRenderer, FluidRenderingObjectCustomParticles, Tools, type Nullable, Mesh, Matrix, Quaternion, TmpVectors, PointerDragBehavior, MeshBuilder, PBRMaterial, Texture, CSG, CSG2, GroundMesh, SceneLoader, type ISceneLoaderAsyncResult } from '@babylonjs/core'
import JSZip from 'jszip';

const marbleBaseColor = "https://popov72.github.io/FluidRendering/src/assets/materials/Marble08_1K_BaseColor.png";
const rockRoughness = "https://popov72.github.io/FluidRendering/src/assets/materials/sulphuric-rock_roughness.png";
const rockBaseColor = "https://popov72.github.io/FluidRendering/src/assets/materials/sulphuric-rock_albedo.png";
const rockNormal = "https://popov72.github.io/FluidRendering/src/assets/materials/sulphuric-rock_normal-ogl.png";

const eps = 0.0001;

const eps1 = new Vector3(eps, -eps, -eps);
const eps2 = new Vector3(-eps, -eps, eps);
const eps3 = new Vector3(-eps, eps, -eps);
const eps4 = new Vector3(eps, eps, eps);

const dir1 = new Vector3(1, -1, -1);
const dir2 = new Vector3(-1, -1, 1);
const dir3 = new Vector3(-1, 1, -1);
const dir4 = new Vector3(1, 1, 1);

// 宣告一個可參考的 canvas 變數
const babylonCanvas = ref<HTMLCanvasElement | null>(null)
const babylonCanvasContainer = ref<HTMLDivElement | null>(null)

interface ICollisionShape {
  params: Array<any>;
  sdEvaluate: (p: Vector3, ...args: any[]) => number;
  computeNormal: (
    pos: Vector3,
    shape: ICollisionShape,
    normal: Vector3
  ) => void;
  createMesh?: (
    scene: Scene,
    shape: ICollisionShape,
    ...args: any[]
  ) => Promise<Mesh>;
  transf: Matrix;
  invTransf: Matrix;
  scale: number;
  position?: Vector3;
  rotation?: Vector3;
  rotationQuaternion?: Quaternion;
  mesh?: Mesh;
  dragPlane: Nullable<Vector3>;
  disabled?: boolean;
  collisionRestitution?: number;
}

// Playground 類，用來創建 BabylonJS 的場景並渲染流體
class Playground {
  public static async CreateScene(engine: Engine, canvas: HTMLCanvasElement): Promise<Scene> {
    // This creates a basic Babylon Scene object (non-mesh)
    var scene = new Scene(engine)

    const cameraMin = 0.1
    const cameraMax = 1000

    const createCamera = () => {
      const camera = new ArcRotateCamera(
        "ArcRotateCamera",
        3.06,
        1.14,
        2.96,
        new Vector3(0, 0, 0),
        scene
      )
      camera.fov = (60 * Math.PI) / 180
      camera.attachControl()
      camera.minZ = cameraMin
      camera.maxZ = cameraMax
      camera.wheelPrecision = 50
      camera.inputs.removeByType("ArcRotateCameraKeyboardMoveInput")

      return camera
    }

    const camera = createCamera()
    scene.activeCamera = camera

    FluidSimulationDemoBase.AddDemo(
      "Precomputed particles - rendering only",
      () => new FluidSimulationDemoPrecomputeRendering(scene)
    )

    FluidSimulationDemoBase.StartDemo(0)

    scene.onDisposeObservable.add(() => {
      FluidSimulationDemoBase.Dispose()
    })

    return scene
  }
}

const assetsDir = "https://popov72.github.io/FluidRendering/src/assets/"

class FluidSimulationDemoBase {
  protected _scene: Scene;
  protected _engine: AbstractEngine;
  protected _environmentFile: string;
  protected _noFluidSimulation: boolean;

  protected _fluidRenderer: FluidRenderer;
  protected _fluidRenderObject: IFluidRenderingRenderObject;
  protected _fluidSim: Nullable<FluidSimulator>;
  protected _particleGenerator: Nullable<ParticleGenerator>;
  protected _numParticles: number;
  protected _paused: boolean;
  protected _sceneObserver: Nullable<Observer<Scene>>;
  protected _loadParticlesFromFile: boolean;
  protected _shapeCollisionRestitution: number;
  protected _collisionObjectPromises: Array<
    Promise<[Nullable<Mesh>, ICollisionShape]>
  >;
  protected _collisionObjects: Array<
    [Nullable<Mesh>, ICollisionShape]
  >;

  protected static _DemoList: Array<{
    name: string;
    factory: () => FluidSimulationDemoBase;
  }> = [];
  protected static _CurrentDemo: FluidSimulationDemoBase;
  protected static _CurrentDemoIndex: number;

  public static AddDemo(
    name: string,
    factory: () => FluidSimulationDemoBase
  ): void {
    FluidSimulationDemoBase._DemoList.push({ name, factory });
  }

  public static StartDemo(index: number): void {
    FluidSimulationDemoBase._CurrentDemo?.dispose();
    FluidSimulationDemoBase._CurrentDemoIndex = index;
    FluidSimulationDemoBase._CurrentDemo =
      FluidSimulationDemoBase._DemoList[index].factory();
    FluidSimulationDemoBase._CurrentDemo.run();
  }

  public static Dispose(): void {
    FluidSimulationDemoBase._CurrentDemo?.dispose();
  }

  constructor(
    scene: Scene,
    noFluidSimulation = false,
    particleFileName?: string
  ) {
    this._scene = scene;
    this._engine = scene.getEngine();
    this._fluidRenderer = scene.enableFluidRenderer()!;
    this._numParticles = 6000;
    this._paused = false;
    this._sceneObserver = null;
    this._fluidSim = null;
    this._particleGenerator = null;
    this._loadParticlesFromFile = particleFileName !== undefined;
    this._shapeCollisionRestitution = 0.999;
    this._collisionObjectPromises = [];
    this._collisionObjects = [];
    this._environmentFile = "Environment";
    this._noFluidSimulation = noFluidSimulation;

    const particleRadius = 0.02;
    const camera = scene.activeCameras?.[0] ?? scene.activeCamera!;

    camera.storeState();

    // Setup the fluid renderer object
    this._fluidRenderObject = this._fluidRenderer.addCustomParticles(
      {},
      0,
      false,
      undefined,
      camera
    );

    this._fluidRenderObject.targetRenderer.enableBlurDepth = true;
    this._fluidRenderObject.targetRenderer.blurDepthFilterSize = 20;
    this._fluidRenderObject.targetRenderer.blurDepthNumIterations = 5;
    this._fluidRenderObject.targetRenderer.blurDepthDepthScale = 10;
    this._fluidRenderObject.targetRenderer.fluidColor = new Color3(
      1 - 0.5,
      1 - 0.2,
      1 - 0.05
    );
    this._fluidRenderObject.targetRenderer.density = 2.2;
    this._fluidRenderObject.targetRenderer.refractionStrength = 0.02;
    this._fluidRenderObject.targetRenderer.specularPower = 150;
    this._fluidRenderObject.targetRenderer.blurThicknessFilterSize = 10;
    this._fluidRenderObject.targetRenderer.blurThicknessNumIterations = 2;
    this._fluidRenderObject.targetRenderer.dirLight = new Vector3(
      2,
      -1,
      1
    );
    this._fluidRenderObject.object.particleSize = particleRadius * 2 * 2;
    this._fluidRenderObject.object.particleThicknessAlpha =
      this._fluidRenderObject.object.particleSize;
    this._fluidRenderObject.object.useVelocity =
      this._fluidRenderObject.targetRenderer.useVelocity;
    this._fluidRenderObject.targetRenderer.minimumThickness =
      this._fluidRenderObject.object.particleThicknessAlpha / 2;

    // Setup the fluid simulator / particle generator
    if (!noFluidSimulation) {
      this._fluidSim = new FluidSimulator();

      this._fluidSim.smoothingRadius = particleRadius * 2;
      this._fluidSim.maxVelocity = 3;

      (window as any).fsim = this._fluidSim;

      this._particleGenerator = new ParticleGenerator(
        this._scene,
        particleFileName
      );
      this._particleGenerator.particleRadius =
        this._fluidSim.smoothingRadius / 2;
      this._particleGenerator.position.y = 0.5;
    }
  }

  public async run() {

    this._collisionObjects = await Promise.all(
      this._collisionObjectPromises
    );

    this._run();
  }

  protected async _run() {
    await this._generateParticles();

    if (this._particleGenerator && this._loadParticlesFromFile) {
      this._numParticles = this._particleGenerator.currNumParticles;
    }

    if (!this._noFluidSimulation) {
      this._sceneObserver = this._scene.onBeforeRenderObservable.add(
        () => {
          this._fluidSim!.currentNumParticles = Math.min(
            this._numParticles,
            this._particleGenerator!.currNumParticles
          );
          (
            this._fluidRenderObject
              .object as FluidRenderingObjectCustomParticles
          ).setNumParticles(this._fluidSim!.currentNumParticles);

          if (!this._paused) {
            this._fluidSim!.update(1 / 100);
            this._checkCollisions(
              this._fluidRenderObject.object.particleSize / 2
            );
          }

          if (
            this._fluidRenderObject &&
            this._fluidRenderObject.object.vertexBuffers["position"]
          ) {
            this._fluidRenderObject.object.vertexBuffers[
              "position"
            ].updateDirectly(this._fluidSim!.positions, 0);
            this._fluidRenderObject.object.vertexBuffers[
              "velocity"
            ].updateDirectly(this._fluidSim!.velocities, 0);
          }
        }
      );
    }
  }

  public disposeCollisionObject(index: number): void {
    const shape = this._collisionObjects[index][1];

    shape?.mesh?.material?.dispose();
    shape?.mesh?.dispose();

    this._collisionObjects.splice(index, 1);
    this._collisionObjectPromises.splice(index, 1);
  }

  public dispose(): void {
    while (this._collisionObjects.length > 0) {
      this.disposeCollisionObject(0);
    }

    this._scene.onBeforeRenderObservable.remove(this._sceneObserver);
    this._fluidSim?.dispose();
    this._particleGenerator?.dispose();
    this._fluidRenderer.removeRenderObject(this._fluidRenderObject);

    const camera =
      this._scene.activeCameras?.[0] ?? this._scene.activeCamera;

    (camera as ArcRotateCamera)?._restoreStateValues();
  }

  public addCollisionSphere(
    position: Vector3,
    radius: number,
    dragPlane: Nullable<Vector3> = new Vector3(
      0,
      1,
      0
    ),
    collisionRestitution?: number,
    dontCreateMesh?: boolean
  ): Promise<[Nullable<Mesh>, ICollisionShape]> {
    const collisionShape = {
      params: [radius],
      createMesh: SDFHelper.CreateSphere,
      sdEvaluate: SDFHelper.SDSphere,
      computeNormal: SDFHelper.ComputeSDFNormal,
      position: position.clone(),
      mesh: null as any,
      transf: new Matrix(),
      scale: 1,
      invTransf: new Matrix(),
      dragPlane,
      collisionRestitution,
    };

    const promise: Promise<
      [Nullable<Mesh>, ICollisionShape]
    > = dontCreateMesh
        ? Promise.resolve([null, collisionShape])
        : this._createMeshForCollision(collisionShape);

    this._collisionObjectPromises.push(promise);

    return promise;
  }

  public addCollisionBox(
    position: Vector3,
    rotation: Vector3,
    extents: Vector3,
    dragPlane: Nullable<Vector3> = new Vector3(
      0,
      1,
      0
    ),
    collisionRestitution?: number,
    dontCreateMesh?: boolean
  ): Promise<[Nullable<Mesh>, ICollisionShape]> {
    const collisionShape = {
      params: [extents.clone()],
      createMesh: SDFHelper.CreateBox,
      sdEvaluate: SDFHelper.SDBox,
      computeNormal: SDFHelper.ComputeSDFNormal,
      rotation: rotation.clone(),
      position: position.clone(),
      mesh: null as any,
      transf: new Matrix(),
      scale: 1,
      invTransf: new Matrix(),
      dragPlane,
      collisionRestitution,
    };

    const promise: Promise<
      [Nullable<Mesh>, ICollisionShape]
    > = dontCreateMesh
        ? Promise.resolve([null, collisionShape])
        : this._createMeshForCollision(collisionShape);

    this._collisionObjectPromises.push(promise);

    return promise;
  }

  public addCollisionPlane(
    normal: Vector3,
    d: number,
    collisionRestitution?: number
  ): Promise<[Nullable<Mesh>, ICollisionShape]> {
    const collisionShape = {
      params: [normal.clone(), d],
      sdEvaluate: SDFHelper.SDPlane,
      computeNormal: SDFHelper.ComputeSDFNormal,
      mesh: null as any,
      position: new Vector3(0, 0, 0),
      rotation: new Vector3(0, 0, 0),
      transf: Matrix.Identity(),
      scale: 1,
      invTransf: Matrix.Identity(),
      dragPlane: null,
      collisionRestitution,
    };

    const promise: Promise<
      [Nullable<Mesh>, ICollisionShape]
    > = Promise.resolve([null, collisionShape]);

    this._collisionObjectPromises.push(promise);

    return promise;
  }

  public addCollisionCutHollowSphere(
    position: Vector3,
    rotation: Vector3,
    radius: number,
    planeDist: number,
    thickness: number,
    segments: number,
    dragPlane: Nullable<Vector3> = new Vector3(
      0,
      1,
      0
    ),
    collisionRestitution?: number,
    dontCreateMesh?: boolean
  ): Promise<[Nullable<Mesh>, ICollisionShape]> {
    const collisionShape = {
      params: [radius, planeDist, thickness, segments],
      createMesh: SDFHelper.CreateCutHollowSphere,
      sdEvaluate: SDFHelper.SDCutHollowSphere,
      computeNormal: SDFHelper.ComputeSDFNormal,
      rotation: rotation.clone(),
      position: position.clone(),
      mesh: null as any,
      transf: new Matrix(),
      scale: 1,
      invTransf: new Matrix(),
      dragPlane,
      collisionRestitution,
    };

    const promise: Promise<
      [Nullable<Mesh>, ICollisionShape]
    > = dontCreateMesh
        ? Promise.resolve([null, collisionShape])
        : this._createMeshForCollision(collisionShape);

    this._collisionObjectPromises.push(promise);

    return promise;
  }

  public addCollisionVerticalCylinder(
    position: Vector3,
    rotation: Vector3,
    radius: number,
    height: number,
    segments: number,
    dragPlane: Nullable<Vector3> = new Vector3(
      0,
      1,
      0
    ),
    collisionRestitution?: number,
    dontCreateMesh?: boolean
  ): Promise<[Nullable<Mesh>, ICollisionShape]> {
    const collisionShape = {
      params: [radius, height, segments],
      createMesh: SDFHelper.CreateVerticalCylinder,
      sdEvaluate: SDFHelper.SDVerticalCylinder,
      computeNormal: SDFHelper.ComputeSDFNormal,
      rotation: rotation.clone(),
      position: position.clone(),
      mesh: null as any,
      transf: new Matrix(),
      scale: 1,
      invTransf: new Matrix(),
      dragPlane,
      collisionRestitution,
    };

    const promise: Promise<
      [Nullable<Mesh>, ICollisionShape]
    > = dontCreateMesh
        ? Promise.resolve([null, collisionShape])
        : this._createMeshForCollision(collisionShape);

    this._collisionObjectPromises.push(promise);

    return promise;
  }

  public addCollisionMesh(
    position: Vector3,
    rotation: Vector3,
    meshFilename: string,
    sdfFilename: string,
    createNormals = false,
    scale = 1,
    dragPlane: Nullable<Vector3> = new Vector3(
      0,
      1,
      0
    ),
    collisionRestitution?: number,
    dontCreateMesh?: boolean
  ): Promise<[Nullable<Mesh>, ICollisionShape]> {
    const collisionShape = {
      params: [meshFilename, sdfFilename, createNormals],
      createMesh: SDFHelper.CreateMesh,
      sdEvaluate: SDFHelper.SDMesh,
      computeNormal: SDFHelper.ComputeSDFNormal,
      rotation: rotation.clone(),
      position: position.clone(),
      mesh: null as any,
      transf: new Matrix(),
      scale,
      invTransf: new Matrix(),
      dragPlane,
      collisionRestitution,
    };

    const promise: Promise<
      [Nullable<Mesh>, ICollisionShape]
    > = dontCreateMesh
        ? Promise.resolve([null, collisionShape])
        : this._createMeshForCollision(collisionShape);

    this._collisionObjectPromises.push(promise);

    return promise;
  }

  public addCollisionTerrain(
    size: number
  ): Promise<[Nullable<Mesh>, ICollisionShape]> {
    const collisionShape = {
      params: [size],
      createMesh: SDFHelper.CreateTerrain,
      sdEvaluate: SDFHelper.SDTerrain,
      computeNormal: SDFHelper.ComputeTerrainNormal,
      mesh: null as any,
      transf: new Matrix(),
      scale: 1,
      invTransf: new Matrix(),
      dragPlane: null,
    };

    const promise: Promise<
      [Nullable<Mesh>, ICollisionShape]
    > = this._createMeshForCollision(collisionShape);

    this._collisionObjectPromises.push(promise);

    return promise;
  }

  protected async _createMeshForCollision(
    shape: ICollisionShape
  ): Promise<[Nullable<Mesh>, ICollisionShape]> {
    const mesh = await shape.createMesh?.(
      this._scene,
      shape,
      ...shape.params
    );

    shape.position = shape.position ?? new Vector3(0, 0, 0);
    if (!shape.rotation && !shape.rotationQuaternion) {
      shape.rotation = new Vector3(0, 0, 0);
    }

    if (!mesh) {
      return [null, shape];
    }

    mesh.position = shape.position;
    if (shape.rotation) {
      mesh.rotation = shape.rotation;
    } else {
      mesh.rotationQuaternion = shape.rotationQuaternion!;
    }

    shape.mesh = mesh;

    if (shape.dragPlane) {
      const camera =
        this._scene.activeCameras?.[0] ?? this._scene.activeCamera!;

      const pointerDragBehavior = new PointerDragBehavior({
        dragPlaneNormal: shape.dragPlane,
      });
      pointerDragBehavior.useObjectOrientationForDragging = false;

      pointerDragBehavior.onDragStartObservable.add(() => {
        camera.detachControl();
      });

      pointerDragBehavior.onDragEndObservable.add(() => {
        camera.attachControl();
      });

      mesh.addBehavior(pointerDragBehavior);
    }

    return [mesh, shape];
  }

  protected async _generateParticles(regenerateAll = true) {
    await this._particleGenerator?.generateParticles(
      this._numParticles,
      regenerateAll
    );

    if (
      this._fluidSim &&
      this._particleGenerator &&
      this._fluidSim.positions !== this._particleGenerator.positions
    ) {
      this._fluidSim.setParticleData(
        this._particleGenerator.positions,
        this._particleGenerator.velocities
      );

      this._fluidRenderObject.object.vertexBuffers["position"]?.dispose();
      this._fluidRenderObject.object.vertexBuffers["velocity"]?.dispose();

      this._fluidRenderObject.object.vertexBuffers["position"] =
        new VertexBuffer(
          this._engine,
          this._fluidSim.positions,
          VertexBuffer.PositionKind,
          true,
          false,
          3,
          true
        );
      this._fluidRenderObject.object.vertexBuffers["velocity"] =
        new VertexBuffer(
          this._engine,
          this._fluidSim.velocities,
          "velocity",
          true,
          false,
          3,
          true
        );
    }
  }


  protected _onPaused(value: boolean) {
    this._paused = value;
  }

  protected _checkCollisions(particleRadius: number): void {
    if (this._collisionObjects.length === 0) {
      return;
    }

    const positions = this._fluidSim!.positions;
    const velocities = this._fluidSim!.velocities;

    const tmpQuat = TmpVectors.Quaternion[0];
    const tmpScale = TmpVectors.Vector3[0];

    tmpScale.copyFromFloats(1, 1, 1);

    for (let i = 0; i < this._collisionObjects.length; ++i) {
      const shape = this._collisionObjects[i][1];

      const quat =
        shape.mesh?.rotationQuaternion ??
        shape.rotationQuaternion ??
        Quaternion.FromEulerAnglesToRef(
          shape.mesh?.rotation.x ?? shape.rotation!.x,
          shape.mesh?.rotation.y ?? shape.rotation!.y,
          shape.mesh?.rotation.z ?? shape.rotation!.z,
          tmpQuat
        );
      Matrix.ComposeToRef(
        tmpScale,
        quat,
        shape.mesh?.position ?? shape.position!,
        shape.transf
      );

      shape.transf.invertToRef(shape.invTransf);
    }

    const pos = TmpVectors.Vector3[4];
    const normal = TmpVectors.Vector3[7];

    for (let a = 0; a < this._fluidSim!.currentNumParticles; ++a) {
      const px = positions[a * 3 + 0];
      const py = positions[a * 3 + 1];
      const pz = positions[a * 3 + 2];

      for (let i = 0; i < this._collisionObjects.length; ++i) {
        const shape = this._collisionObjects[i][1];
        if (shape.disabled) {
          continue;
        }

        pos.copyFromFloats(px, py, pz);
        Vector3.TransformCoordinatesToRef(
          pos,
          shape.invTransf,
          pos
        );
        pos.scaleInPlace(1 / shape.scale);
        const dist =
          shape.scale * shape.sdEvaluate(pos, ...shape.params) -
          particleRadius;
        if (dist < 0) {
          shape.computeNormal(pos, shape, normal);

          const restitution =
            shape.collisionRestitution ??
            this._shapeCollisionRestitution;

          const dotvn =
            velocities[a * 3 + 0] * normal.x +
            velocities[a * 3 + 1] * normal.y +
            velocities[a * 3 + 2] * normal.z;

          velocities[a * 3 + 0] =
            (velocities[a * 3 + 0] - 2 * dotvn * normal.x) *
            restitution;
          velocities[a * 3 + 1] =
            (velocities[a * 3 + 1] - 2 * dotvn * normal.y) *
            restitution;
          velocities[a * 3 + 2] =
            (velocities[a * 3 + 2] - 2 * dotvn * normal.z) *
            restitution;

          positions[a * 3 + 0] -= normal.x * dist;
          positions[a * 3 + 1] -= normal.y * dist;
          positions[a * 3 + 2] -= normal.z * dist;
        }
      }
    }
  }
}

interface IFluidParticle {
  mass: number;
  density: number;
  pressure: number;
  accelX: number;
  accelY: number;
  accelZ: number;
}

class FluidSimulator {
  protected _particles: IFluidParticle[];
  protected _numMaxParticles: number;
  protected _positions: Float32Array;
  protected _velocities: Float32Array;
  protected _hash: Hash;

  protected _smoothingRadius2: number;
  protected _poly6Constant: number;
  protected _spikyConstant: number;
  protected _viscConstant: number;

  protected _smoothingRadius = 0.2;

  public get smoothingRadius() {
    return this._smoothingRadius;
  }

  public set smoothingRadius(radius: number) {
    this._smoothingRadius = radius;
    this._computeConstants();
  }

  public densityReference = 2000;

  public pressureConstant = 20;

  public viscosity = 0.005;

  public gravity = new Vector3(0, -9.8, 0);

  public minTimeStep = 1 / 100;

  public maxVelocity = 75;

  public maxAcceleration = 2000;

  public currentNumParticles: number;

  private _mass: number;

  public get mass() {
    return this._mass;
  }

  public set mass(m: number) {
    for (let i = 0; i < this._particles.length; ++i) {
      this._particles[i].mass = m;
    }
  }

  private _computeConstants(): void {
    this._smoothingRadius2 = this._smoothingRadius * this._smoothingRadius;
    this._poly6Constant =
      315 / (64 * Math.PI * Math.pow(this._smoothingRadius, 9));
    this._spikyConstant =
      -45 / (Math.PI * Math.pow(this._smoothingRadius, 6));
    this._viscConstant =
      45 / (Math.PI * Math.pow(this._smoothingRadius, 6));
    this._hash = new Hash(this._smoothingRadius, this._numMaxParticles);
  }

  public get positions() {
    return this._positions;
  }

  public get velocities() {
    return this._velocities;
  }

  public get numMaxParticles() {
    return this._numMaxParticles;
  }

  public setParticleData(
    positions?: Float32Array,
    velocities?: Float32Array
  ): void {
    this._positions = positions ?? new Float32Array();
    this._velocities = velocities ?? new Float32Array();
    this._numMaxParticles = this._positions.length / 3;
    this._hash = new Hash(this._smoothingRadius, this._numMaxParticles);

    for (let i = this._particles.length; i < this._numMaxParticles; ++i) {
      this._particles.push({
        mass: this.mass,
        density: 0,
        pressure: 0,
        accelX: 0,
        accelY: 0,
        accelZ: 0,
      });
    }
  }

  constructor(positions?: Float32Array, velocities?: Float32Array, mass = 1) {
    this._positions = undefined as any;
    this._velocities = undefined as any;
    this._particles = [];
    this._numMaxParticles = 0;
    this._mass = mass;

    if (positions && velocities) {
      this.setParticleData(positions, velocities);
    }

    this._hash = new Hash(this._smoothingRadius, this._numMaxParticles);

    this.currentNumParticles = this._numMaxParticles;

    this._smoothingRadius2 = 0;
    this._poly6Constant = 0;
    this._spikyConstant = 0;
    this._viscConstant = 0;

    this._computeConstants();
  }

  public update(deltaTime: number): void {
    let timeLeft = deltaTime;

    while (timeLeft > 0) {
      this._hash.create(this._positions, this.currentNumParticles);
      this._computeDensityAndPressure();
      this._computeAcceleration();

      let timeStep = this._calculateTimeStep();

      timeLeft -= timeStep;
      if (timeLeft < 0) {
        timeStep += timeLeft;
        timeLeft = 0;
      }

      this._updatePositions(timeStep);
    }
  }

  public dispose(): void {
    // nothing to do
  }

  protected _computeDensityAndPressure(): void {
    for (let a = 0; a < this.currentNumParticles; ++a) {
      const pA = this._particles[a];
      const paX = this._positions[a * 3 + 0];
      const paY = this._positions[a * 3 + 1];
      const paZ = this._positions[a * 3 + 2];

      pA.density = 0;

      this._hash.query(this._positions, a, this._smoothingRadius);

      for (let ib = 0; ib < this._hash.querySize; ++ib) {
        const b = this._hash.queryIds[ib];
        const diffX = paX - this._positions[b * 3 + 0];
        const diffY = paY - this._positions[b * 3 + 1];
        const diffZ = paZ - this._positions[b * 3 + 2];
        const r2 = diffX * diffX + diffY * diffY + diffZ * diffZ;

        if (r2 < this._smoothingRadius2) {
          const w =
            this._poly6Constant *
            Math.pow(this._smoothingRadius2 - r2, 3);
          pA.density += w;
        }
      }

      pA.density = Math.max(this.densityReference, pA.density);
      pA.pressure =
        this.pressureConstant * (pA.density - this.densityReference);
    }
  }

  protected _computeAcceleration(): void {
    // Pressurce-based acceleration + viscosity-based acceleration computation
    for (let a = 0; a < this.currentNumParticles; ++a) {
      const pA = this._particles[a];
      const paX = this._positions[a * 3 + 0];
      const paY = this._positions[a * 3 + 1];
      const paZ = this._positions[a * 3 + 2];

      const vaX = this._velocities[a * 3 + 0];
      const vaY = this._velocities[a * 3 + 1];
      const vaZ = this._velocities[a * 3 + 2];

      let pressureAccelX = 0;
      let pressureAccelY = 0;
      let pressureAccelZ = 0;

      let viscosityAccelX = 0;
      let viscosityAccelY = 0;
      let viscosityAccelZ = 0;

      this._hash.query(this._positions, a, this._smoothingRadius);

      for (let ib = 0; ib < this._hash.querySize; ++ib) {
        const b = this._hash.queryIds[ib];
        let diffX = paX - this._positions[b * 3 + 0];
        let diffY = paY - this._positions[b * 3 + 1];
        let diffZ = paZ - this._positions[b * 3 + 2];
        const r2 = diffX * diffX + diffY * diffY + diffZ * diffZ;
        const r = Math.sqrt(r2);

        if (r > 0 && r2 < this._smoothingRadius2) {
          const pB = this._particles[b];

          diffX /= r;
          diffY /= r;
          diffZ /= r;

          const w =
            this._spikyConstant *
            (this._smoothingRadius - r) *
            (this._smoothingRadius - r);
          const massRatio = pB.mass / pA.mass;
          const fp =
            w *
            ((pA.pressure + pB.pressure) /
              (2 * pA.density * pB.density)) *
            massRatio;

          pressureAccelX -= fp * diffX;
          pressureAccelY -= fp * diffY;
          pressureAccelZ -= fp * diffZ;

          const w2 = this._viscConstant * (this._smoothingRadius - r);
          const fv =
            w2 * (1 / pB.density) * massRatio * this.viscosity;

          viscosityAccelX += fv * (this._velocities[b * 3 + 0] - vaX);
          viscosityAccelY += fv * (this._velocities[b * 3 + 1] - vaY);
          viscosityAccelZ += fv * (this._velocities[b * 3 + 2] - vaZ);
        }
      }

      pA.accelX = pressureAccelX + viscosityAccelX;
      pA.accelY = pressureAccelY + viscosityAccelY;
      pA.accelZ = pressureAccelZ + viscosityAccelZ;

      pA.accelX += this.gravity.x;
      pA.accelY += this.gravity.y;
      pA.accelZ += this.gravity.z;

      const mag = Math.sqrt(
        pA.accelX * pA.accelX +
        pA.accelY * pA.accelY +
        pA.accelZ * pA.accelZ
      );

      if (mag > this.maxAcceleration) {
        pA.accelX = (pA.accelX / mag) * this.maxAcceleration;
        pA.accelY = (pA.accelY / mag) * this.maxAcceleration;
        pA.accelZ = (pA.accelZ / mag) * this.maxAcceleration;
      }
    }
  }

  protected _calculateTimeStep() {
    let maxVelocity = 0;
    let maxAcceleration = 0;
    let maxSpeedOfSound = 0;

    for (let a = 0; a < this.currentNumParticles; ++a) {
      const pA = this._particles[a];

      const velSq =
        this._velocities[a * 3 + 0] * this._velocities[a * 3 + 0] +
        this._velocities[a * 3 + 1] * this._velocities[a * 3 + 1] +
        this._velocities[a * 3 + 2] * this._velocities[a * 3 + 2];
      const accSq =
        pA.accelX * pA.accelX +
        pA.accelY * pA.accelY +
        pA.accelZ * pA.accelZ;
      const spsSq = pA.density < 0.00001 ? 0 : pA.pressure / pA.density;

      if (velSq > maxVelocity) {
        maxVelocity = velSq;
      }
      if (accSq > maxAcceleration) {
        maxAcceleration = accSq;
      }
      if (spsSq > maxSpeedOfSound) {
        maxSpeedOfSound = spsSq;
      }
    }

    maxVelocity = Math.sqrt(maxVelocity);
    maxAcceleration = Math.sqrt(maxAcceleration);
    maxSpeedOfSound = Math.sqrt(maxSpeedOfSound);

    const velStep = (0.4 * this.smoothingRadius) / Math.max(1, maxVelocity);
    const accStep = 0.4 * Math.sqrt(this.smoothingRadius / maxAcceleration);
    const spsStep = this.smoothingRadius / maxSpeedOfSound;

    return Math.max(this.minTimeStep, Math.min(velStep, accStep, spsStep));
  }

  protected _updatePositions(deltaTime: number): void {
    for (let a = 0; a < this.currentNumParticles; ++a) {
      const pA = this._particles[a];

      this._velocities[a * 3 + 0] += pA.accelX * deltaTime;
      this._velocities[a * 3 + 1] += pA.accelY * deltaTime;
      this._velocities[a * 3 + 2] += pA.accelZ * deltaTime;

      const mag = Math.sqrt(
        this._velocities[a * 3 + 0] * this._velocities[a * 3 + 0] +
        this._velocities[a * 3 + 1] * this._velocities[a * 3 + 1] +
        this._velocities[a * 3 + 2] * this._velocities[a * 3 + 2]
      );

      if (mag > this.maxVelocity) {
        this._velocities[a * 3 + 0] =
          (this._velocities[a * 3 + 0] / mag) * this.maxVelocity;
        this._velocities[a * 3 + 1] =
          (this._velocities[a * 3 + 1] / mag) * this.maxVelocity;
        this._velocities[a * 3 + 2] =
          (this._velocities[a * 3 + 2] / mag) * this.maxVelocity;
      }

      this._positions[a * 3 + 0] +=
        deltaTime * this._velocities[a * 3 + 0];
      this._positions[a * 3 + 1] +=
        deltaTime * this._velocities[a * 3 + 1];
      this._positions[a * 3 + 2] +=
        deltaTime * this._velocities[a * 3 + 2];
    }
  }
}

class ParticleGenerator {
  private _scene: Scene;
  private _observer: Nullable<Observer<Scene>>;
  private _currNumParticles: number;
  private _numCrossSection: number;
  private _numParticles = 0;
  private _positions: Float32Array;
  private _velocities: Float32Array;
  private _loadFromFile: string | undefined;

  public particleRadius: number;

  public position: Vector3;

  public get currNumParticles() {
    return this._currNumParticles;
  }

  public get positions() {
    return this._positions;
  }

  public get velocities() {
    return this._velocities;
  }

  constructor(scene: Scene, loadFromFile?: string) {
    this._scene = scene;
    this._currNumParticles = 0;
    this._numCrossSection = 0;
    this._positions = new Float32Array();
    this._velocities = new Float32Array();
    this.particleRadius = 0;
    this._loadFromFile = loadFromFile;
    this.position = new Vector3(0, 0, 0);

    if (!this._loadFromFile) {
      this._observer = scene.onBeforeRenderObservable.add(() => {
        if (this._currNumParticles === 0) {
          if (this._positions.length / 3 >= this._numCrossSection) {
            this._currNumParticles = this._numCrossSection;
          }
        } else if (this._currNumParticles < this._numParticles) {
          const px1 = this._positions[this._currNumParticles * 3 + 0];
          const py1 = this._positions[this._currNumParticles * 3 + 1];
          const pz1 = this._positions[this._currNumParticles * 3 + 2];

          const px2 =
            this._positions[
            (this._currNumParticles - this._numCrossSection) *
            3 +
            0
            ];
          const py2 =
            this._positions[
            (this._currNumParticles - this._numCrossSection) *
            3 +
            1
            ];
          const pz2 =
            this._positions[
            (this._currNumParticles - this._numCrossSection) *
            3 +
            2
            ];

          const dist = Math.sqrt(
            (px1 - px2) * (px1 - px2) +
            (py1 - py2) * (py1 - py2) +
            (pz1 - pz2) * (pz1 - pz2)
          );

          if (dist > this.particleRadius * 2) {
            this._currNumParticles += this._numCrossSection;
          }
        }
      });
    } else {
      this._observer = null;
    }
  }

  public async generateParticles(
    numTotParticles: number,
    regenerateAll = true
  ) {
    if (this._loadFromFile) {
      await this._generateParticlesFromFile(this._loadFromFile);
    } else {
      this._generateParticles(numTotParticles, regenerateAll);
    }
  }

  private async _generateParticlesFromFile(fileName: string) {
    const data = await (
      await fetch(`https://popov72.github.io/FluidRendering/src/assets/particles/${fileName}.txt`)
    ).text();

    const lines = data.replace("\r", "").split("\n");

    const particlePos = [];
    const particleVel = [];

    let numParticles = 0;

    for (let i = 1; i < lines.length; ++i) {
      const line = lines[i];
      const vals = line.split(",");
      if (line.charAt(0) === '"' || vals.length < 4) {
        continue;
      }
      particlePos.push(
        parseFloat(vals[1]) + this.position.x,
        parseFloat(vals[2]) + +this.position.y,
        parseFloat(vals[3]) + this.position.z
      );
      particleVel.push(0, 0, 0);
      numParticles++;
    }

    const particleStartIndex = 0;

    this._numParticles = this._numCrossSection = numParticles;

    if (this._numParticles > this._positions.length / 3) {
      const newPositions = new Float32Array(this._numParticles * 3);
      const newVelocities = new Float32Array(this._numParticles * 3);

      newPositions.set(this._positions, 0);
      newVelocities.set(this._velocities, 0);

      this._positions = newPositions;
      this._velocities = newVelocities;
    }

    this._positions.set(particlePos, particleStartIndex * 3);
    this._velocities.set(particleVel, particleStartIndex * 3);

    this._currNumParticles = this._numParticles;
  }

  private _generateParticles(
    numTotParticles: number,
    regenerateAll = true
  ): void {
    if (this._numParticles >= numTotParticles && !regenerateAll) {
      this._numParticles = numTotParticles;
      this._currNumParticles = Math.min(
        this._currNumParticles,
        this._numParticles
      );
      return;
    }

    const dimX = 12,
      dimY = 12;

    const particlePos = [];
    const particleVel = [];

    const distance = this.particleRadius * 2;
    const jitter = distance * 0.1;
    const getJitter = () => Math.random() * jitter - jitter / 2;

    const particleStartIndex = regenerateAll ? 0 : this._currNumParticles;

    this._numParticles = particleStartIndex;

    while (this._numParticles <= numTotParticles - this._numCrossSection) {
      let yCoord = (dimY / 2) * distance;

      this._numCrossSection = 0;
      for (let y = 1; y < dimY - 1; ++y) {
        const angle = (y * Math.PI) / (dimY - 1);

        let x2 = ((Math.sin(angle) * dimX) / 2) * distance;
        if (x2 < 0) {
          x2 = 0;
        }

        let xCoord = -x2;
        while (xCoord <= x2) {
          const xc =
            xCoord === -x2 || xCoord + distance > x2
              ? xCoord
              : xCoord + getJitter();
          const yc =
            xCoord === -x2 || xCoord + distance > x2
              ? yCoord
              : yCoord + getJitter();
          const zCoord =
            xCoord === -x2 || xCoord + distance > x2
              ? 0.49
              : 0.49 + getJitter();
          particlePos.push(
            xc + this.position.x,
            yc + this.position.y,
            zCoord + this.position.z
          );
          particleVel.push(
            (Math.random() - 0.5) * 0.03,
            (Math.random() - 0.5) * 0.03,
            (Math.random() - 1.0) * 0.03 - 1.5
          );
          xCoord += distance;
          this._numParticles++;
          this._numCrossSection++;
        }

        yCoord += distance;
      }
    }

    if (this._numParticles > this._positions.length / 3) {
      const newPositions = new Float32Array(this._numParticles * 3);
      const newVelocities = new Float32Array(this._numParticles * 3);

      newPositions.set(this._positions, 0);
      newVelocities.set(this._velocities, 0);

      this._positions = newPositions;
      this._velocities = newVelocities;
    }

    this._positions.set(particlePos, particleStartIndex * 3);
    this._velocities.set(particleVel, particleStartIndex * 3);

    this._currNumParticles = particleStartIndex;
  }

  public dispose(): void {
    this._scene.onBeforeRenderObservable.remove(this._observer);
    this._observer = null;
  }
}

class FluidSimulationDemoPrecomputeRendering extends FluidSimulationDemoBase {
  private _animSpeed: number;
  private _assetsDir: string;
  private _generateFiles = false;
  private _readZipped = true;
  private _zipAsSingleFile = true;
  private _firstBuffer: ArrayBuffer | undefined;

  constructor(scene: Scene) {
    super(scene, true);

    this._animSpeed = 0.5;
    this._assetsDir = assetsDir;
  }

  protected zipAndDownload(buffer: ArrayBuffer, nameInZip: string, nameOfZipFile: string) {
    window.setTimeout(async () => {
      const zip = new JSZip();
      zip.file(nameInZip, buffer);
      const zipped = await zip.generateAsync({
        type: 'arraybuffer',
        compression: 'DEFLATE',
        compressionOptions: {
          level: 9
        }
      });
      Tools.DownloadBlob(new Blob([zipped], { type: "application/octet-stream" }), nameOfZipFile);
    }, 10);
  };

  protected async _unzip(buffer: ArrayBuffer, frame: number): Promise<ArrayBuffer | undefined> {
    let nm = "" + frame;
    while (nm.length < 4) nm = "0" + nm;

    return (await new JSZip().loadAsync(buffer)).file(nm)?.async("arraybuffer");
  }

  protected async _generateFrameFiles(positionBuffers: Array<Float32Array>, numFrames: number, numParticles: number, useLocalMinMax: boolean): Promise<void> {
    const minMaxDiff = [];
    let largestDiff = -1e10;
    let lowestDiff = 1e10;
    for (let i = 1; i < numFrames; ++i) {
      const prevPos = positionBuffers[i - 1];
      const pos = positionBuffers[i];
      let min = 1e10, max = -1e10;
      for (let p = 0; p < pos.length / 3; ++p) {
        const x = pos[p * 3 + 0];
        const y = pos[p * 3 + 1];
        const z = pos[p * 3 + 2];

        const difx = x - prevPos[p * 3 + 0];
        const dify = y - prevPos[p * 3 + 1];
        const difz = z - prevPos[p * 3 + 2];

        largestDiff = Math.max(largestDiff, difx, dify, difz);
        lowestDiff = Math.min(lowestDiff, difx, dify, difz);

        min = Math.min(min, difx, dify, difz);
        max = Math.max(max, difx, dify, difz);
      }
      minMaxDiff.push([min, max, max - min]);
    }

    const globalFullDiff = largestDiff - lowestDiff;

    const refPos = positionBuffers[0];
    const curApproxPos: number[] = Array.from(refPos);
    const diffs: Array<number[]> = [];

    for (let i = 1; i < numFrames; ++i) {
      const pos = positionBuffers[i];
      const newDiff = [];
      const scale = useLocalMinMax ? minMaxDiff[i - 1][2] : globalFullDiff;
      for (let p = 0; p < pos.length / 3; ++p) {
        const x = pos[p * 3 + 0];
        const y = pos[p * 3 + 1];
        const z = pos[p * 3 + 2];

        const difx = x - curApproxPos[p * 3 + 0];
        const dify = y - curApproxPos[p * 3 + 1];
        const difz = z - curApproxPos[p * 3 + 2];

        const qdifx = Math.round(127 * difx / scale);
        const qdify = Math.round(127 * dify / scale);
        const qdifz = Math.round(127 * difz / scale);

        newDiff.push(qdifx, qdify, qdifz);

        curApproxPos[p * 3 + 0] += qdifx * scale / 127;
        curApproxPos[p * 3 + 1] += qdify * scale / 127;
        curApproxPos[p * 3 + 2] += qdifz * scale / 127;
      }
      diffs.push(newDiff);
    }

    for (let i = 1; i < numFrames; ++i) {
      const diff = diffs[i - 1];
      const scale = useLocalMinMax ? minMaxDiff[i - 1][2] : globalFullDiff;
      for (let p = 0; p < diff.length / 3; ++p) {
        positionBuffers[i][p * 3 + 0] = positionBuffers[i - 1][p * 3 + 0] + (diff[p * 3 + 0] * scale / 127);
        positionBuffers[i][p * 3 + 1] = positionBuffers[i - 1][p * 3 + 1] + (diff[p * 3 + 1] * scale / 127);
        positionBuffers[i][p * 3 + 2] = positionBuffers[i - 1][p * 3 + 2] + (diff[p * 3 + 2] * scale / 127);
      }
    }

    let zip = new JSZip();

    if (this._zipAsSingleFile && this._firstBuffer) {
      zip.file("0001", this._firstBuffer);
    }

    for (let i = 1; i < numFrames; ++i) {
      let bufferSize = 4 + 4 + numParticles * 3 * 1;
      if (bufferSize & 3) {
        bufferSize = (bufferSize & ~3) + 4;
      }
      const buffer = new ArrayBuffer(bufferSize);
      const dataview = new DataView(buffer);
      let ofst = 0;
      dataview.setInt32(ofst, numParticles, true);
      dataview.setFloat32(ofst + 4, useLocalMinMax ? minMaxDiff[i - 1][2] : globalFullDiff, true);
      ofst += 8;
      for (let p = 0; p < diffs[i - 1].length; ++p) {
        dataview.setInt8(ofst++, diffs[i - 1][p]);
      }
      let nm = "" + (i + 1);
      while (nm.length < 4) nm = "0" + nm;

      if (this._zipAsSingleFile) {
        zip.file(nm, buffer);
      } else {
        this.zipAndDownload(buffer, nm, "frame." + nm + ".pos");
      }
    }

    if (this._zipAsSingleFile) {
      const zipped = await zip.generateAsync({
        type: 'arraybuffer',
        compression: 'DEFLATE',
        compressionOptions: {
          level: 9
        }
      });
      Tools.DownloadBlob(new Blob([zipped], { type: "application/octet-stream" }), "allFrames.pos");
    }
  }

  protected override async _run() {
    const camera =
      this._scene.activeCameras?.[0] ?? this._scene.activeCamera;

    if (camera) {
      (camera as ArcRotateCamera).alpha = -0.631;
      (camera as ArcRotateCamera).beta = 1.318;
      (camera as ArcRotateCamera).radius = 1.866;
    }

    let numFrames = 160;
    const positionBuffers: Array<Float32Array> = [];

    let numParticles = 0;

    const t1 = new Date().getTime();

    let zipLoaded: any;

    if (this._readZipped && this._zipAsSingleFile) {
      const buffer = await (
        await fetch(
          this._assetsDir + `particles/SphereDropGround/allFrames.pos`
        )
      ).arrayBuffer();

      zipLoaded = await new JSZip().loadAsync(buffer);

      console.log("zipLoaded:", zipLoaded);
    }

    for (let i = 0; i < numFrames; ++i) {
      let num = "" + (i + 1);
      while (num.length < 4) num = "0" + num;

      let buffer: ArrayBuffer;
      if (zipLoaded) {
        const zipFile = zipLoaded.file(num);
        if (zipFile) {
          buffer = await zipFile.async("arraybuffer");  // ✅ 正確
        } else {
          throw new Error(`File ${num} not found in ZIP`);
        }
      } else {
        buffer = await (
          await fetch(
            this._assetsDir + `particles/SphereDropGround${this._readZipped ? "Zipped" : ""}/frame.${num}.pos`
          )
        ).arrayBuffer();

        if (this._readZipped) {
          const unzippedBuffer = await this._unzip(buffer, i + 1);
          if (unzippedBuffer) {
            buffer = unzippedBuffer;
          } else {
            // 如果解壓縮失敗，可以選擇拋出錯誤或處理
            throw new Error(`Failed to unzip frame ${i + 1}`);
          }
        }
      }

      if (i === 0) {
        this._firstBuffer = buffer;
      }

      const buffer32 = new Uint32Array(buffer);
      const bufferFloat = new Float32Array(buffer);
      const bufferByte = new Int8Array(buffer);

      numParticles = buffer32[0];

      let scale = 1;
      if (this._readZipped) {
        scale = bufferFloat[1];
      }

      const positions = new Float32Array(numParticles * 3);

      if (!this._readZipped) {
        for (let i = 0; i < numParticles; ++i) {
          const x = bufferFloat[2 + i * 3 + 0];
          const y = bufferFloat[2 + i * 3 + 1];
          const z = bufferFloat[2 + i * 3 + 2];

          positions[i * 3 + 0] = x;
          positions[i * 3 + 1] = y;
          positions[i * 3 + 2] = -z;
        }
      } else {
        for (let p = 0; p < numParticles; ++p) {
          if (i === 0) {
            const x = bufferFloat[2 + p * 3 + 0];
            const y = bufferFloat[2 + p * 3 + 1];
            const z = bufferFloat[2 + p * 3 + 2];

            positions[p * 3 + 0] = x;
            positions[p * 3 + 1] = y;
            positions[p * 3 + 2] = -z;
          } else {
            const x = bufferByte[8 + p * 3 + 0];
            const y = bufferByte[8 + p * 3 + 1];
            const z = bufferByte[8 + p * 3 + 2];

            positions[p * 3 + 0] = positionBuffers[i - 1][p * 3 + 0] + (x * scale / 127);
            positions[p * 3 + 1] = positionBuffers[i - 1][p * 3 + 1] + (y * scale / 127);
            positions[p * 3 + 2] = positionBuffers[i - 1][p * 3 + 2] + (z * scale / 127);
          }
        }
      }

      positionBuffers.push(positions);
    }

    const t2 = new Date().getTime();

    console.log("Loaded in:", ((t2 - t1) / 1000) + "s")

    this._fluidRenderObject.object.vertexBuffers["position"] =
      new VertexBuffer(
        this._engine,
        positionBuffers[0],
        VertexBuffer.PositionKind,
        true,
        false,
        3,
        true
      );

    (
      this._fluidRenderObject.object as FluidRenderingObjectCustomParticles
    ).setNumParticles(numParticles);

    this._fluidRenderObject.object.particleSize = 0.03;
    this._fluidRenderObject.object.particleThicknessAlpha = 0.007;
    this._fluidRenderObject.targetRenderer.minimumThickness = 0;
    this._fluidRenderObject.targetRenderer.blurDepthFilterSize = 10;
    this._fluidRenderObject.targetRenderer.blurDepthDepthScale = 10;
    this._fluidRenderObject.targetRenderer.thicknessMapSize = 256;
    this._fluidRenderObject.targetRenderer.refractionStrength = 0.1;
    this._fluidRenderObject.targetRenderer.blurThicknessFilterSize = 5;
    this._fluidRenderObject.targetRenderer.blurThicknessNumIterations = 1;
    this._fluidRenderObject.targetRenderer.density = 3;
    this._fluidRenderObject.targetRenderer.specularPower = 250;

    let t = 0;

    this._sceneObserver = this._scene.onBeforeRenderObservable.add(() => {
      this._fluidRenderObject.object.vertexBuffers[
        "position"
      ].updateDirectly(positionBuffers[Math.floor(t)], 0);
      t += this._animSpeed;
      if (t >= numFrames) {
        t = 0;
      }
    });

    super._run();
  }
}

class Hash {
  private _spacing: number;
  private _tableSize: number;
  private _cellStart: Int32Array;
  private _cellEntries: Int32Array;
  private _queryIds: Int32Array;
  private _querySize: number;

  public get querySize() {
    return this._querySize;
  }

  public get queryIds() {
    return this._queryIds;
  }

  constructor(spacing: number, maxNumObjects: number) {
    this._spacing = spacing;
    this._tableSize = 2 * maxNumObjects;
    this._cellStart = new Int32Array(this._tableSize + 1);
    this._cellEntries = new Int32Array(maxNumObjects);
    this._queryIds = new Int32Array(maxNumObjects);
    this._querySize = 0;
  }

  public hashCoords(xi: number, yi: number, zi: number) {
    const h = (xi * 92837111) ^ (yi * 689287499) ^ (zi * 283923481); // fantasy function
    //const h = (xi * 73856093) ^ (yi * 19349663) ^ (zi * 83492791); // fantasy function
    return Math.abs(h) % this._tableSize;
  }

  public intCoord(coord: number) {
    return Math.floor(coord / this._spacing);
  }

  public hashPos(pos: number[] | Float32Array, nr: number) {
    return this.hashCoords(
      this.intCoord(pos[3 * nr]),
      this.intCoord(pos[3 * nr + 1]),
      this.intCoord(pos[3 * nr + 2])
    );
  }

  public create(pos: number[] | Float32Array, numElements?: number) {
    numElements = numElements ?? pos.length / 3;

    const numObjects = Math.min(numElements, this._cellEntries.length);

    // determine cell sizes
    this._cellStart.fill(0);
    this._cellEntries.fill(0);

    for (let i = 0; i < numObjects; i++) {
      const h = this.hashPos(pos, i);
      this._cellStart[h]++;
    }

    // determine cells starts
    let start = 0;
    for (let i = 0; i < this._tableSize; i++) {
      start += this._cellStart[i];
      this._cellStart[i] = start;
    }
    this._cellStart[this._tableSize] = start; // guard

    // fill in objects ids
    for (let i = 0; i < numObjects; i++) {
      const h = this.hashPos(pos, i);
      this._cellStart[h]--;
      this._cellEntries[this._cellStart[h]] = i;
    }
  }

  public query(pos: number[] | Float32Array, nr: number, maxDist: number) {
    const x0 = this.intCoord(pos[3 * nr] - maxDist);
    const y0 = this.intCoord(pos[3 * nr + 1] - maxDist);
    const z0 = this.intCoord(pos[3 * nr + 2] - maxDist);

    const x1 = this.intCoord(pos[3 * nr] + maxDist);
    const y1 = this.intCoord(pos[3 * nr + 1] + maxDist);
    const z1 = this.intCoord(pos[3 * nr + 2] + maxDist);

    this._querySize = 0;

    for (let xi = x0; xi <= x1; xi++) {
      for (let yi = y0; yi <= y1; yi++) {
        for (let zi = z0; zi <= z1; zi++) {
          const h = this.hashCoords(xi, yi, zi);
          const start = this._cellStart[h];
          const end = this._cellStart[h + 1];

          for (let i = start; i < end; i++) {
            this._queryIds[this._querySize] = this._cellEntries[i];
            this._querySize++;
          }
        }
      }
    }
  }
}


interface SDFArray {
  origin: Vector3;
  dimX: number;
  dimY: number;
  dimZ: number;
  step: number;
  data: number[];
}

class SDFHelper {
  public static CreateBox(
    scene: Scene,
    shape: ICollisionShape,
    extents: Vector3
  ) {
    const box = MeshBuilder.CreateBox(
      "box",
      {
        width: extents.x * 2,
        height: extents.y * 2,
        depth: extents.z * 2,
      },
      scene
    );

    const material = new PBRMaterial("boxMat", scene);

    material.metallic = 0;
    material.roughness = 0.9;
    material.albedoTexture = new Texture(
      "textures/wood.jpg",
      scene
    );
    material.cullBackFaces = true;

    box.material = material;

    return Promise.resolve(box);
  }

  public static CreateSphere(
    scene: Scene,
    shape: ICollisionShape,
    s: number
  ) {
    const sphere = MeshBuilder.CreateSphere(
      "sphere",
      { diameter: s * 2, segments: 16 },
      scene
    );

    const material = new PBRMaterial("sphereMat", scene);

    material.metallic = 1;
    material.roughness = 0.05;
    material.albedoTexture = new Texture(marbleBaseColor, scene);
    material.cullBackFaces = true;

    sphere.material = material;

    return Promise.resolve(sphere);
  }

  public static CreateCutHollowSphere(
    scene: Scene,
    shape: ICollisionShape,
    radius: number,
    planeDist: number,
    thickness: number,
    segments: number
  ) {
    thickness = thickness / radius;

    const sphere = MeshBuilder.CreateSphere(
      "sphere",
      { diameter: radius * 2, segments },
      scene
    );
    const plane = MeshBuilder.CreatePlane(
      "plane",
      { size: radius * 2 },
      scene
    );

    plane.rotation.y = Math.PI / 2;
    plane.position.x = planeDist;

    const csg1 = CSG.FromMesh(sphere);
    const csgp = CSG.FromMesh(plane);

    sphere.dispose();
    plane.dispose();

    csg1.subtractInPlace(csgp);

    const mesh = csg1.toMesh("sppl");

    mesh.computeWorldMatrix(true);
    mesh.refreshBoundingInfo();

    mesh.scaling.setAll(1 - thickness);
    mesh.position.x =
      mesh.getBoundingInfo().boundingBox.maximumWorld.x * thickness;

    const csg2 = CSG.FromMesh(mesh);

    mesh.dispose();

    csg1.subtractInPlace(csg2);

    const meshFinal = csg1.toMesh("cutHollowSphere");

    meshFinal.rotation.z = Math.PI / 2;
    meshFinal.bakeCurrentTransformIntoVertices();

    const material = new PBRMaterial("cutHollowSphereMat", scene);

    material.metallic = 1;
    material.roughness = 0.05;
    material.albedoTexture = new Texture(marbleBaseColor, scene);
    material.cullBackFaces = true;

    meshFinal.material = material;

    return Promise.resolve(meshFinal);
  }

  public static CreateVerticalCylinder(
    scene: Scene,
    shape: ICollisionShape,
    r: number,
    h: number,
    segments: number
  ) {
    const cylinder = MeshBuilder.CreateCylinder(
      "cylinder",
      { diameter: r * 2, height: h, tessellation: segments },
      scene
    );

    const material = new PBRMaterial("cylinderMat", scene);

    material.metallic = 1;
    material.roughness = 0.05;
    material.albedoTexture = new Texture(marbleBaseColor, scene);
    material.cullBackFaces = true;

    cylinder.material = material;

    return Promise.resolve(cylinder);
  }

  public static CreateTerrain(
    scene: Scene,
    shape: ICollisionShape,
    size: number
  ) {
    const ground = MeshBuilder.CreateGroundFromHeightMap(
      "terrain",
      "textures/heightMap.png",
      {
        width: size,
        height: size,
        subdivisions: 128,
        maxHeight: size / 5,
        onReady: () => ground!.updateCoordinateHeights(),
      },
      scene
    );

    const mat = new PBRMaterial("mat", scene);

    mat.metallicTexture = new Texture(rockRoughness, scene);
    mat.albedoTexture = new Texture(rockBaseColor, scene);
    mat.bumpTexture = new Texture(rockNormal, scene);
    mat.useRoughnessFromMetallicTextureGreen = true;
    mat.metallic = 0;
    mat.roughness = 1;

    ground.material = mat;

    shape.params.push(ground);

    return Promise.resolve(ground);
  }

  protected static _ParseSDFData(textData: string): SDFArray {
    const lines = textData.replace("\r", "").split("\n");

    const dimLine = lines[0].split(" ");

    const dimX = parseFloat(dimLine[0]);
    const dimY = parseFloat(dimLine[1]);
    const dimZ = parseFloat(dimLine[2]);

    const originLine = lines[1].split(" ");

    const origin = new Vector3(
      parseFloat(originLine[0]),
      parseFloat(originLine[1]),
      parseFloat(originLine[2])
    );

    const step = parseFloat(lines[2]);

    const data: number[] = [];

    for (let i = 3; i < lines.length; ++i) {
      const val = lines[i];
      if (val.length === 0) {
        continue;
      }
      data.push(parseFloat(val));
    }

    return {
      dimX,
      dimY,
      dimZ,
      origin,
      step,
      data,
    };
  }

  public static CreateMesh(
    scene: Scene,
    shape: ICollisionShape,
    meshFilename: string,
    sdfFilename: string,
    createNormals: boolean
  ): Promise<Mesh> {
    return new Promise((resolve) => {
      const promises = [
        SceneLoader.ImportMeshAsync(
          "",
          assetsDir + "scenes/",
          meshFilename,
          scene
        ),
        new Promise((resolve) => {
          fetch(assetsDir + "sdf/" + sdfFilename).then((response) => {
            response.text().then((text) => {
              shape.params.push(SDFHelper._ParseSDFData(text));
              resolve(void 0);
            });
          });
        }),
      ];

      Promise.all(promises).then((results) => {
        const meshes = results[0] as ISceneLoaderAsyncResult;
        const mesh = meshes.meshes[0] as Mesh;
        if (!mesh.material) {
          const material = new PBRMaterial("meshMat", scene);

          material.metallic = 1;
          material.roughness = 0.05;
          material.albedoTexture = new Texture(
            rockBaseColor,
            scene
          );
          material.cullBackFaces = true;

          mesh.material = material;
        }
        if (createNormals) {
          mesh.createNormals(false);
        }
        mesh.scaling.setAll(shape.scale);
        resolve(mesh);
      });
    });
  }

  // SD functions from https://iquilezles.org/articles/distfunctions/
  public static SDBox(p: Vector3, b: Vector3) {
    const q = TmpVectors.Vector3[0];
    q.copyFromFloats(Math.abs(p.x), Math.abs(p.y), Math.abs(p.z));
    q.subtractInPlace(b);

    const tmp = Math.min(Math.max(q.x, q.y, q.z), 0);

    q.maximizeInPlaceFromFloats(0, 0, 0);

    return q.length() + tmp;
  }

  public static SDSphere(p: Vector3, s: number) {
    return p.length() - s;
  }

  public static SDPlane(p: Vector3, n: Vector3, h: number) {
    return Vector3.Dot(p, n) + h;
  }

  public static SDCutHollowSphere(
    p: Vector3,
    r: number,
    h: number,
    t: number
  ) {
    // sampling independent computations (only depend on shape)
    const w = Math.sqrt(r * r - h * h);

    // sampling dependant computations
    const qx = Math.sqrt(p.x * p.x + p.z * p.z);
    const qy = p.y;

    if (h * qx < w * qy) {
      return Math.sqrt((qx - w) * (qx - w) + (qy - h) * (qy - h));
    }

    return Math.abs(Math.sqrt(qx * qx + qy * qy) - r) - t;
  }

  public static SDVerticalCylinder(p: Vector3, r: number, h: number) {
    const dx = Math.abs(Math.sqrt(p.x * p.x + p.z * p.z)) - r;
    const dy = Math.abs(p.y) - h;
    const dx2 = Math.max(dx, 0);
    const dy2 = Math.max(dy, 0);

    return (
      Math.min(Math.max(dx, dy), 0.0) + Math.sqrt(dx2 * dx2 + dy2 * dy2)
    );
  }

  public static SDTerrain(
    p: Vector3,
    size: number,
    terrain: GroundMesh
  ) {
    return p.y - terrain.getHeightAtCoordinates(p.x, p.z);
  }

  public static SDMesh(
    p: Vector3,
    meshFilename: string,
    sdfFilename: string,
    createNormals: boolean,
    sdf: SDFArray
  ) {
    const x = (p.x - sdf.origin.x) / sdf.step;
    const y = (p.y - sdf.origin.y) / sdf.step;
    const z = (p.z - sdf.origin.z) / sdf.step;

    let gx = Math.floor(x);
    let gy = Math.floor(y);
    let gz = Math.floor(z);

    gx = Math.max(Math.min(gx, sdf.dimX - 2), 0);
    gy = Math.max(Math.min(gy, sdf.dimY - 2), 0);
    gz = Math.max(Math.min(gz, sdf.dimZ - 2), 0);

    // trilinear filtering
    const fx = x - gx;
    const fy = y - gy;
    const fz = z - gz;

    const a00 = sdf.data[gz * sdf.dimY * sdf.dimX + gy * sdf.dimX + gx];
    const a10 = sdf.data[gz * sdf.dimY * sdf.dimX + gy * sdf.dimX + gx + 1];
    const a11 =
      sdf.data[gz * sdf.dimY * sdf.dimX + (gy + 1) * sdf.dimX + gx + 1];
    const a01 =
      sdf.data[gz * sdf.dimY * sdf.dimX + (gy + 1) * sdf.dimX + gx];

    const a0 = a00 * (1 - fx) + a10 * fx;
    const a1 = a01 * (1 - fx) + a11 * fx;
    const a = a0 * (1 - fy) + a1 * fy;

    const b00 =
      sdf.data[(gz + 1) * sdf.dimY * sdf.dimX + gy * sdf.dimX + gx];
    const b10 =
      sdf.data[(gz + 1) * sdf.dimY * sdf.dimX + gy * sdf.dimX + gx + 1];
    const b11 =
      sdf.data[
      (gz + 1) * sdf.dimY * sdf.dimX + (gy + 1) * sdf.dimX + gx + 1
      ];
    const b01 =
      sdf.data[(gz + 1) * sdf.dimY * sdf.dimX + (gy + 1) * sdf.dimX + gx];

    const b0 = b00 * (1 - fx) + b10 * fx;
    const b1 = b01 * (1 - fx) + b11 * fx;
    const b = b0 * (1 - fy) + b1 * fy;

    const d = a * (1 - fz) + b * fz;
    //const d = sdf.data[gz * sdf.dimY * sdf.dimX + gy * sdf.dimX + gx];

    return d;
  }

  // normal computed with the Tetrahedron technique, see https://iquilezles.org/articles/normalsSDF/
  public static ComputeSDFNormal(
    pos: Vector3,
    shape: ICollisionShape,
    normal: Vector3
  ) {
    const posTemp = TmpVectors.Vector3[5];
    const dir = TmpVectors.Vector3[6];

    normal.copyFromFloats(0, 0, 0);

    posTemp.copyFrom(pos);
    dir.copyFrom(dir1);
    normal.addInPlace(
      dir.scaleInPlace(
        shape.sdEvaluate(posTemp.addInPlace(eps1), ...shape.params)
      )
    );

    posTemp.copyFrom(pos);
    dir.copyFrom(dir2);
    normal.addInPlace(
      dir.scaleInPlace(
        shape.sdEvaluate(posTemp.addInPlace(eps2), ...shape.params)
      )
    );

    posTemp.copyFrom(pos);
    dir.copyFrom(dir3);
    normal.addInPlace(
      dir.scaleInPlace(
        shape.sdEvaluate(posTemp.addInPlace(eps3), ...shape.params)
      )
    );

    posTemp.copyFrom(pos);
    dir.copyFrom(dir4);
    normal.addInPlace(
      dir.scaleInPlace(
        shape.sdEvaluate(posTemp.addInPlace(eps4), ...shape.params)
      )
    );

    Vector3.TransformNormalToRef(normal, shape.transf, normal);

    normal.normalize();
  }

  public static ComputeTerrainNormal(
    pos: Vector3,
    shape: ICollisionShape,
    normal: Vector3
  ) {
    const terrain = shape.params[1] as GroundMesh;

    terrain.getNormalAtCoordinatesToRef(pos.x, pos.z, normal);
  }
}

const engine = ref<Engine>();


// In onMounted, initialize the BabylonJS engine and scene
onMounted(() => {
  if (babylonCanvas.value) {
    engine.value = new Engine(babylonCanvas.value, true)

    Playground.CreateScene(engine.value, babylonCanvas.value).then((scene) => {
      if (engine.value) {
        engine.value.runRenderLoop(() => {
          scene.render()
        })
      }

    })

  }
})

// Clean up BabylonJS engine on unmount
onBeforeUnmount(() => {
  if (babylonCanvas.value) {
    const engine = new Engine(babylonCanvas.value, true)
    engine.dispose()
  }
})


</script>

<style scoped>
.babylon-canvas-container {
  width: 100%;
  height: 100vh;
}

.babylon-canvas {
  width: 100%;
  height: 100%;
}
</style>