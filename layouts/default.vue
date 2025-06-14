<template>
  <div class="flex w-full h-full">
    <slot name="header"></slot>
    <div class="w-full h-[100dvh]">
      <slot></slot>
    </div>
    <slot name="footer"></slot>
  </div>
</template>
<style scoped lang="sass">
</style>