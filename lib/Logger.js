let Spinner = require('cli-spinner').Spinner;
let colors = require("colors");
spinner = new Spinner("");
let minLevel = 0;
let levelMap = [
    "debug",
    "info",
    "warning",
    "error"
];
let disabled = [];

class Logger {
    constructor(name) {
        this._name = name;
    }

    setName(name) {
        this._name = name;
    }

    newInstance(name) {
        return new Logger(name);
    }

    log(level, ...args) {
        if (disabled.indexOf(this._name) != -1)return;
        if (minLevel > levelMap.indexOf(level))return;

        let colorMap = {
            "error": "red",
            "debug": "grey",
            "info": "cyan",
            "warning": "yellow"
        };
        let color = colorMap.hasOwnProperty(level) ? colorMap[level] : "white";
        let time = new Date()
            .toISOString()
            .replace(/T/, ' ')
            .replace(/\..+/, '');

        console.log(`[${time}][${level.toUpperCase()}][${this._name}]`[color], ...args);
    }

    error(...args) {
        this.log("error", ...args);
    }

    warn(...args) {
        this.log("warning", ...args);
    }

    info(...args) {
        this.log("info", ...args);
    }

    debug(...args) {
        this.log("debug", ...args);
    }

    startSpinner(title = "%s") {
        title.replace("%s", "%s".red);
        spinner.setSpinnerTitle(title);
        spinner.start();
    }

    setSpinner(title = "%s") {
        title.replace("%s", "%s".red);
        spinner.setSpinnerTitle(title);
    }

    stopSpinner() {
        spinner.stop(true);
    }
}
function isNumeric(n) {
    return !isNaN(parseFloat(n)) && isFinite(n);
}
module.exports = (conf)=> {
    if (isNumeric(conf.level)) {
        minLevel = Math.max(0, Math.min(parseInt(conf.level), levelMap.length - 1));
    } else {
        let index = levelMap.indexOf(conf.level);
        if (index != -1)minLevel = index;
    }
    disabled = conf.disabled;
    return Logger;
};