import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    // your paths...
  ],
  theme: {
    extend: {
      animation: {
        'spin-reverse-slow': 'spin-reverse 3s linear infinite',
      },
      keyframes: {
        'spin-reverse': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(-360deg)' },
        }
      }
    },
  },
  plugins: [],
}
export default config