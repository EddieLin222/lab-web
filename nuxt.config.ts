// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  devtools: { enabled: true },

  plugins: [
    '~/plugins/babylon.client.ts'
  ],

  modules: [
    'nuxt-quasar-ui',
    '@nuxtjs/tailwindcss',
    '@pinia/nuxt',
    'dayjs-nuxt',
    '@nuxt/image',
    '@vueuse/nuxt'
  ],

  quasar: {
    plugins: [
      'Notify',
      'Dialog',
      'Loading'
    ],
    config: {
      notify: {},
    },
    extras:{
      fontIcons: [
        'material-symbols-outlined'
      ]
    }
  },

  dayjs: {
    locales: [ 'zh-tw'],
    defaultLocale: 'zh-tw',
    defaultTimezone: 'Asia/Taipei',
    plugins: [ 'utc', 'timezone' ]
  },
  tailwindcss: {
    exposeConfig: true,
    viewer: true,
    // and more...
  },
  vite: {
    css: {
      preprocessorOptions: {
        sass: {
          additionalData: '@use "@/assets/_colors.sass" as *\n'
        }
      }
    }
  },

  css: ["@/assets/style/main.sass"],
  compatibilityDate: '2025-03-11'
})