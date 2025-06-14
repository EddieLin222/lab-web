import { defineStore } from 'pinia';
import { ref } from 'vue';

export const use{{pascalCase name}}Store = defineStore('{{kebabCase name}}', ()=>{
  const data = ref('codfish');
  
  return {
    data,
  }
})