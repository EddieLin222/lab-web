<template>
  <div>
    <canvas ref="canvasEl"></canvas>
  </div>
</template>
<script lang="ts" setup>
import * as THREE from 'three';
import flagVertexShader from '../../shaders/flag/vertex.glsl?raw'
import flagFragmentShader from '../../shaders/flag/fragment.glsl?raw'
import { OrbitControls } from 'three/examples/jsm/Addons.js';

const canvasEl = ref()


onMounted(() => {
  const scene = new THREE.Scene();

  const textureLoader = new THREE.TextureLoader();
  const flagTexture = textureLoader.load('/pictures/shishiba.png')

  const geometry = new THREE.PlaneGeometry(1, 1, 32, 32)

  const count = geometry.attributes.position.count
  const randoms = new Float32Array(count)
  for (let i = 0; i <= count; i++) {
    randoms[i] = Math.random()
  }
  geometry.setAttribute('aRandom', new THREE.BufferAttribute(randoms, 1))

  const material = new THREE.RawShaderMaterial({
    vertexShader: flagVertexShader,
    fragmentShader: flagFragmentShader,
    side: THREE.DoubleSide,
    uniforms: {
      uFrequency: {
        value: new THREE.Vector2(10, 5),
      },
      uTime: {
        value: 0
      },
      uColor: {
        value: new THREE.Color('orange')
      },
      uTexture: {
        value: flagTexture
      }
    }
  })
  const mesh = new THREE.Mesh(geometry, material)
  scene.add(mesh)

  const sizes = {
    width: 800,
    height: 600
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