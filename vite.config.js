import { defineConfig } from "vite";
import { resolve } from "path";
import { viteStaticCopy } from "vite-plugin-static-copy";

export default defineConfig({
    build: {
        outDir: "dist",
        emptyOutDir: true,
        sourcemap: true,
        rollupOptions: {
            input: {
                main: resolve(__dirname, "src/main.js")
            },
            output: {
                entryFileNames: "main.js",
                chunkFileNames: "chunks/[name].js",
                assetFileNames: "assets/[name][extname]"
            }
        }
    },
    plugins: [
        viteStaticCopy({
            targets: [
                { src: "src/manifest.json", dest: "." },
                { src: "src/sidebar.html", dest: "." },
                { src: "src/howto.html", dest: "." },
                { src: "src/background.js", dest: "." },
                { src: "src/style.css", dest: "." },
                { src: "readme.md", dest: "." },
                { src: "LICENSE", dest: "." },
                { src: "src/icon16.png", dest: "." },
                { src: "src/icon32.png", dest: "." },
                { src: "src/icon48.png", dest: "." },
                { src: "src/icon128.png", dest: "." }
            ]
        })
    ]
});
