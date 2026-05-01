import * as THREE from "three";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { map } from "./utils";

export const TERRAIN_RESOLUTION = 128;

const IMAGE_EXTS = ["png", "jpg", "jpeg", "webp"];
const MODEL_EXTS = ["obj", "gltf", "glb", "stl"];
export const SUPPORTED_EXTS = [...IMAGE_EXTS, ...MODEL_EXTS];

function collectGeometries(object: THREE.Object3D): THREE.BufferGeometry[] {
    const geoms: THREE.BufferGeometry[] = [];
    object.updateWorldMatrix(true, true);
    object.traverse((child) => {
        const mesh = child as THREE.Mesh;
        if (mesh.isMesh && mesh.geometry?.attributes.position) {
            const g = mesh.geometry.clone();
            g.applyMatrix4(mesh.matrixWorld);
            geoms.push(g);
        }
    });
    return geoms;
}

function normalizeToUnitXZ(geometry: THREE.BufferGeometry) {
    geometry.computeBoundingBox();
    const box = geometry.boundingBox!;
    const center = new THREE.Vector3();
    box.getCenter(center);
    const size = new THREE.Vector3();
    box.getSize(size);
    const scale = 2 / Math.max(size.x, size.z, 0.001);
    geometry.applyMatrix4(
        new THREE.Matrix4()
            .makeTranslation(-center.x, -center.y, -center.z)
            .premultiply(new THREE.Matrix4().makeScale(scale, scale, scale))
    );
}

function sampleGeometryToGrid(geometry: THREE.BufferGeometry): Float32Array {
    normalizeToUnitXZ(geometry);

    const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
    const raycaster = new THREE.Raycaster();
    const n = TERRAIN_RESOLUTION;
    const raw: (number | null)[] = new Array(n * n).fill(null);
    let minY = Infinity;
    let maxY = -Infinity;

    for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
            const x = map(i, 0, n - 1, -1, 1);
            const z = map(j, 0, n - 1, -1, 1);
            raycaster.set(new THREE.Vector3(x, 1000, z), new THREE.Vector3(0, -1, 0));
            const hits = raycaster.intersectObject(mesh);
            if (hits.length > 0) {
                const y = hits[0].point.y;
                raw[i * n + j] = y;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
            }
        }
    }

    const terrain = new Float32Array(n * n);
    const range = maxY - minY;
    for (let k = 0; k < terrain.length; k++) {
        const h = raw[k];
        terrain[k] = h !== null && range > 0 ? map(h, minY, maxY, -1, 1) : 0;
    }
    return terrain;
}

function sampleImageToGrid(imageData: ImageData): Float32Array {
    const { width, height, data } = imageData;
    const n = TERRAIN_RESOLUTION;
    const terrain = new Float32Array(n * n);
    for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
            const px = Math.min(Math.floor(map(i, 0, n, 0, width)), width - 1);
            const py = Math.min(Math.floor(map(j, 0, n, 0, height)), height - 1);
            const idx = (py * width + px) * 4;
            const gray = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
            terrain[i * n + j] = map(gray, 0, 255, -1, 1);
        }
    }
    return terrain;
}

function loadImageTerrain(file: File): Promise<Float32Array> {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            URL.revokeObjectURL(url);
            const canvas = document.createElement("canvas");
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext("2d")!;
            ctx.drawImage(img, 0, 0);
            resolve(sampleImageToGrid(ctx.getImageData(0, 0, img.width, img.height)));
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error("Failed to load image"));
        };
        img.src = url;
    });
}

async function loadModelTerrain(file: File, ext: string): Promise<Float32Array> {
    const url = URL.createObjectURL(file);
    try {
        let geometry: THREE.BufferGeometry;

        if (ext === "obj") {
            const obj = await new OBJLoader().loadAsync(url);
            const geoms = collectGeometries(obj);
            if (!geoms.length) throw new Error("No geometry found in OBJ file");
            geometry = geoms.length === 1 ? geoms[0] : mergeGeometries(geoms)!;
        } else if (ext === "gltf" || ext === "glb") {
            const gltf = await new GLTFLoader().loadAsync(url);
            const geoms = collectGeometries(gltf.scene);
            if (!geoms.length) throw new Error("No geometry found in GLTF file");
            geometry = geoms.length === 1 ? geoms[0] : mergeGeometries(geoms)!;
        } else {
            // stl
            geometry = await new STLLoader().loadAsync(url);
        }

        return sampleGeometryToGrid(geometry);
    } finally {
        URL.revokeObjectURL(url);
    }
}

export async function terrainFromFile(file: File): Promise<Float32Array> {
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";

    if (IMAGE_EXTS.includes(ext)) {
        return loadImageTerrain(file);
    }
    if (MODEL_EXTS.includes(ext)) {
        return loadModelTerrain(file, ext);
    }
    throw new Error(`Unsupported format: .${ext}\nSupported: ${SUPPORTED_EXTS.map(e => `.${e}`).join(", ")}`);
}
