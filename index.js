let Loader = require("./lib/loader");
let fs = require("fs");
let path = require("path");
let PromiseEventEmitter = require("./lib/PromiseEventEmitter");
let Logger = require("./lib/Logger");


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
    moin: {
        modulePaths: []
    },
    logging: {
        level: "debug",
        disabled: []
    }
};

let moin = function (cwd, init) {
    let config = {};
    if (fs.existsSync(path.join(cwd, "config.json"))) {
        config = require(path.join(cwd, "config.json"));
    }

    let confStr = JSON.stringify(config);

    Loader = Loader((conf)=> {
        config = Object.deepExtend(conf, config);
    });

    let _modules = [];
    config = Object.deepExtend(settings, config);
    let running = false;

    Logger = Logger(config.logging);
    let log = new Logger("main");


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
                        setArguments(...arguments){
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
            settings.moin.modulePaths.push(path);
            return this;
        },
        getApi(){
            return _api;
        },
        run(){
            if (running)throw "Allready running";
            running = true;
            let lookupPaths = settings.moin.modulePaths.concat(modulePaths).map(p=>path.resolve(p)).unique();
            return scanForFolders(lookupPaths)
                .then((folders)=>Promise.all(folders.map(folder=>Loader(folder))))
                .then((modules)=>modules.filter(m=>m != null && m.getType() == "module"))
                .then(modules=> {
                    return new Promise((resolve, reject)=> {
                        let loadOrder = [];

                        while (modules.length > 0) {
                            let resolvable = modules
                                .filter(mod=>mod.isResolved())
                                .filter(mod=>config[mod.getName()].active);

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
                    if (init)return;
                    _modules = modules;
                    _modules.forEach(module=>module.load(_api, config[module.getName()]));
                    log.info(`${_modules.length} modules loaded. beginning startup`)
                }).then(function () {
                    log.startSpinner("Initializing Modules %s");
                }).then(function (spinner) {
                    return _api.emit("init");
                }).then(function (spinner) {
                    log.stopSpinner();
                }).then(function () {
                    log.info("Startup complete");
                    if (confStr != JSON.stringify(config)) {
                        log.info("Change in Modules detected. Saving config.json");
                        fs.writeFileSync(path.join(cwd, "config.json"), JSON.stringify(config, null, 2));
                    }
                })
                .catch(function (e) {
                    log.error("Error in startup routine:", e);
                });
        }

    };
};

module.exports = function (cwd = path.dirname(module.parent.filename), init = false) {
    moin = moin(cwd, init);
    return moin.run().then(()=>moin.getApi());
};