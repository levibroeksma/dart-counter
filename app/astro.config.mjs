// @ts-check
import { defineConfig, sessionDrivers } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import alpinejs from "@astrojs/alpinejs";
import netlify from "@astrojs/netlify";

export default defineConfig({
  output: "server",
  adapter: netlify(),
  session: { driver: sessionDrivers.lruCache() },
  vite: {
    plugins: [tailwindcss()],
  },
  integrations: [
    alpinejs({ entrypoint: "/src/lib/client/alpine/app.factory" }),
  ],
  server: {
    port: 4321,
    host: true,
  },
  devToolbar: {
    enabled: false,
  },
});
