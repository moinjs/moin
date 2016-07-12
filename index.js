let Loader = require("./lib/loader");
let fs = require("fs");
let path = require("path");
let PromiseEventEmitter = require("./lib/PromiseEventEmitter");
let Logger = require("./lib/Logger");

let log = new Logger("main");

Array.prototype.unique = function () {
    let set = new Set();
    return this.filter(elem=> {
        if (set.has(elem))return false;
        set.add(elem);
        return true;
    });
};

Object.deepExtend = function (destination, source) {
    for (var property in source) {
        if (!source.hasOwnProperty(property))continue;
        if (source[property] && source[property].constructor &&
            source[property].constructor === Object) {
            destination[property] = destination[property] || {};
            arguments.callee(destination[property], source[property]);
        } else {
            destination[property] = source[property];
        }
    }
    return destination;
};

let modulePaths = [
    path.join(__dirname, "node_modules"), path.join(path.dirname(module.parent.filename), "node_modules")
];
let settings = {
    modulePaths: [],
    servicePaths: []
};

module.exports = function (config = {}, cwd = path.dirname(module.parent.filename)) {
    let _modules = [];
    settings = Object.deepExtend(settings, config);
    let running = false;

    let _api = (function () {
        let custom = {};
        let main = new class extends PromiseEventEmitter {
            joinPath(...pathSegments) {
                return path.join(cwd, ...pathSegments);
            }

            load(path) {
                return Loader(path);
            }

            getMainModule() {
                return module.parent;
            }

            getLogger(name) {
                return new Logger(name);
            }

            registerMethod(name, fnc, after = true) {
                if (!custom.hasOwnProperty(name))custom[name] = [];
                if (after) {
                    custom[name].push(fnc);
                } else {
                    custom[name].unshift(fnc);
                }
            }
        };

        process.on('SIGINT', function () {
            log.warn("SIGINT received. stopping Moin");
            _api.emit("exit").then(()=> {
                process.exit(0);
            });
        });

        let api = new Proxy(main, {
            get(target, name) {
                if (name in main)return main[name];
                if (!custom.hasOwnProperty(name))return undefined;
                return function () {
                    let lastValue = undefined;
                    let args = [...arguments];
                    let stop = false;
                    let thisObj = {
                        getLastValue(){
                            return lastValue;
                        },
                        setArguments(arguments){
                            args = arguments;
                        },
                        stopPropagation(){
                            stop = true;
                        },
                        getApi(){
                            return api;
                        }
                    };

                    custom[name].forEach(function (fnc) {
                        if (stop)return;
                        lastValue = fnc.apply(thisObj, args);
                    });
                    return lastValue;
                };
            }
        });
        api.setThisObject(api);
        return api;
    })();

    function scanForModules() {

    }

    function scanForFolders(folders) {
        return Promise.all(folders.map(folder=> {
            return new Promise((resolve, reject)=> {
                fs.readdir(folder, function (err, sub) {
                    if (err) {
                        resolve([]);
                    } else {
                        resolve(sub.map(f=>path.join(folder, f)));
                    }
                })
            })
        })).then(result=>result.reduce((arr, elem)=>arr.concat(elem), []));
    }

    return {
        addModulePath(path){
            settings.modulePaths.push(path);
            return this;
        },
        addServicePath(path){
            settings.modulePaths.push(path);
            return this;
        },
        getApi(){
            return _api;
        },
        run(){
            if (running)throw "Allready running";
            running = true;
            settings.modulePaths = settings.modulePaths.concat(modulePaths).map(p=>path.resolve(p)).unique();
            return scanForFolders(settings.modulePaths)
                .then((folders)=>Promise.all(folders.map(folder=>Loader(folder))))
                .then((modules)=>modules.filter(m=>m != null && m.getType() == "module"))
                .then(modules=> {
                    return new Promise((resolve, reject)=> {
                        let loadOrder = [];
                        while (modules.length > 0) {
                            let resolvable = modules.filter(mod=>mod.isResolved());
                            modules = modules.filter(mod=>!mod.isResolved());
                            if (resolvable.length == 0)throw "Cannot fullfill all dependencies";
                            loadOrder = loadOrder.concat(resolvable);
                            modules.forEach(module=> {
                                resolvable.forEach(res=> {
                                    module.resolveDependency(res);
                                })
                            })
                        }
                        resolve(loadOrder);
                    });
                }).then(function (modules) {
                    _modules = modules;
                    _modules.forEach(module=>module.load(_api));
                    log.info(`${_modules.length} modules loaded. beginning startup`)
                }).then(function () {
                    log.startSpinner("Initializing Modules %s");
                }).then(function (spinner) {
                    return _api.emit("init");
                }).then(function (spinner) {
                    log.stopSpinner();
                }).then(function () {
                    log.info("Startup complete");
                })
                .catch(function (e) {
                    log.error("Error in startup routine:", e);
                });
        }

    };
};