// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: "2025-07-15",
  srcDir: "src",
  devtools: { enabled: true },
  css: ["~/assets/styles/styles.scss", "leaflet/dist/leaflet.css"],
  modules: ["@pinia/nuxt", "@nuxt/eslint"],
});
