import type { RouterOptions } from '@nuxt/schema'

export default <RouterOptions> {
  scrollBehavior(to, _from, savedPosition) {
    return new Promise((resolve, _reject) => {
      if (savedPosition) {
        resolve(savedPosition)
      } else {
        if (to.hash) {
          console.log('hash')
          resolve({
            el: to.hash,
            top: 130,
            behavior: "smooth"
          })
        } else {
          resolve({ top: 0 })
        }
      }
    })
  }
}