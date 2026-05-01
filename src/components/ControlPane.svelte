<script lang="ts">
    import Control from "./Control.svelte";
    import Slider from "./Slider.svelte";
    import XYPad from "./XYPad.svelte";
    import { SUPPORTED_EXTS } from "../mountain_terrain";

    export let oscNote: number;
    export let centerX: number;
    export let centerY: number;
    export let radiusX: number;
    export let radiusY: number;
    export let freqX: number;
    export let freqY: number;
    export let phaseShift: number;

    export let onImportTerrain: (file: File) => Promise<void>;
    export let onResetTerrain: () => void;

    let terrainStatus: "idle" | "loading" | "loaded" | "error" = "idle";
    let terrainFileName = "";
    let terrainError = "";

    const accept = SUPPORTED_EXTS.map(e => `.${e}`).join(",");

    async function handleFileChange(event: Event) {
        const input = event.target as HTMLInputElement;
        const file = input.files?.[0];
        if (!file) return;

        terrainStatus = "loading";
        terrainFileName = file.name;
        terrainError = "";

        try {
            await onImportTerrain(file);
            terrainStatus = "loaded";
        } catch (err: any) {
            terrainStatus = "error";
            terrainError = err?.message ?? "Unknown error";
        }

        // reset input so the same file can be re-selected
        input.value = "";
    }

    function handleReset() {
        terrainStatus = "idle";
        terrainFileName = "";
        terrainError = "";
        onResetTerrain();
    }
</script>

<div class="flex flex-col">
    <!-- terrain import -->
    <span class="text-xl self-center mb-4">--- Terrain ---</span>

    <div class="flex flex-col items-center gap-2 px-4">
        <div class="flex gap-2">
            <label class="cursor-pointer border border-white px-3 py-1 text-sm hover:bg-white hover:text-black transition-colors">
                {terrainStatus === "loading" ? "Loading..." : "Import Model"}
                <input
                    type="file"
                    class="hidden"
                    {accept}
                    on:change={handleFileChange}
                    disabled={terrainStatus === "loading"}
                />
            </label>

            {#if terrainStatus === "loaded"}
                <button
                    class="border border-white px-3 py-1 text-sm hover:bg-white hover:text-black transition-colors"
                    on:click={handleReset}
                >
                    Reset
                </button>
            {/if}
        </div>

        {#if terrainStatus === "loaded"}
            <span class="text-xs text-green-400 text-center break-all">{terrainFileName}</span>
        {:else if terrainStatus === "error"}
            <span class="text-xs text-red-400 text-center whitespace-pre-wrap">{terrainError}</span>
        {:else}
            <span class="text-xs text-gray-400 text-center">
                PNG/JPG heightmap &bull; OBJ &bull; GLTF/GLB &bull; STL
            </span>
        {/if}
    </div>

    <!-- oscillator params -->
    <span class="text-xl self-center mb-4 mt-8">--- Oscillator ---</span>
    <Control label="Note">
        <Slider bind:v={oscNote} resolution={108} defaultValue={48/108} />
    </Control>

    <!-- orbit params -->
    <span class="text-xl self-center mb-4 mt-8">--- Orbit ---</span>

    <!-- xy pads -->
    <div class="flex">
        <Control label="Center XY">
            <XYPad
                bind:x={centerX}
                bind:y={centerY}
            />
        </Control>

        <div class="w-8"></div>

        <Control label="Radius XY">
            <XYPad
                bind:x={radiusX}
                bind:y={radiusY}
            />
        </Control>
    </div>

    <!-- sliders -->
    <div class="flex flex-col mt-8">
        <Control label="Frequency X">
            <Slider bind:v={freqX} resolution={8} defaultValue={1/8} />
        </Control>

        <div class="h-8"></div>

        <Control label="Frequency Y">
            <Slider bind:v={freqY} resolution={8} defaultValue={1/8} />
        </Control>

        <div class="h-8"></div>

        <Control label="Phase Shift">
            <Slider bind:v={phaseShift} resolution={8} defaultValue={2/8} />
        </Control>
    </div>
</div>
