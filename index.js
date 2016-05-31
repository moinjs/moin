let fs = require("fs");
function printLogo(color = true) {
    let colors = require('colors');
    let logo = fs.readFileSync("logo.txt").toString();
    if (color) {
        let colorCodes = [
            [14, [-1, "yellow"]],
            [11,[4,"red"],[7, "yellow"],[-1,"blue"]],
            [15, [1, "yellow"],[-1,"blue"]],
            [10,[6,"red"],[6, "yellow"],[-1,"blue"]],
            [15, [13, "yellow"],[-1,"blue"]],
            [11,[4,"red"],[19, "yellow"],[-1,"blue"]],
            [15, [-1, "yellow"]],
            [[11,"cyan"],4,[25,"cyan"],[4,"yellow"],[-1,"cyan"]]

        ];
        let length=Math.max(...logo.split("\n").map(l=>l.length));
        logo = logo.split("\n")
            .map(l=>l+" ".repeat(length- l.length))
            .map((line, index)=> {
            if (colorCodes.length > index) {
                return colorCodes[index].reduce((out, data)=> {
                    let chars = 0;
                    let color = "reset";
                    if (typeof data == "number") {
                        chars = data;
                    } else {
                        [chars, ...color] = data;
                    }
                    let text = "";
                    if (chars == -1) {
                        text = line;
                    } else {
                        [text, line] = [line.substring(0, chars), line.substring(chars)];
                    }
                    if (color != "reset") {
                        text = color.reduce((txt, col)=>txt[col], text);
                    }
                    return out + text;
                }, "");
            }
            return line;
        }).join("\n");
    }
    console.log(logo + "\n");
}
printLogo();