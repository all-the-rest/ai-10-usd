import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  base: "/",
  plugins: [svelte(), tailwindcss()],
  define: {
    // Gemeinsamer Zeitstempel für Client **und** Prerender/SSR (siehe
    // `src/lib/buildInfo.ts`). `scripts/prerender.mjs` setzt BUILD_STAMP einmal
    // vor beiden Builds → identischer Wert auf Server und Client, damit der
    // Peak-Live-Status/Countdown der Provider-Zelle hydration-stabil bleibt.
    // Ohne Env (Dev-Server) genügt der einmal pro Config-Evaluierung ermittelte
    // Wert: im Dev-Server gibt es kein Server-HTML zum Hydrieren.
    __BUILD_TIME_ISO__: JSON.stringify(process.env.BUILD_STAMP ?? new Date().toISOString()),
  }
});
