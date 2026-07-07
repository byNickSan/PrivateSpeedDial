// Dev-only lint config (NOT shipped in the extension). Lints classic global-namespace scripts.
export default [
  {
    files: ["src/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "script",
      globals: {
        // Browser / extension host globals (ECMAScript built-ins come from ecmaVersion).
        window: "readonly",
        document: "readonly",
        navigator: "readonly",
        location: "readonly",
        console: "readonly",
        fetch: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        requestAnimationFrame: "readonly",
        cancelAnimationFrame: "readonly",
        performance: "readonly",
        structuredClone: "readonly",
        matchMedia: "readonly",
        localStorage: "readonly",
        URL: "readonly",
        DOMParser: "readonly",
        TextDecoder: "readonly",
        IntersectionObserver: "readonly",
        ResizeObserver: "readonly",
        Blob: "readonly",
        FileReader: "readonly",
        Image: "readonly",
        Notification: "readonly",
        prompt: "readonly",
        alert: "readonly",
        chrome: "readonly",
        browser: "readonly",
        globalThis: "readonly",
        importScripts: "readonly",
        // App namespace, populated across modules.
        SD: "writable"
      }
    },
    rules: {
      "no-undef": "error",
      "no-redeclare": "error",
      "no-dupe-keys": "error",
      "no-unused-vars": ["warn", { args: "none", caughtErrors: "none" }]
    }
  }
];
