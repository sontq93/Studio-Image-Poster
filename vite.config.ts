import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  // Fix: Property 'cwd' does not exist on type 'Process'. Using type assertion.
  const env = loadEnv(mode, (process as any).cwd(), '');
  
  return {
    plugins: [react()],
    define: {
      // Định nghĩa process.env.API_KEY để thay thế bằng giá trị thực khi build
      // Điều này cần thiết vì @google/genai SDK yêu cầu process.env.API_KEY
      'process.env.API_KEY': JSON.stringify(env.API_KEY)
    }
  }
})