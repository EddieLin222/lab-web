<template>
    <div
        class="absolute top-0 left-0 w-full h-full content-[''] z-10 pointer-events-none"
        :style="{
            opacity: .1,
            backgroundImage: noiseBackground
        }"
        :class="noiseBackground"
    ></div>
    <section
        class="font-semibold 2xl::h-[600px] sm:h-[500px] h-[450px] bg-gradient-to-t dark:to-gray-800 dark:from-gray-950 to-[#dadada] from-[#ebebeb] flex flex-col items-center justify-center dark:text-white text-black">
        <div
            class="absolute bottom-0 left-0 right-0 top-0 bg-[linear-gradient(to_right,#4f4f4f2e_1px,transparent_1px),linear-gradient(to_bottom,#4f4f4f2e_1px,transparent_1px)] bg-[size:35px_34px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]">
        </div>

        <h1 class="2xl:text-7xl text-5xl px-8 font-semibold text-center tracking-tight leading-[120%]">
            An Home Page with Noise Effect
        </h1>
    </section>
</template>

<script lang="ts" setup>
import noise from '../public/effect/noise.gif'
const noiseBackground = computed(()=>{
    return `url(${noise})`
})
</script>
