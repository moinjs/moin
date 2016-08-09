let fs = require("fs");
let path = require("path");

let saveConf = ()=> {
};

function loadJSON(path) {
    try {
        let content = fs.readFileSync(path).toString();
        let object = JSON.parse(content);
        return object;
    } catch (e) {
        return null;
    }
}

class MoinComponent {
    constructor(path, settings) {
        this._settings = settings;
        this._path = path;
        this._dependecies = {
            module: [],
            service: []
        };
        if (settings.moin.hasOwnProperty("moduleDependencies") && Array.isArray(settings.moin.moduleDependencies)) {
            this._dependecies.module = settings.moin.moduleDependencies;
        }
        if (settings.moin.hasOwnProperty("serviceDependencies") && Array.isArray(settings.moin.serviceDependencies)) {
            this._dependecies.service = settings.moin.serviceDependencies;
        }
    }

    resolveDependency(component) {
        let type = component.getType();
        let module = component.getName();
        if (this._dependecies.hasOwnProperty(type)) {
            let position = this._dependecies[type].indexOf(module);
            if (position == -1)return;
            this._dependecies[type].splice(position, 1);
        }
    }

    getName() {
        return this._settings.name;
    }

    getType() {
        return this._settings.moin.type;
    }

    isResolved() {
        return this._dependecies.module.length + this._dependecies.service.length == 0;
    }

    getPath() {
        return this._path;
    }
}
class MoinModule extends MoinComponent {
    constructor(path, settings) {
        super(path, settings);
        if (settings.moin.hasOwnProperty("serviceDependencies"))throw "Modules can only have Module Dependencies";
        let defOptions = {active: true};
        if (settings.moin.hasOwnProperty("settings")) {
            defOptions = Object.deepExtend(defOptions, settings.moin.settings);
        }
        saveConf({[this.getName()]: defOptions});
    }

    load(api, settings) {
        require(this._path)(api, settings);
    }
}

class MoinService extends MoinComponent {
    constructor(path, settings) {
        super(path, settings);
    }
}


module.exports = (fnc)=> {
    saveConf = fnc;
    return function (modulePath) {
        modulePath = path.resolve(modulePath);
        return new Promise(function (resolve, reject) {
            //Check if Path exists and is a Folder
            fs.stat(modulePath, (err, stat)=> {
                if (err || stat.isFile()) {
                    //console.log("No folder", modulePath);
                    resolve(null);
                } else {
                    //Check if there is a package.json
                    fs.stat(path.join(modulePath, "package.json"), (err, stat)=> {
                        if (err) {
                            //console.log("No package.json", modulePath);
                            resolve(null);
                        } else {
                            try {
                                //Parse package.json and check for 'moin' config field
                                let data = loadJSON(path.join(modulePath, "package.json"));
                                if (!data.hasOwnProperty("moin")) {
                                    resolve(null);
                                } else {
                                    let moin = data.moin;
                                    if (!moin.hasOwnProperty("type") || !(moin.type == "module" || moin.type == "service")) {
                                        //console.error("moin property in package.json without proper type:", modulePath);
                                        resolve(null);
                                    } else {
                                        fs.stat(path.join(modulePath, "index.js"), (err, stat)=> {
                                                if (err) {
                                                    console.log("No index.js", modulePath);
                                                    resolve(null);
                                                } else {
                                                    if (moin.type == "module") {
                                                        resolve(new MoinModule(modulePath, data));
                                                    } else {
                                                        resolve(new MoinService(modulePath, data));
                                                    }
                                                }
                                            }
                                        )
                                    }
                                }
                            } catch (e) {
                                console.error("Error while parsing package.json: " + modulePath, `[${e}]`);
                                resolve(null);
                            }

                        }
                    });
                }
            })
        });
    }
};