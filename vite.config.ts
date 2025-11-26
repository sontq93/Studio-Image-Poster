import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, (process as any).cwd(), '');

  // On Netlify, environment variables are injected into process.env during build.
  // We prioritize the system environment variable (process.env.API_KEY) 
  // over variables loaded from local .env files (env.API_KEY).
  // Fallback to empty string if undefined to prevent build/runtime errors.
  const apiKey = process.env.API_KEY || env.API_KEY || '';
  
  return {
    plugins: [react()],
    define: {
      // Define process.env.API_KEY global for use in the client-side bundle
      'process.env.API_KEY': JSON.stringify(apiKey)
    }
  }
})