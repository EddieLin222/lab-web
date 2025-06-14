import { pipe } from "remeda"

const colors = {
  blue: {
    900: '#00869F'
  }
}

// const safelist = pipe()

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,vue}',
    './components/**/*.{js,ts,vue}',
    './layouts/**/*.{js,ts,vue}',
    './app.vue'
  ],
  safelist: [
    `bg-${colors.blue[900]}`,
    `text-${colors.blue[900]}`
  ],
  theme: {
    extend: {
      colors
    },
  },
  plugins: [],
}

