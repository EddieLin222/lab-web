<template>
  <div>
    <canvas ref="canvasEl"></canvas>
  </div>
</template>
<script lang="ts" setup>
import * as THREE from 'three';
import flagVertexShader from '../../shaders/test/vertex.glsl?raw'
import flagFragmentShader from '../../shaders/test/fragment.glsl?raw'
import { OrbitControls } from 'three/examples/jsm/Addons.js';

const canvasEl = ref()

onMounted(() => {
  const scene = new THREE.Scene();

  const geometry = new THREE.PlaneGeometry(1, 1, 32, 32)


  const textureLoader = new THREE.TextureLoader();
  const texture = textureLoader.load('/pictures/shishiba.png')

  const material = new THREE.ShaderMaterial({
    vertexShader: flagVertexShader,
    fragmentShader: flagFragmentShader,
    side: THREE.DoubleSide,
    uniforms: {
    uTexture: { value: texture },
    uTime: { value: 0.0 }
  },
  })
  const mesh = new THREE.Mesh(geometry, material)
  scene.add(mesh)

  const sizes = {
    width: window.innerWidth,
    height: window.innerHeight
}

  const camera = new THREE.PerspectiveCamera(75, sizes.width / sizes.height)
  const controls = new OrbitControls(camera, canvasEl.value)

  controls.update()

  camera.position.z = 2
  camera.lookAt(mesh.position)

  scene.add(camera)

  const renderer = new THREE.WebGLRenderer({
    canvas: canvasEl.value
  })
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

  const clock = new THREE.Clock()
  function tick() {

    const elapsedTime = clock.getElapsedTime()
    material.uniforms.uTime.value = elapsedTime
    controls.update()
    renderer.render(scene, camera)
    window.requestAnimationFrame(tick)
  }

  tick()
})
</script>