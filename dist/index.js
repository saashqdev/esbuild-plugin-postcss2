var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __markAsModule = (target) => __defProp(target, "__esModule", {value: true});
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, {get: all[name], enumerable: true});
};
var __reExport = (target, module2, desc) => {
  if (module2 && typeof module2 === "object" || typeof module2 === "function") {
    for (let key of __getOwnPropNames(module2))
      if (!__hasOwnProp.call(target, key) && key !== "default")
        __defProp(target, key, {get: () => module2[key], enumerable: !(desc = __getOwnPropDesc(module2, key)) || desc.enumerable});
  }
  return target;
};
var __toModule = (module2) => {
  return __reExport(__markAsModule(__defProp(module2 != null ? __create(__getProtoOf(module2)) : {}, "default", module2 && module2.__esModule && "default" in module2 ? {get: () => module2.default, enumerable: true} : {value: module2, enumerable: true})), module2);
};
__markAsModule(exports);
__export(exports, {
  default: () => src_default,
  defaultOptions: () => defaultOptions
});
var import_fs_extra = __toModule(require("fs-extra"));
var import_util = __toModule(require("util"));
var import_path = __toModule(require("path"));
var import_tmp = __toModule(require("tmp"));
var import_postcss2 = __toModule(require("postcss"));
var import_postcss_modules = __toModule(require("postcss-modules"));
var import_less = __toModule(require("less"));
var import_stylus = __toModule(require("stylus"));
var import_resolve_file = __toModule(require("resolve-file"));
const defaultOptions = {
  plugins: [],
  modules: true,
  rootDir: process.cwd(),
  sassOptions: {},
  lessOptions: {},
  stylusOptions: {},
  fileIsModule: null
};
const postCSSPlugin = ({
  plugins = [],
  modules = true,
  rootDir = process.cwd(),
  sassOptions = {},
  lessOptions = {},
  stylusOptions = {},
  fileIsModule
} = defaultOptions) => ({
  name: "postcss2",
  setup(build) {
    const tmpDirPath = import_tmp.default.dirSync().name, modulesMap = [];
    const modulesPlugin = (0, import_postcss_modules.default)({
      generateScopedName: "[name]__[local]___[hash:base64:5]",
      ...typeof modules !== "boolean" ? modules : {},
      getJSON(filepath, json, outpath) {
        const mapIndex = modulesMap.findIndex((m) => m.path === filepath);
        if (mapIndex !== -1) {
          modulesMap[mapIndex].map = json;
        } else {
          modulesMap.push({
            path: filepath,
            map: json
          });
        }
        if (typeof modules !== "boolean" && typeof modules.getJSON === "function")
          return modules.getJSON(filepath, json, outpath);
      }
    });
    build.onResolve({filter: /.\.(css|sass|scss|less|styl)$/}, async (args) => {
      if (args.namespace !== "file" && args.namespace !== "")
        return;
      let sourceFullPath = (0, import_resolve_file.default)(args.path);
      if (!sourceFullPath)
        sourceFullPath = import_path.default.resolve(args.resolveDir, args.path);
      const sourceExt = import_path.default.extname(sourceFullPath);
      const sourceBaseName = import_path.default.basename(sourceFullPath, sourceExt);
      const isModule = fileIsModule ? fileIsModule(sourceFullPath) : sourceBaseName.match(/\.module$/);
      const sourceDir = import_path.default.dirname(sourceFullPath);
      const watchFiles = [sourceFullPath];
      let tmpFilePath;
      if (args.kind === "entry-point") {
        const sourceRelDir = import_path.default.relative(import_path.default.dirname(rootDir), import_path.default.dirname(sourceFullPath));
        tmpFilePath = import_path.default.resolve(tmpDirPath, sourceRelDir, `${sourceBaseName}.css`);
        await (0, import_fs_extra.ensureDir)(import_path.default.dirname(tmpFilePath));
      } else {
        const uniqueTmpDir = import_path.default.resolve(tmpDirPath, uniqueId());
        tmpFilePath = import_path.default.resolve(uniqueTmpDir, `${sourceBaseName}.css`);
      }
      await (0, import_fs_extra.ensureDir)(import_path.default.dirname(tmpFilePath));
      const fileContent = await (0, import_fs_extra.readFile)(sourceFullPath);
      let css = sourceExt === ".css" ? fileContent : "";
      if (sourceExt === ".sass" || sourceExt === ".scss") {
        const sassResult = await renderSass({
          ...sassOptions,
          file: sourceFullPath
        });
        css = sassResult.css.toString();
        watchFiles.push(...sassResult.stats.includedFiles);
      }
      if (sourceExt === ".styl")
        css = await renderStylus(new import_util.TextDecoder().decode(fileContent), {
          ...stylusOptions,
          filename: sourceFullPath
        });
      if (sourceExt === ".less")
        css = (await import_less.default.render(new import_util.TextDecoder().decode(fileContent), {
          ...lessOptions,
          filename: sourceFullPath,
          rootpath: import_path.default.dirname(args.path)
        })).css;
      const result = await (0, import_postcss2.default)(isModule ? [modulesPlugin, ...plugins] : plugins).process(css, {
        from: sourceFullPath,
        to: tmpFilePath
      });
      watchFiles.push(...getPostCssDependencies(result.messages));
      await (0, import_fs_extra.writeFile)(tmpFilePath, result.css);
      return {
        namespace: isModule ? "postcss-module" : "file",
        path: tmpFilePath,
        watchFiles,
        pluginData: {
          originalPath: sourceFullPath
        }
      };
    });
    build.onLoad({filter: /.*/, namespace: "postcss-module"}, async (args) => {
      const mod = modulesMap.find(({path: path2}) => path2 === args?.pluginData?.originalPath), resolveDir = import_path.default.dirname(args.path);
      return {
        resolveDir,
        contents: `import ${JSON.stringify(args.path)};
export default ${JSON.stringify(mod && mod.map ? mod.map : {})};`
      };
    });
  }
});
function renderSass(options) {
  return new Promise((resolve, reject) => {
    getSassImpl().render(options, (e, res) => {
      if (e)
        reject(e);
      else
        resolve(res);
    });
  });
}
function renderStylus(str, options) {
  return new Promise((resolve, reject) => {
    import_stylus.default.render(str, options, (e, res) => {
      if (e)
        reject(e);
      else
        resolve(res);
    });
  });
}
function getSassImpl() {
  let impl = "sass";
  try {
    require.resolve("sass");
  } catch {
    try {
      require.resolve("node-sass");
      impl = "node-sass";
    } catch {
      throw new Error('Please install "sass" or "node-sass" package');
    }
  }
  return require(impl);
}
function getFilesRecursive(directory) {
  return (0, import_fs_extra.readdirSync)(directory).reduce((files, file) => {
    const name = import_path.default.join(directory, file);
    return (0, import_fs_extra.statSync)(name).isDirectory() ? [...files, ...getFilesRecursive(name)] : [...files, name];
  }, []);
}
let idCounter = 0;
function uniqueId() {
  return Date.now().toString(16) + (idCounter++).toString(16);
}
function getPostCssDependencies(messages) {
  let dependencies = [];
  for (const message of messages) {
    if (message.type == "dir-dependency") {
      dependencies.push(...getFilesRecursive(message.dir));
    } else if (message.type == "dependency") {
      dependencies.push(message.file);
    }
  }
  return dependencies;
}
var src_default = postCSSPlugin;
