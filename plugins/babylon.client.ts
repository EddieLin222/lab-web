import { Engine, Scene, ArcRotateCamera, Vector3, HemisphericLight, SceneLoader } from '@babylonjs/core';
import '@babylonjs/loaders/glTF';

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.provide('babylon',  {
    Engine,
    Scene,
    ArcRotateCamera,
    Vector3,
    HemisphericLight,
    SceneLoader
  });
});