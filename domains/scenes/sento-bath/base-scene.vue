<template>
  <canvas ref="canvas" class="w-full h-full outline-none border-[0px]" />
</template>

<script setup lang="ts">
import { Engine, Scene, ArcRotateCamera, Vector3, HemisphericLight, Tools, AnimationGroup, Quaternion, Color4 } from '@babylonjs/core';
import { ref, onMounted } from 'vue';
import { WorldsMan } from '~/domains/characters/worlds-man/worlds-man';
import { Fluid } from '~/domains/scene-assets/fluid/fluid';
// import { Playground } from '~/domains/scene-assets/fluid/fluid-example';

import { Playground } from '~/domains/scene-assets/fluid/fluid-ripple';

const canvas = ref<HTMLCanvasElement>();
let engine: Engine;
let scene: Scene;

function createEngine(canvas: HTMLCanvasElement) {
  const engine = new Engine(canvas, true);
  return engine;
}

function createScene(engine: Engine) {
  const scene = new Scene(engine);
  // 設置場景的背景為透明
  scene.clearColor = new Color4(0, 0, 0, 0); // 透明的 RGBA 顏色
  scene.createDefaultLight();
  return scene;
}


// function createCamera(scene: Scene) {
//   const camera = new ArcRotateCamera(
//     'camera',
//     -Math.PI / 2,
//     Math.PI / 2.5,
//     34,
//     new Vector3(0, 0, -2),
//     scene
//   );

//   return camera;
// }

async function createWorldsman(index: number) {
  const worldsman = await new WorldsMan(`worldsman-${index}`, scene, {
    position: new Vector3(0, 2, 0),
  }).init(false);

  return worldsman;
}

async function init() {
  if (!canvas.value) {
    console.error('無法取得 canvas DOM');
    return;
  }

  engine = createEngine(canvas.value);
  scene = createScene(engine);
  // createCamera(scene);
  const worldsman = await createWorldsman(1)

  Playground.CreateScene(scene, engine, canvas.value)

  // Playground.CreateScene(scene, worldsman).then((scene) => {
  //   if (engine) {
  //     engine.runRenderLoop(() => {
  //       scene.render()
  //     })
  //   }
  // })

  /** 反覆渲染場景，這樣畫面才會持續變化 */
  engine.runRenderLoop(() => {
    scene.render();
  });
}

function handleResize() {
  engine.resize();
}


onMounted(() => {
  init();
  window.addEventListener('resize', handleResize);
})

onBeforeUnmount(() => {
  engine.dispose();
  window.removeEventListener('resize', handleResize);
})
</script>

<style lang="sass">
</style>