import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// base absoluta: la app también se sirve en /nota/<ruta>, y con rutas
// relativas los assets se buscarían en /nota/assets.
// Puerto 5180: el 5173 lo usa el shell de espacio en desarrollo.
export default defineConfig({
  base: '/',
  plugins: [react()],
  server: { port: 5180, strictPort: true },
  preview: { port: 5180 },
})
