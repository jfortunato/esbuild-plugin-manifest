"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
let Plugin = (options = {}) => ({
    name: 'manifest',
    setup(build) {
        build.initialOptions.metafile = true;
        // assume that the user wants to hash their files by default,
        // but don't override any hashing format they may have already set.
        if (options.hash !== false && !build.initialOptions.entryNames) {
            build.initialOptions.entryNames = '[dir]/[name]-[hash]';
        }
        build.onEnd(result => {
            // we'll map the input entry point filename to the output filename
            const entryPoints = new Map();
            if (!result.metafile) {
                throw new Error("Expected metafile, but it does not exist.");
            }
            const addEntrypoint = (entryPoint, outputFilename) => {
                let input = options.shortNames === true ? path_1.default.basename(entryPoint) : entryPoint;
                let output = options.shortNames === true ? path_1.default.basename(outputFilename) : outputFilename;
                // When shortNames are enabled, there can be conflicting filenames.
                // For example if the entry points are ['src/pages/home/index.js', 'src/pages/about/index.js'] both of the
                // short names will be 'index.js'. We'll just throw an error if a conflict is detected.
                //TODO: This should also fail when it's running extensionless and bundles CSS
                if (options.shortNames === true && entryPoints.has(input)) {
                    throw new Error(`There is a conflicting shortName for '${input}'.`);
                }
                // check if the extensionless option is being used on the input or output
                input = shouldModify('input', options.extensionless) ? extensionless(input) : input;
                output = shouldModify('output', options.extensionless) ? extensionless(output) : output;
                if (entryPoints.has(input)) {
                    //  throw new Error(`There is a conflicting input for '${input}' (entrypoint: '${output}').`);
                }
                entryPoints.set(input, output);
            };
            for (const outputFilename in result.metafile.outputs) {
                const outputInfo = result.metafile.outputs[outputFilename];
                if (outputInfo.entryPoint) {
                    addEntrypoint(outputInfo.entryPoint, outputFilename);
                }
                else {
                    const extension = outputFilename.split('.').pop();
                    if (!extension) {
                        continue; // we cant map extensionless output
                    }
                    if (!["js", "css"].includes(extension)) {
                        continue; // Only generate manifest for js- and css-files
                    }
                    const isUnique = (input, index, self) => index === self.indexOf(input);
                    let mapEntrypointWithExtension = (entrypoint) => entrypoint.split('.').slice(0, -1).join('.') + "." + extension;
                    Object.keys(outputInfo.inputs)
                        .map(inputFilename => findEntryPoints(result.metafile, inputFilename))
                        .reduce((previousValue, currentValue) => [...previousValue, ...currentValue], [])
                        .filter(isUnique)
                        .map(mapEntrypointWithExtension)
                        .forEach(entrypoint => addEntrypoint(entrypoint, outputFilename));
                }
            }
            if (build.initialOptions.outdir === undefined && build.initialOptions.outfile === undefined) {
                throw new Error("You must specify an 'outdir' when generating a manifest file.");
            }
            const outdir = build.initialOptions.outdir || path_1.default.dirname(build.initialOptions.outfile);
            const filename = options.filename || 'manifest.json';
            return fs_1.default.promises.writeFile(`${outdir}/${filename}`, JSON.stringify(fromEntries(entryPoints), null, 2));
        });
    }
});
const shouldModify = (inputOrOutput, optionValue) => {
    return optionValue === inputOrOutput || optionValue === true;
};
const extensionless = (value) => {
    const parsed = path_1.default.parse(value);
    const dir = parsed.dir !== '' ? `${parsed.dir}/` : '';
    return `${dir}${parsed.name}`;
};
const findEntryPoints = (metafile, inputName) => {
    const entrypoints = new Array();
    // @ts-ignore
    for (let [outputFilename, outputObject] of Object.entries(metafile.outputs)) {
        if (Object.keys(outputObject.inputs).includes(inputName)) {
            if (outputObject.entryPoint) {
                entrypoints.push(outputObject.entryPoint);
            }
            else {
                entrypoints.concat(findEntryPoints(metafile, outputFilename));
            }
        }
    }
    return entrypoints;
};
const fromEntries = (map) => {
    return Array.from(map).reduce((obj, [key, value]) => {
        obj[key] = value;
        return obj;
    }, {});
};
module.exports = Plugin;
