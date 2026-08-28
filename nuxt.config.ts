// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: "2025-07-15",
  srcDir: "src",
  devtools: { enabled: false },
  css: ["~/assets/styles/styles.scss", "leaflet/dist/leaflet.css"],
  modules: ["@pinia/nuxt", "@nuxt/eslint", "@nuxtjs/i18n"],
  i18n: {
    defaultLocale: "en",
    strategy: "no_prefix",
    langDir: "../src/locales",
    locales: [
      {
        code: "en",
        language: "en-US",
        file: "en.json",
      },
    ],
  },
});
