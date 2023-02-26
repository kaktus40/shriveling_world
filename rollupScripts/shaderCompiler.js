import * as glsl from 'glslify';
import nodeGles from 'node-gles';
import { addExtensionsToContext } from 'twgl.js';

import { commentStripper } from './commentStripper.js';

const errorReg = /\d+:(\d+): /g;
function testSharder(gl, text = '', isFragment = true) {
    const shaderType = isFragment ? gl.FRAGMENT_SHADER : gl.VERTEX_SHADER;
    const shader = gl.createShader(shaderType);
    gl.shaderSource(shader, text);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const errAccumlator = {};
        gl.getShaderInfoLog(shader)
            .split('\n')
            .forEach((line) => {
                [...line.matchAll(errorReg)].map((m) => {
                    const num = Number.parseInt(m[1]);
                    if (!errAccumlator.hasOwnProperty(num)) {
                        errAccumlator[num] = [];
                    }
                    errAccumlator[num].push(line);
                });
            });
        let sortie = '';
        text.split('\n').forEach((line, i, arr) => {
            const lineNumber = i + 1;
            if (errAccumlator.hasOwnProperty(lineNumber)) {
                for (let j = Math.max(0, i - 5); j < lineNumber; j++) {
                    sortie += `\n${j + 1} : ${arr[j]}`;
                }
                sortie += '\n~~~~~~~~~~~~~~~~~~~~~~~~';
                errAccumlator[lineNumber].forEach((err) => {
                    sortie += `\n${err}`;
                });
            }
        });
        throw sortie;
    }
}

function minifyShader(source) {
    const commentsRegExp = /[ \t]*(?:(?:\/\*[\s\S]*?\*\/)|(?:\/\/.*\n))/g;
    const symbolsRegExp = /\s*([{}=*,+/><&|[\]()\-!?:;])\s*/g;

    let result = source.replace(/\r/g, "").replace(commentsRegExp, "");
    let wrap = false;

    result = result.split(/\n+/).reduce((acc, line) => {
        line = line.trim().replace(/\s{2,}|\t/, " ");
        if (line[0] === "#") {
            if (wrap) {
                acc.push("\n");
            }
            acc.push(line, "\n");
            wrap = false;
        } else {
            line = line.replace(/(else)$/m, "$1 ");
            acc.push(line.replace(symbolsRegExp, "$1"));
            wrap = true;
        }
        return acc;
    }, []).join("");
    return result.replace(/\n{2,}/g, "\n");
}

let converter = (path) => {
    return minifyShader(glsl.file(path, glsifyOpt));
}

const glsifyOpt = {
    transform: [
        ["glslify-import"]
    ]
}

export function glsli(isDev = true) {
    if (isDev) {
        const gl = nodeGles.createWebGLRenderingContext();
        addExtensionsToContext(gl);
        converter = (path) => {
            const source = glsl.file(path, glsifyOpt);
            try {
                testSharder(gl, source, true);
            } catch (error) {
                throw error;
            }
            return source;
        }
    }

    return {
        name: "glsl",
        setup(build) {

            async function onLoad(args) {

                const source = converter(args.path);

                return {
                    contents: commentStripper(source),
                    loader: "text"
                };

            }

            build.onLoad({ filter: /\.(?:frag|vert|glsl|wgsl)$/ }, onLoad);

        }
    };

}
