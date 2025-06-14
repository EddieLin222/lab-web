import * as THREE from 'three';

interface Face {
    a: number;
    b: number;
    c: number;
    materialIndex?: number;
    normal: THREE.Vector3;
    clip: THREE.Vector2[];
    vectors: THREE.Vector2[];
}

interface MeshInfo {
    vertices: THREE.Vector3[];
    faces: Face[];
    faceVertexUvs: [THREE.Vector2[]];
}

export class TexturePainter {
    private renderer: THREE.WebGLRenderer;
    private camera: THREE.Camera;
    private mesh: THREE.Mesh;
    private enabled: boolean;
    private backfaceCulling: boolean;
    private reference: THREE.Vector3;
    private canvas!: HTMLCanvasElement;
    private ctx!: CanvasRenderingContext2D;
    private texture!: THREE.Texture;
    private bg?: HTMLImageElement | undefined;
    private scene!: THREE.Scene;
    private ortho!: THREE.OrthographicCamera;
    private cursor!: THREE.Mesh;
    private cursorSize: number = 5;
    private frustumSize: number = 100;
    private cameraUpdated: boolean = true;
    private aspect: number = window.innerWidth / window.innerHeight;
    private cursorUnits: number = this.cursorSize / this.frustumSize / this.aspect;
    private cameraPosition: THREE.Vector3;
    private verticesDict: (THREE.Vector3 | undefined)[];
    private meshInfo: MeshInfo;
    private material: THREE.MeshBasicMaterial | THREE.MeshStandardMaterial | undefined; // 明确指定类型

    constructor(renderer: THREE.WebGLRenderer, camera: THREE.Camera, mesh: THREE.Mesh, src?: string) {
        this.renderer = renderer;
        this.camera = camera;
        this.mesh = mesh;
        this.enabled = false;
        this.backfaceCulling = true;
        this.reference = new THREE.Vector3();
        this.cameraPosition = camera.position.clone();
        this.meshInfo = this.fromBufferGeometry(mesh.geometry as THREE.BufferGeometry);
        this.verticesDict = Array(this.meshInfo.vertices.length).fill(undefined);
        this.material = undefined

        this.initialize(src);
        this.bindListeners();
    }

    private initialize(src?: string) {
        const material = this.mesh.material;
        const whenBGReady = () => {
            if (this.bg && this.bg.complete && this.bg.naturalWidth && this.bg.naturalHeight) {
                this.canvas.width = this.bg.width;
                this.canvas.height = this.bg.height;
                this.ctx.drawImage(this.bg, 0, 0);
                this.texture.needsUpdate = true;
            } else {
                console.error('Image has not been loaded correctly:', this.bg);
            }
        };
    
        // 如果材质是数组，获取第一个材质
        if (Array.isArray(material)) {
            this.material = material[0] as THREE.MeshBasicMaterial | THREE.MeshStandardMaterial;
        } else {
            this.material = material as THREE.MeshBasicMaterial | THREE.MeshStandardMaterial;
        }

        // 确保 material 不为 undefined 且是 MeshBasicMaterial 或 MeshStandardMaterial
        if (this.material) {
            // 这里使用类型保护，确保 material 是正确的类型
            if (this.material instanceof THREE.MeshBasicMaterial || this.material instanceof THREE.MeshStandardMaterial) {
                console.log('Material:', this.material);
                console.log('Material map:', this.material.map);
                console.log('Material map image:', this.material.map ? this.material.map.image : 'No map');

                if (this.material.map && this.material.map.image) {
                    this.bg = this.material.map.image as HTMLImageElement;
                    whenBGReady(); // 假设您有一个方法来处理背景准备就绪
                } else {
                    console.error('Material map or image is missing.');
                }
            } else {
                console.error('Material is not of a valid type.');
            }
        } else {
            console.error('Material is undefined.');
        }


        // Canvas initialization
        this.canvas = document.createElement('canvas');
        this.canvas.width = this.canvas.height = 4096;
        this.ctx = this.canvas.getContext('2d') as CanvasRenderingContext2D;
        this.texture = new THREE.Texture(this.canvas, THREE.UVMapping, THREE.MirroredRepeatWrapping, THREE.MirroredRepeatWrapping);
        this.texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();

        if (Array.isArray(this.mesh.material)) {
            const material = this.mesh.material[0];
            if (material instanceof THREE.MeshStandardMaterial || material instanceof THREE.MeshBasicMaterial) {
                this.bg = material.map?.image as HTMLImageElement; // 使用 instanceof 確認材質類型
            }
        } else {
            const material = this.mesh.material;
            if (material instanceof THREE.MeshStandardMaterial || material instanceof THREE.MeshBasicMaterial) {
                this.bg = material.map?.image as HTMLImageElement; // 同樣檢查材質類型
            }
        }




        if (Array.isArray(this.mesh.material)) {
            // 如果 material 是陣列，檢查第一個材質是否有 map 屬性
            const material = this.mesh.material[0] as THREE.MeshStandardMaterial | THREE.MeshBasicMaterial;
            if (material.map && material.map.image) {
                this.bg = material.map.image as HTMLImageElement;
                whenBGReady();
            } else {
                console.error('Material map or image is missing.');
            }
        } else if (this.mesh.material instanceof THREE.MeshStandardMaterial || this.mesh.material instanceof THREE.MeshBasicMaterial) {
            // 如果 material 是單一材質，檢查是否有 map 屬性
            const material = this.mesh.material;
            if (material.map && material.map.image) {
                this.bg = material.map.image as HTMLImageElement;
                whenBGReady();
            } else {
                console.error('Material map or image is missing.');
            }
        }


        if (Array.isArray(this.mesh.material)) {
            // 如果材質是陣列，遍歷每個材質並檢查是否具有 `map` 屬性
            this.mesh.material.forEach((material) => {
                if (material instanceof THREE.MeshStandardMaterial || material instanceof THREE.MeshBasicMaterial) {
                    material.map = this.texture;
                }
            });
        } else {
            // 如果是單一材質，檢查它是否是 `MeshStandardMaterial` 或 `MeshBasicMaterial`
            const material = this.mesh.material;
            if (material instanceof THREE.MeshStandardMaterial || material instanceof THREE.MeshBasicMaterial) {
                material.map = this.texture;
            }
        }


        // Cursor initialization
        this.scene = new THREE.Scene();
        this.scene.background = null;

        this.ortho = new THREE.OrthographicCamera(this.frustumSize * this.aspect / -2, this.frustumSize * this.aspect / 2, this.frustumSize / 2, this.frustumSize / -2, 0, 10);
        this.ortho.position.z = 50;
        this.ortho.lookAt(this.scene.position);

        const cursorTexture = new THREE.Texture(undefined, THREE.UVMapping, THREE.MirroredRepeatWrapping, THREE.MirroredRepeatWrapping);
        const cursorMaterial = new THREE.MeshBasicMaterial({ map: cursorTexture, transparent: true });
        const cursorGeometry = new THREE.PlaneGeometry(this.cursorSize, this.cursorSize, 1, 1);

        this.cursor = new THREE.Mesh(cursorGeometry, cursorMaterial);
        this.cursor.position.copy(this.ortho.position);
        this.cursor.rotation.copy(this.ortho.rotation);
        this.scene.add(this.cursor);

        const canvasCursor = document.createElement('canvas');
        canvasCursor.width = canvasCursor.height = 128;
        const context = canvasCursor.getContext('2d') as CanvasRenderingContext2D;

        cursorTexture.image = canvasCursor;
        context.lineWidth = 8;
        context.strokeStyle = 'rgba(0, 0, 0, 0.7)';

        context.clearRect(0, 0, canvasCursor.width, canvasCursor.height);
        context.ellipse(
            canvasCursor.width / 2,
            canvasCursor.height / 2,
            canvasCursor.width / 2 - context.lineWidth / 2 - 8,
            canvasCursor.height / 2 - context.lineWidth / 2 - 8,
            0,
            0,
            Math.PI * 2
        );
        context.stroke();

        cursorTexture.needsUpdate = true;
    }

    public update() {
        if (!this.camera.position.equals(this.cameraPosition)) {
            this.cameraUpdated = true;
        }

        this.renderer.autoClear = false;
        this.renderer.render(this.scene, this.ortho);
    }

    public resize() {
        this.aspect = window.innerWidth / window.innerHeight;
        this.cursorUnits = this.cursorSize / this.frustumSize / this.aspect;

        this.ortho.left = -this.frustumSize * this.aspect / 2;
        this.ortho.right = this.frustumSize * this.aspect / 2;
        this.ortho.top = this.frustumSize / 2;
        this.ortho.bottom = -this.frustumSize / 2;

        this.ortho.updateProjectionMatrix();
        this.cameraUpdated = true;
    }

    private fromBufferGeometry(geometry: THREE.BufferGeometry): MeshInfo {
        const scope: MeshInfo = {
            vertices: [],
            faces: [],
            faceVertexUvs: [[]],
        };

        const index = geometry.index !== null ? geometry.index : undefined;
        const attributes = geometry.attributes;
        const position = attributes.position;
        const uv = attributes.uv;

        for (let i = 0; i < position.count; i++) {
            scope.vertices.push(new THREE.Vector3().fromBufferAttribute(position, i));
        }

        const cb = new THREE.Vector3(),
            ab = new THREE.Vector3();

        const addFace = (a: number, b: number, c: number, materialIndex?: number) => {
            const vA = scope.vertices[a];
            const vB = scope.vertices[b];
            const vC = scope.vertices[c];
            cb.subVectors(vC, vB);
            ab.subVectors(vA, vB);
            cb.cross(ab);
            cb.normalize();

            const face: Face = { a, b, c, materialIndex, normal: cb.clone(), clip: [], vectors: [] };
            scope.faces.push(face);

            if (uv !== undefined) {
                if (uv instanceof THREE.BufferAttribute) {
                    const uvA = new THREE.Vector2().fromBufferAttribute(uv, a);
                    const uvB = new THREE.Vector2().fromBufferAttribute(uv, b);
                    const uvC = new THREE.Vector2().fromBufferAttribute(uv, c);

                    // 將一個包含三個 Vector2 的陣列正確推入 faceVertexUvs
                    // @ts-ignore
                    scope.faceVertexUvs[0].push([uvA, uvB, uvC]);
                } else if (uv instanceof THREE.InterleavedBufferAttribute) {
                    const uvA = new THREE.Vector2(uv.getX(a), uv.getY(a));
                    const uvB = new THREE.Vector2(uv.getX(b), uv.getY(b));
                    const uvC = new THREE.Vector2(uv.getX(c), uv.getY(c));

                    // 同樣地，將三個 Vector2 推入 faceVertexUvs
                    // @ts-ignore
                    scope.faceVertexUvs[0].push([uvA, uvB, uvC]);
                }
            }



        };

        const groups = geometry.groups;
        if (groups.length > 0) {
            for (let i = 0; i < groups.length; i++) {
                const group = groups[i];
                const start = group.start;
                const count = group.count;

                for (let j = start, jl = start + count; j < jl; j += 3) {
                    if (index !== undefined) {
                        addFace(index.getX(j), index.getX(j + 1), index.getX(j + 2), group.materialIndex);
                    } else {
                        addFace(j, j + 1, j + 2, group.materialIndex);
                    }
                }
            }
        } else {
            if (index !== undefined) {
                for (let i = 0; i < index.count; i += 3) {
                    addFace(index.getX(i), index.getX(i + 1), index.getX(i + 2));
                }
            } else {
                for (let i = 0; i < position.count; i += 3) {
                    addFace(i, i + 1, i + 2);
                }
            }
        }

        return scope;
    }

    private bindListeners() {
        this.renderer.domElement.addEventListener('mousemove', (evt) => this.onMouseMove(evt), false);
        this.renderer.domElement.addEventListener('mousedown', (evt) => this.onMouseDown(evt), false);
        this.renderer.domElement.addEventListener('mouseup', (evt) => this.onMouseUp(evt), false);
    }

    private onMouseMove(evt: MouseEvent) {
        evt.preventDefault();
        this.updateMouse(evt);
        this.updateCursor();
        if (this.enabled) this.draw(this.getDrawLocations());
    }

    private onMouseDown(evt: MouseEvent) {
        evt.preventDefault();
        if (evt.button !== 0) return;
        this.enabled = true;
        this.onMouseMove(evt);
    }

    private onMouseUp(evt: MouseEvent) {
        evt.preventDefault();
        if (evt.button !== 0) return;
        this.enabled = false;
    }

    private updateMouse(evt: MouseEvent) {
        const rect = this.renderer.domElement.getBoundingClientRect();
        const array = [(evt.clientX - rect.left) / rect.width, (evt.clientY - rect.top) / rect.height];
        this.reference.set((array[0] * 2) - 1, -(array[1] * 2) + 1, 0);
    }

    private updateCursor() {
        this.cursor.position.copy(this.ortho.position);
        this.cursor.translateX(this.aspect * this.reference.x * 50);
        this.cursor.translateY(this.reference.y * 50);
    }

    private draw(faces: Face[]) {
        if (!this.ctx || !this.enabled || !faces) return;
        faces.forEach((face) => {
            this.ctx.save();
            this.faceClip(face.clip);
            this.faceDraw(face.vectors);
            this.ctx.restore();
        });
        this.texture.needsUpdate = true;
    }

    private faceClip(clip: THREE.Vector2[]) {
        this.ctx.beginPath();
        this.ctx.moveTo(clip[0].x * this.canvas.width, clip[0].y * this.canvas.height);
        this.ctx.lineTo(clip[1].x * this.canvas.width, clip[1].y * this.canvas.height);
        this.ctx.lineTo(clip[2].x * this.canvas.width, clip[2].y * this.canvas.height);
        this.ctx.closePath();
        this.ctx.clip();
    }

    private faceDraw(vectors: THREE.Vector2[]) {
        const width = this.canvas.width;
        const height = this.canvas.height;
        const length = vectors.length / 2;

        this.ctx.fillStyle = 'rgba( 14, 158, 54, 1 )';

        this.ctx.beginPath();
        this.ctx.moveTo(vectors[length - 1].x * width, vectors[length - 1].y * height);

        for (let i = 0; i < length; i++) {
            this.ctx.quadraticCurveTo(
                vectors[length + i].x * width,
                vectors[length + i].y * height,
                vectors[i].x * width,
                vectors[i].y * height
            );
        }
        this.ctx.fill();
    }

    private getDrawLocations(): Face[] {
        // Implement logic to calculate draw locations based on intersection and other factors
        return [];
    }
}
