let Spinner = require('cli-spinner').Spinner;
let colors = require("colors");
spinner = new Spinner("");

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

        console.log(`[${time}][${level.toUpperCase()}][${this._name}]`[colorMap[level]],...args);
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
module.exports=Logger;