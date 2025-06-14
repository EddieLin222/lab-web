import { AppendSceneAsync, LoadAssetContainerAsync, Quaternion, Vector3, type AbstractMesh, type Scene } from "@babylonjs/core";
import { defaultsDeep } from 'lodash-es' 

export interface WorldsManParams {
  position?: Vector3;
}

type State = 'idle' | 'walk';

export class WorldsMan {
  mesh?: AbstractMesh;
  name: string;
  scene: Scene;
  params: Required<WorldsManParams> = {
    position: new Vector3(0, 0, 0),
  };

  state: State = 'walk';

  constructor(name: string, scene: Scene, params?: WorldsManParams) {
    this.name = name;
    this.scene = scene;
    this.params = defaultsDeep(params, this.params);
  }

  async init(addToScene: boolean = true) {
    const result = await LoadAssetContainerAsync('/3d-models/worlds-man.glb', this.scene);
    const worldsman = result.meshes[0];
    worldsman.position = this.params.position;
    
    if (addToScene) {
      result.addAllToScene(); // 只有當 `addToScene` 為 `true` 才加入場景
    }
    // 控制模型轉向
    worldsman.rotationQuaternion = Quaternion.FromEulerAngles(0, Math.PI / 2, 0);

    return this;
  }
}