import esbuilt from 'esbuild';
import sveltePlugin from 'esbuild-svelte';
import sveltePreprocess from 'svelte-preprocess';
import serve from 'create-serve';

import FsExtra from 'fs-extra';
import { zipper } from './rollupScripts/zipper.js';
import { glsli } from './rollupScripts/shaderCompiler.js';

import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const { copySync, readFileSync } = FsExtra;

const pkg = JSON.parse(readFileSync('./package.json'));
const isDev = process.argv.includes('--dev');

const outdir = './static/';

function finishing() {
    console.log('dataset generation');
    zipper(__dirname);
    pkg.toCopy.forEach((item) => copySync(item.in, item.out));
    console.log('end');
}

const finishingPlugin = {
    name: 'finishingPlugin',
    setup(build) {
        build.onEnd(result => {
            finishing();
            spawn('npm', ['run', 'lint:dev'], { stdio: 'inherit' });
            if (isDev) {
                serve.update();
            }
        })
    },
}

const esBuiltOptions = {
    target: 'esnext',
    sourcemap: false,
    legalComments: 'none',
    format: 'esm',
    entryPoints: ['src/routes/app/app.js', 'src/routes/test/test1.js', 'src/routes/test/test2.js'],
    minify: !isDev,
    treeShaking: true,
    ignoreAnnotations: true,
    bundle: true,
    outdir,
    platform: 'browser',
    write: true,
    define: { global: 'window' },
    loader: { '.ts': 'ts' },
    plugins: [
        sveltePlugin({
            preprocess: sveltePreprocess(),
        }),
        glsli(isDev),
        finishingPlugin
    ],
    logLevel: 'info'
}

if (!isDev) {
    esbuilt.build(esBuiltOptions);
} else {
    console.info('http://localhost:8000/application.html');
    serve.start({
        root: outdir,
        port: 8000,
    });
    const ctx = await esbuilt.context(esBuiltOptions);
    await ctx.watch();

}

