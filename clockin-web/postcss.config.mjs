/** Tailwind v4 — object form avoids “Malformed PostCSS Configuration”
 *  (calling/passing the plugin factory returns `{ plugins: [...] }`). */
const config = {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};

export default config;
