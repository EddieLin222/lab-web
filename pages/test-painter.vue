<template>
    <div id="container"></div>
    <div id="info"><a href="http://threejs.org" target="_blank" rel="noopener">three.js</a> - texture -
        paint<br>Left-click to paint. | Right-click to rotate.</div>
</template>
<script lang="ts" setup>
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { TexturePainter } from '../utils/test-painter'

onMounted(() => {
    var width = window.innerWidth;
    var height = window.innerHeight;

    var container, controls;
    var renderer: any, camera: any, scene: any;
    var meshPainter;
    var painter: any;

    function init() {

        var container = document.getElementById("container");

        renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setSize(width, height);
        container?.appendChild(renderer.domElement);

        scene = new THREE.Scene();
        scene.background = new THREE.Color(0xeeeeee);

        camera = new THREE.PerspectiveCamera(45, width / height, 1, 1000);
        camera.position.z = 100;
        camera.lookAt(scene.position);

        controls = new OrbitControls(camera, renderer.domElement);
        controls.enableZoom = false;
        controls.enablePan = false;
        controls.mouseButtons.LEFT = THREE.MOUSE.RIGHT;
        controls.mouseButtons.RIGHT = THREE.MOUSE.LEFT;
        controls.update();

        // 加载 GLB 模型
        const loader = new GLTFLoader();
        loader.load('/3d-models/octopus.glb', function (gltf) {
            const model = gltf.scene;
            let mesh: THREE.Mesh | null = null; // 用于保存找到的 Mesh

            // 遍历加载的模型，找到第一个包含几何体的 Mesh
            model.traverse(function (child) {
                if ((child as THREE.Mesh).isMesh) {  // 使用类型断言将 child 转换为 Mesh
                    mesh = child as THREE.Mesh;  // 将 child 强制转换为 THREE.Mesh

                    if (mesh.geometry) {
                        mesh.geometry.computeVertexNormals(); // 重新计算法线
                        console.log('test-normal', mesh.geometry.attributes.normal);
                    }

                    // 确保模型具有 UV 坐标
                    if (mesh.geometry && mesh.geometry.attributes.uv) {
                        // 为模型应用一个可绘制的基础材质
                        mesh.material = new THREE.MeshBasicMaterial({ 
                            map: new THREE.TextureLoader().load('/textures/uv.jpg'),
                            side: THREE.DoubleSide // 让材质在模型的两面都显示纹理
                        });
                    } else {
                        console.warn('模型缺少 UV 坐标，无法绘制纹理。');
                    }
                }
            });

            model.scale.set(10, 10, 10);

            if (mesh) {
                scene.add(model); // 将模型添加到场景中

                // 使用找到的 Mesh 初始化 TexturePainter
                painter = new TexturePainter(renderer, camera, mesh, '/textures/uv.jpg');
            } else {
                console.error('没有找到有效的 Mesh 对象。');
            }

        }, undefined, function (error) {
            console.error('加载模型时出错:', error);
        });

        // // Plane model.
        // var planeTexture = new THREE.TextureLoader().load('/textures/uv.jpg');
        // var planeMaterial = new THREE.MeshBasicMaterial({ map: planeTexture });
        // // var planeGeometry = new THREE.PlaneGeometry( 100, 100, 1, 1 );
        // var planeGeometry = new THREE.TorusGeometry(20, 7, 32, 128);

        // var mesh = new THREE.Mesh(planeGeometry, planeMaterial);
        // mesh.position.z = -5;
        // mesh.updateMatrix();
        // scene.add(mesh);

        // painter = new TexturePainter(renderer, camera, mesh);

        window.addEventListener('resize', onWindowResize, false);

    }


    function onWindowResize() {

        var aspect = window.innerWidth / window.innerHeight;

        camera.aspect = aspect;
        camera.updateProjectionMatrix();

        renderer.setSize(window.innerWidth, window.innerHeight);

        painter.resize();

    }

    function render() {

        requestAnimationFrame(render);

        renderer.autoClear = true;

        renderer.render(scene, camera);

        // needs to be after scene is rendered.
        // 只有当 painter 已经初始化时才调用 update 方法
        if (painter) {
            painter.update();
        }

    }

    init();
    render();
})
</script>
<style lang="sass">
body
    color: #808080
    font-family: Monospace
    font-size: 13px
    text-align: center
    background-color: #ffffff
    margin: 0px
    overflow: hidden

#container
    cursor: none

#info
    position: absolute
    top: 0px
    width: 100%
    padding: 5px
    cursor: auto
</style>