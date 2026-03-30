import { defineConfig } from 'vite'
import path from 'path'
import { createRequire } from 'module'
import wasm from 'vite-plugin-wasm'

const require = createRequire(import.meta.url)
const monacoEditorPlugin = require('vite-plugin-monaco-editor').default

export default defineConfig({
    root: path.resolve(__dirname, 'src'),
    server: {
        port: 5173,
        open: true
    },
    optimizeDeps: {
        // Prevent Vite from pre-bundling the mupdf WASM module; it must be
        // loaded natively so the browser can stream-compile the .wasm binary.
        exclude: ['mupdf'],
    },
    build: {
        outDir: '../dist',
        emptyOutDir: true,
        target: 'esnext',  // Required for mupdf top-level await
    },
    worker: {
        format: 'es',
        plugins: () => [wasm()],
    },
    plugins: [
        wasm(),
        monacoEditorPlugin({
            languageWorkers: ['editorWorkerService', 'html', 'css']
        }),
    ]
})
