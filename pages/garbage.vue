<template>
    <div id="container"></div>
    <div id="info">
        <a href="http://threejs.org" target="_blank" rel="noopener">three.js</a>
        - texture - paint
        <br />
        Left-click to paint. | Right-click to rotate.
    </div>
</template>

<script setup lang="ts">
import * as THREE from 'three'
import { onMounted, onBeforeUnmount, ref } from 'vue'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import { useWindowSize } from '@vueuse/core' // 假設你有使用 @vueuse/core

// 定義型別
let renderer: THREE.WebGLRenderer
let camera: THREE.PerspectiveCamera
let scene: THREE.Scene
let controls: OrbitControls
let painter: any // 假設 `TexturePainter` 是自定義的類別，這裡可以定義為具體型別

const { width, height } = useWindowSize()

// 初始化函數
const init = () => {
    const container = document.getElementById('container')
    if (!container) return // 容錯處理，確保 container 存在

    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true })
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.setSize(width.value, height.value)
    container.appendChild(renderer.domElement)

    scene = new THREE.Scene()
    scene.background = new THREE.Color(0xeeeeee)

    camera = new THREE.PerspectiveCamera(45, width.value / height.value, 1, 1000)
    camera.position.z = 100
    camera.lookAt(scene.position)

    controls = new OrbitControls(camera, renderer.domElement)
    controls.enableZoom = false
    controls.enablePan = false
    controls.mouseButtons.LEFT = THREE.MOUSE.RIGHT
    controls.mouseButtons.RIGHT = THREE.MOUSE.LEFT
    controls.update()

    // 載入紋理
    const planeTexture = new THREE.TextureLoader().load(
        '/textures/uv.jpg',
        (texture) => {
        console.log('Texture loaded successfully', texture);
        const planeMaterial = new THREE.MeshBasicMaterial({ map: texture });
        const mesh = new THREE.Mesh(planeGeometry, planeMaterial);
        mesh.position.z = -5;
        mesh.updateMatrix();
        scene.add(mesh);

        // 在这里初始化 TexturePainter
        painter = new TexturePainter(renderer, camera, mesh);
    },
    undefined,
    (err) => {
        console.error('An error happened while loading the texture:', err);
    }
    )

    // 創建材質和幾何體
    const planeMaterial = new THREE.MeshBasicMaterial({ map: planeTexture })
    const planeGeometry = new THREE.TorusGeometry(20, 7, 32, 128)

    const mesh = new THREE.Mesh(planeGeometry, planeMaterial)
    mesh.position.z = -5
    mesh.updateMatrix()
    scene.add(mesh)

    // 假設有自定義的 TexturePainter 模組，需指定具體類型
    painter = new TexturePainter(renderer, camera, mesh)

    window.addEventListener('resize', onWindowResize)
}

// 處理圖片載入完成時的回調函數
const whenBGReady = (bg: HTMLImageElement) => {
    if (bg && bg.width && bg.height) {
        console.log('Image is ready:', bg)
        // 這裡可以執行需要的圖片載入完成後的操作
    } else {
        console.error('Image has not been loaded correctly:', bg)
    }
}

// 處理視窗大小變更
const onWindowResize = () => {
    const aspect = window.innerWidth / window.innerHeight

    camera.aspect = aspect
    camera.updateProjectionMatrix()

    renderer.setSize(window.innerWidth, window.innerHeight)
    if (painter && typeof painter.resize === 'function') {
        painter.resize()
    }
}

// 渲染函數
const render = () => {
    requestAnimationFrame(render)
    renderer.autoClear = true
    renderer.render(scene, camera)

    if (painter && typeof painter.update === 'function') {
        painter.update() // 假設 painter 有這個更新方法
    }
}

// Vue 的生命周期函數
onMounted(() => {
    init()
    render()
})

onBeforeUnmount(() => {
    window.removeEventListener('resize', onWindowResize)
})
</script>

<style scoped>
body {
    color: #808080;
    font-family: Monospace;
    font-size: 13px;
    text-align: center;
    background-color: #ffffff;
    margin: 0px;
    overflow: hidden;
}

#container {
    cursor: none;
}

#info {
    position: absolute;
    top: 0px;
    width: 100%;
    padding: 5px;
    cursor: auto;
}
</style>
