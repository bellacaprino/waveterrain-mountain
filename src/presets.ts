import { TERRAIN_RESOLUTION } from "./mountain_terrain";

export interface TerrainPreset {
    name: string;
    generate: () => Float32Array;
}

const N = TERRAIN_RESOLUTION;

// --- Noise primitives ---

function hash(ix: number, iz: number): number {
    let h = Math.imul(ix ^ 0x45d9f3b, 374761393) + Math.imul(iz ^ 0xb5297a4d, 668265263);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function smoothstep(t: number): number {
    return t * t * (3 - 2 * t);
}

function vnoise(x: number, z: number): number {
    const ix = Math.floor(x), iz = Math.floor(z);
    const fx = x - ix, fz = z - iz;
    const ux = smoothstep(fx), uz = smoothstep(fz);
    const v = (
        (1 - uz) * ((1 - ux) * hash(ix, iz)     + ux * hash(ix + 1, iz)) +
              uz  * ((1 - ux) * hash(ix, iz + 1) + ux * hash(ix + 1, iz + 1))
    );
    return v * 2 - 1; // [-1, 1]
}

function fbm(x: number, z: number, octaves = 6): number {
    let v = 0, a = 0.5, f = 1;
    for (let i = 0; i < octaves; i++, a *= 0.5, f *= 2) v += a * vnoise(x * f, z * f);
    return v; // ~[-1, 1]
}

function ridged(x: number, z: number, octaves = 6): number {
    let v = 0, a = 0.5, f = 1;
    for (let i = 0; i < octaves; i++, a *= 0.5, f *= 2) v += a * (1 - Math.abs(vnoise(x * f, z * f)));
    return v; // ~[0, 1]
}

// --- Shape helpers ---

function gaussian(x: number, z: number, cx: number, cz: number, rx: number, rz: number): number {
    const dx = (x - cx) / rx, dz = (z - cz) / rz;
    return Math.exp(-(dx * dx + dz * dz) / 2);
}

function segmentDist(x: number, z: number, x0: number, z0: number, x1: number, z1: number): number {
    const dx = x1 - x0, dz = z1 - z0;
    const t = Math.max(0, Math.min(1, ((x - x0) * dx + (z - z0) * dz) / (dx * dx + dz * dz)));
    return Math.hypot(x - (x0 + t * dx), z - (z0 + t * dz));
}

// Builds normalised Float32Array from a [-1,1] x [-1,1] height function
function build(fn: (x: number, z: number) => number): Float32Array {
    const raw = new Float32Array(N * N);
    let min = Infinity, max = -Infinity;
    for (let i = 0; i < N; i++) {
        for (let j = 0; j < N; j++) {
            const x = (i / (N - 1)) * 2 - 1;
            const z = (j / (N - 1)) * 2 - 1;
            const v = fn(x, z);
            raw[i * N + j] = v;
            if (v < min) min = v;
            if (v > max) max = v;
        }
    }
    const range = max - min || 1;
    const out = new Float32Array(N * N);
    for (let k = 0; k < N * N; k++) out[k] = ((raw[k] - min) / range) * 2 - 1;
    return out;
}

// --- Preset generators ---

function fuji(): Float32Array {
    return build((x, z) => {
        const r = Math.hypot(x, z);
        const cone = Math.max(0, 1 - r * 1.3);
        // slight caldera depression at very top
        const caldera = r < 0.045 ? cone * 0.94 : cone;
        // subtle surface texture — light so the clean cone shape dominates
        return caldera + fbm(x + 10, z + 10, 4) * 0.05 * cone;
    });
}

function matterhorn(): Float32Array {
    return build((x, z) => {
        // Diamond pyramid (L1 distance = 4 steep triangular faces)
        const l1 = Math.abs(x) + Math.abs(z);
        const pyramid = Math.max(0, 1 - l1 * 1.75);
        const sharp = Math.pow(pyramid, 0.55); // sharpen tip
        // Four arêtes running to NE / NW / SE / SW corners
        const areteW = 0.08;
        const arete = Math.max(
            Math.max(0, 1 - segmentDist(x, z, 0, 0,  0.75,  0.75) / areteW),
            Math.max(0, 1 - segmentDist(x, z, 0, 0, -0.75,  0.75) / areteW),
            Math.max(0, 1 - segmentDist(x, z, 0, 0,  0.75, -0.75) / areteW),
            Math.max(0, 1 - segmentDist(x, z, 0, 0, -0.75, -0.75) / areteW),
        ) * sharp;
        // coarse fractal detail on the rock faces only
        const roughness = fbm(x + 20, z + 20, 7) * 0.07 * (1 - sharp);
        return sharp * 0.72 + arete * 0.28 + roughness;
    });
}

function alps(): Float32Array {
    return build((x, z) => {
        // Five peaks arranged along a SW–NE ridge with realistic spacing
        const peaks = [
            gaussian(x, z, -0.62, -0.38, 0.20, 0.15),  // Mont Blanc end
            gaussian(x, z, -0.28, -0.10, 0.18, 0.14),
            gaussian(x, z,  0.02,  0.04, 0.22, 0.17),  // centre highest
            gaussian(x, z,  0.36,  0.20, 0.18, 0.13),
            gaussian(x, z,  0.66,  0.40, 0.16, 0.14),
        ];
        const summits = Math.max(...peaks);
        // Shared high plateau connecting them
        const ridgeZ = x * 0.55 + 0.02;
        const ridgeH = Math.max(0, 1 - Math.abs(z - ridgeZ) * 3.5) * 0.55;
        const base = Math.max(summits, ridgeH);
        // Ridged noise for jagged alpine texture
        return base * 0.80 + ridged(x + 30, z + 30, 7) * 0.28 * (0.3 + base * 0.7);
    });
}

function himalayas(): Float32Array {
    return build((x, z) => {
        // Long near-horizontal ridge, slight northward tilt
        const ridgeZ = x * 0.12;
        const ridgeH = Math.max(0, 1 - Math.abs(z - ridgeZ) * 2.8);
        // Eight-thousanders: Everest at centre, others spread along
        const summits = Math.max(
            gaussian(x, z, -0.72,  0.00, 0.11, 0.09),  // Dhaulagiri
            gaussian(x, z, -0.45, -0.02, 0.12, 0.10),  // Annapurna
            gaussian(x, z, -0.18,  0.00, 0.13, 0.11),  // Manaslu
            gaussian(x, z,  0.05,  0.00, 0.17, 0.13),  // Everest / Lhotse (tallest)
            gaussian(x, z,  0.32,  0.05, 0.12, 0.10),  // Makalu
            gaussian(x, z,  0.58,  0.08, 0.12, 0.10),  // Kangchenjunga
            gaussian(x, z,  0.78,  0.12, 0.10, 0.09),  // eastern outlier
        );
        const base = ridgeH * 0.55 + summits * 0.75;
        // Heavy ridged noise for the extreme jaggedness
        return base + ridged(x + 40, z + 40, 8) * 0.20 * ridgeH;
    });
}

function kilimanjaro(): Float32Array {
    return build((x, z) => {
        // Kibo: broad dormant main cone
        const kibo = gaussian(x, z, 0.12, 0.0, 0.52, 0.48);
        // Mawenzi: smaller eroded parasitic cone to the east
        const mawenzi = gaussian(x, z, -0.42, -0.12, 0.22, 0.19) * 0.70;
        // Shira: remnant ancient cone to the west (low plateau)
        const shira = gaussian(x, z, 0.60, 0.10, 0.28, 0.24) * 0.42;
        const volcano = Math.max(kibo, mawenzi, shira);
        // Gentle lava-flow texture on the broad flanks
        return volcano + fbm(x + 50, z + 50, 5) * 0.06 * volcano;
    });
}

function grandCanyon(): Float32Array {
    return build((x, z) => {
        // High Colorado Plateau
        const plateau = 0.65;
        // Sinuous canyon centerline following the Colorado River path
        const canyonCx = Math.sin(x * Math.PI * 1.2) * 0.14 + x * 0.05;
        const dist = Math.abs(z - canyonCx);
        const width = 0.20;
        // Inside canyon: terraced walls (inner gorge + Tonto Platform)
        let depth = 0;
        if (dist < width) {
            const t = dist / width; // 0 at centre, 1 at rim
            // Two terraces: inner gorge (steep) then Tonto Platform then upper walls
            const innerGorge = dist < width * 0.35 ? (1 - t / 0.35) * 1.4 : 0;
            const walls = Math.pow(1 - t, 0.4) * 1.1;
            depth = Math.max(innerGorge, walls);
        }
        const rimNoise = fbm(x + 60, z + 60, 5) * 0.09;
        return plateau - depth + rimNoise;
    });
}

export const PRESETS: TerrainPreset[] = [
    { name: "Fuji",         generate: fuji },
    { name: "Matterhorn",   generate: matterhorn },
    { name: "Alps",         generate: alps },
    { name: "Himalayas",    generate: himalayas },
    { name: "Kilimanjaro",  generate: kilimanjaro },
    { name: "Grand Canyon", generate: grandCanyon },
];
