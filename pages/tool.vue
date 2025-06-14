<template>
  <div class="relative bg-[#F5AFBE] w-full h-[100dvh] flex items-start justify-start">
    <div class="w-[15rem] flex items-start justify-start p-[2rem] gap-[1rem]">
      <div
        v-for="page in pageList"
        class=" aspect-[4/3] w-[calc(50%-.5rem)] flex justify-center items-center gap-[.5rem]"
      >
        <div class="aspect-[7/8] w-full bg-white rounded-xl"></div>
        <div class="bg-white px-[1rem]">
          {{ page.label }}
        </div>
      </div>
    </div>
  </div>
</template>
<script lang="ts" setup>

const pageList = ref([
  {
    name: 'toy',
    label: '玩具'
  },
  {
    name: 'place',
    label: '場景'
  },
  {
    name: 'game',
    label: '遊戲'
  }
])
</script>