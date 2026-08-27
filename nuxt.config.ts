// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: "2025-07-15",
  devtools: { enabled: true },
  modules: ["@nuxt/ui"],
  css: ["~/assets/css/main.css"],

  icon: {
    mode: "auto",
    serverBundle: {
      collections: ["lucide"],
    },
  },

  ui: {
    icons: ["lucide"],
  },

  colorMode: {
    preference: "dark",
    fallback: "dark",
    classSuffix: "",
  },

  nitro: {
    prerender: {
      // Don't prerender pages that use dynamic icons
      routes: ["/sitemap.xml"],
    },
  },

  runtimeConfig: {
    public: {
      backendUrl: process.env.NUXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000",
      siteName: process.env.SITENAME ?? "OUROBOROS",
      siteLogo: process.env.SITELOGO ?? "logo1",
    },
  },

  app: {
    head: {
      title: "ROOC StatDB",
      htmlAttrs: {
        class: "dark",
      },
    },
  },
});
