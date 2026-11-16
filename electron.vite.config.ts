import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: { plugins: [externalizeDepsPlugin()] },
  // com o sandbox ligado, a ponte só pode carregar o próprio electron
  preload: { plugins: [externalizeDepsPlugin({ exclude: ['@electron-toolkit/preload'] })] },
  renderer: { plugins: [react()] }
})
