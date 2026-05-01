<script lang="ts">
    import Control from "./Control.svelte";
    import Slider from "./Slider.svelte";
    import XYPad from "./XYPad.svelte";
    import { PRESETS, type TerrainPreset } from "../presets";
    import { SUPPORTED_EXTS } from "../mountain_terrain";

    export let oscNote: number;
    export let centerX: number;
    export let centerY: number;
    export let radiusX: number;
    export let radiusY: number;
    export let freqX: number;
    export let freqY: number;
    export let phaseShift: number;

    export let onLoadPreset: (preset: TerrainPreset) => void;
    export let onImportTerrain: (file: File) => Promise<void>;
    export let onResetTerrain: () => void;

    type TerrainMode = "default" | "preset" | "imported";
    let mode: TerrainMode = "default";
    let activePresetName = "";
    let importedFileName = "";
    let importing = false;
    let importError = "";

    const accept = SUPPORTED_EXTS.map(e => `.${e}`).join(",");

    function handlePreset(preset: TerrainPreset) {
        onLoadPreset(preset);
        mode = "preset";
        activePresetName = preset.name;
        importError = "";
    }

    function handleDefault() {
        onResetTerrain();
        mode = "default";
        activePresetName = "";
        importedFileName = "";
        importError = "";
    }

    async function handleFileChange(event: Event) {
        const input = event.target as HTMLInputElement;
        const file = input.files?.[0];
        if (!file) return;

        importing = true;
        importError = "";

        try {
            await onImportTerrain(file);
            importedFileName = file.name;
            mode = "imported";
            activePresetName = "";
        } catch (err: any) {
            importError = err?.message ?? "Unknown error";
        } finally {
            importing = false;
            input.value = "";
        }
    }

    function btn(active: boolean) {
        const base = "border px-3 py-1 text-sm transition-colors";
        return active
            ? `${base} border-white bg-white text-black`
            : `${base} border-white text-white hover:bg-white hover:text-black`;
    }
</script>

<div class="flex flex-col">
    <!-- terrain section -->
    <span class="text-xl self-center mb-4">--- Terrain ---</span>

    <div class="flex flex-col items-center gap-3 px-4">

        <!-- default button -->
        <button class={btn(mode === "default")} on:click={handleDefault}>
            Default
        </button>

        <!-- presets -->
        <div class="flex flex-col items-center gap-1 w-full">
            <span class="text-xs text-gray-400 mb-1">Presets</span>
            <div class="flex flex-wrap justify-center gap-2">
                {#each PRESETS as preset}
                    <button
                        class={btn(mode === "preset" && activePresetName === preset.name)}
                        on:click={() => handlePreset(preset)}
                    >
                        {preset.name}
                    </button>
                {/each}
            </div>
        </div>

        <!-- import -->
        <div class="flex flex-col items-center gap-1 w-full">
            <span class="text-xs text-gray-400 mb-1">Import 3D Model / Heightmap</span>
            <label class={btn(mode === "imported") + " cursor-pointer"}>
                {importing ? "Loading..." : mode === "imported" ? "Replace File" : "Choose File"}
                <input
                    type="file"
                    class="hidden"
                    {accept}
                    on:change={handleFileChange}
                    disabled={importing}
                />
            </label>

            {#if mode === "imported"}
                <span class="text-xs text-green-400 text-center break-all max-w-xs">{importedFileName}</span>
            {/if}

            {#if importError}
                <span class="text-xs text-red-400 text-center whitespace-pre-wrap max-w-xs">{importError}</span>
            {/if}

            <span class="text-xs text-gray-500 text-center mt-1">
                PNG/JPG heightmap &bull; OBJ &bull; GLTF/GLB &bull; STL<br/>
                <a
                    href="https://terraining.ateliernonta.com/?debug=true"
                    target="_blank"
                    class="underline text-gray-400 hover:text-white"
                >Get real-world terrain data ↗</a>
            </span>
        </div>
    </div>

    <!-- oscillator params -->
    <span class="text-xl self-center mb-4 mt-8">--- Oscillator ---</span>
    <Control label="Note">
        <Slider bind:v={oscNote} resolution={108} defaultValue={48/108} />
    </Control>

    <!-- orbit params -->
    <span class="text-xl self-center mb-4 mt-8">--- Orbit ---</span>

    <div class="flex">
        <Control label="Center XY">
            <XYPad bind:x={centerX} bind:y={centerY} />
        </Control>

        <div class="w-8"></div>

        <Control label="Radius XY">
            <XYPad bind:x={radiusX} bind:y={radiusY} />
        </Control>
    </div>

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
