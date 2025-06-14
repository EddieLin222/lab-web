<template>
  <div class="w-full h-full flex flex-row bg-[#F5AFBE] border-red-500 border-solid border-[1px]">
    <div class="canvasContainer flex-1 flex justify-center items-center h-[100dvh]" ref="canvasContainer"></div>
    <div
      class="absolute top-0 left-0 w-full h-full content-[''] z-10 pointer-events-none"
      :style="{
          opacity: .05,
          backgroundImage: noiseBackground
      }"
      :class="noiseBackground"
  ></div>
  </div>
</template>

<script setup lang="ts">
import { Engine, Scene, ArcRotateCamera, Vector3, HemisphericLight, Tools, AnimationGroup, Quaternion, Color4 } from '@babylonjs/core';
import { AppendSceneAsync } from "@babylonjs/core/Loading/sceneLoader";
import { ref, onMounted } from 'vue';
import noise from '../public/effect/noise.gif'

const canvasContainer = ref<HTMLElement>();

onMounted(() => {
  const canvas = document.createElement('canvas');
  canvasContainer.value?.appendChild?.(canvas);

  const engine = new Engine(canvas, true);
  const scene = new Scene(engine);

  // 設置場景的背景為透明
  scene.clearColor = new Color4(0, 0, 0, 0); // 透明的 RGBA 顏色

  const camera = new ArcRotateCamera('camera1', Tools.ToRadians(45), Tools.ToRadians(45), 20, Vector3.Zero(), scene);
  camera.attachControl(canvas, true);

  const light = new HemisphericLight('light1', new Vector3(0, 1, 0), scene);

  AppendSceneAsync("/3d-models/octopus.glb", scene)
  .then(() => {
    console.log("Model loaded successfully");
  })
  .catch((error) => {
    console.error("Failed to load model:", error);
  });

  engine.runRenderLoop(() => {
    scene.render();
  });

  // 移除預設載入畫面
  engine.hideLoadingUI();

  // 確保引擎在窗口大小改變時調整大小
  window.addEventListener('resize', () => {
    engine.resize();
  });

  // 初始設置引擎大小
  engine.resize();
});

const noiseBackground = computed(()=>{
  return `url(${noise})`
})
</script>

<style lang="sass">
.canvasContainer
  width: 100%
  height: 100%
  canvas
    width: 100%
    height: 100%
    outline: none
</style>
