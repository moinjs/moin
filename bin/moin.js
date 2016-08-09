#!/usr/bin/env node
let fs = require("fs");
let path = require("path");
let cwd = process.cwd();

if (!fs.existsSync(path.join(cwd, "node_modules"))) {
    fs.mkdirSync(path.join(cwd, "node_modules"));
}
require("../index.js")(cwd);