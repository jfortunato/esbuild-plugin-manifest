import {
  BuildResult, Metafile,
  OnLoadArgs,
  OnLoadOptions, OnLoadResult,
  OnResolveArgs,
  OnResolveOptions, OnResolveResult,
  OnStartResult,
  Plugin,
  PluginBuild
} from 'esbuild';
import fs from 'fs';
import path from 'path';

type OptionValue = boolean | 'input' | 'output';

interface ManifestPluginOptions {
  hash?: boolean;
  shortNames?: boolean;
  filename?: string;
  extensionless?: OptionValue;
}

let Plugin = (options: ManifestPluginOptions = {}): Plugin => ({
  name: 'manifest',
  setup(build: PluginBuild) {
    build.initialOptions.metafile = true;

    // assume that the user wants to hash their files by default,
    // but don't override any hashing format they may have already set.
    if (options.hash !== false && !build.initialOptions.entryNames) {
      build.initialOptions.entryNames = '[dir]/[name]-[hash]';
    }

    build.onEnd(result => {
      // we'll map the input entry point filename to the output filename
      const entryPoints = new Map<string, string>();

      if (!result.metafile) {
        throw new Error("Expected metafile, but it does not exist.");
      }

      const addEntrypoint = (entryPoint: string, outputFilename: string) => {
        let input = options.shortNames === true ? path.basename(entryPoint) : entryPoint;
        let output = options.shortNames === true ? path.basename(outputFilename) : outputFilename;

        // When shortNames are enabled, there can be conflicting filenames.
        // For example if the entry points are ['src/pages/home/index.js', 'src/pages/about/index.js'] both of the
        // short names will be 'index.js'. We'll just throw an error if a conflict is detected.
        if (options.shortNames === true && entryPoints.has(input)) {
          throw new Error(`There is a conflicting shortName for '${input}'.`);
        }

        // check if the extensionless option is being used on the input or output
        input = shouldModify('input', options.extensionless) ? extensionless(input) : input;
        output = shouldModify('output', options.extensionless) ? extensionless(output) : output;

        entryPoints.set(input, output);
      }

      for (const outputFilename in result.metafile.outputs) {
        const outputInfo = result.metafile.outputs[outputFilename]!;

        // skip all outputs that don't have an entrypoint
        if (outputInfo.entryPoint === undefined) {
          const possibleEntryPoints = new Array<string>();

          Object.keys(outputInfo.inputs).forEach(inputFilename => {
            const possibleNewEntrypoint = findEntryPoint(result.metafile, inputFilename)
            if (!possibleNewEntrypoint)
              return

            if (possibleEntryPoints.includes(possibleNewEntrypoint))
              return;

            possibleEntryPoints.push(possibleNewEntrypoint)
          })

          if (possibleEntryPoints.length > 1) {
            possibleEntryPoints.slice(1).forEach(entrypoint => {
              const extension = outputFilename.split('.').pop()
              let newEntrypoint = entrypoint.split('.').slice(0, -1).join('.')
              newEntrypoint = newEntrypoint + "." + extension
              addEntrypoint(newEntrypoint, outputFilename);
            })
          }

          let newEntrypoint = possibleEntryPoints[0]
          if (!newEntrypoint) {
            continue;
          }

          const extension = outputFilename.split('.').pop()
          newEntrypoint = newEntrypoint.split('.').slice(0, -1).join('.')
          newEntrypoint = newEntrypoint + "." + extension

          outputInfo.entryPoint = newEntrypoint
        }

        if (!outputInfo.entryPoint) {
          continue;
        }
        addEntrypoint(outputInfo.entryPoint, outputFilename);
      }

      if (build.initialOptions.outdir === undefined && build.initialOptions.outfile === undefined) {
        throw new Error("You must specify an 'outdir' when generating a manifest file.");
      }

      const outdir = build.initialOptions.outdir || path.dirname(build.initialOptions.outfile!);

      const filename = options.filename || 'manifest.json';

      return fs.promises.writeFile(`${outdir}/${filename}`,
        JSON.stringify(fromEntries(entryPoints), null, 2))
    });
  }
});
export = Plugin;

const shouldModify = (inputOrOutput: 'input'|'output', optionValue?: OptionValue): boolean => {
  return optionValue === inputOrOutput || optionValue === true;
};

const extensionless = (value: string): string => {
  const parsed = path.parse(value);

  const dir = parsed.dir !== '' ? `${parsed.dir}/` : '';

  return `${dir}${parsed.name}`;
};

const findEntryPoint = (metafile: Metafile|undefined, inputName: string): string|undefined => {
  // @ts-ignore
  for (let [outputFilename, outputObject] of Object.entries(metafile.outputs)) {
    if (Object.keys(outputObject.inputs).includes(inputName)) {
      if (outputObject.entryPoint)
        return outputObject.entryPoint

      return findEntryPoint(metafile, outputFilename)

    }
  }

  return undefined
}

const fromEntries = (map: Map<string, string>): {[key: string]: string} => {
  return Array.from(map).reduce((obj: {[key: string]: string}, [key, value]) => {
    obj[key] = value;
    return obj;
  }, {});
};

(() => {
  const plugin = Plugin({})

  const build:PluginBuild = {
    initialOptions: {
      outdir: "build2"
    },
    onEnd(callback: (result: BuildResult) => (void | Promise<void>)): void {
      callback({
        errors: [], warnings: [],
        metafile: JSON.parse(fs.readFileSync("/home/richard/Projects/skil/eportal/public/build2/meta.json").toString())
      })
    },
    onLoad(options: OnLoadOptions, callback: (args: OnLoadArgs) => (OnLoadResult | Promise<OnLoadResult | null | undefined> | null | undefined)): void {
      callback({namespace: "", path: "", pluginData: undefined})
      console.log(options)
    },
    onResolve(options: OnResolveOptions, callback: (args: OnResolveArgs) => (OnResolveResult | Promise<OnResolveResult | null | undefined> | null | undefined)): void {
      console.log(options)
      callback({importer: "", kind: 'entry-point', namespace: "", path: "", pluginData: undefined, resolveDir: ""})
    },
    onStart(callback: () => (OnStartResult | void | Promise<OnStartResult | void | null> | null)): void {
      callback()
    }

  };

  plugin.setup(build)
})()
