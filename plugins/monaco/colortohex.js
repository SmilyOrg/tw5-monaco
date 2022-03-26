/*\
title: $:/plugins/smilyorg/monaco/colortohex.js
type: application/javascript
module-type: macro
Macro to parse CSS colors and return hex values
\*/
(function(){
    "use strict";

    const { parseCSSColor } = require("$:/core/modules/utils/dom/csscolorparser.js");

    exports.name = "colortohex";
    
    exports.params = [
        {name: "color"}
    ];
    
    exports.run = function(color) {
        const parsed = parseCSSColor(color);
        if (!parsed) {
            console.warn("Unable to parse CSS color: " + color);
            return "";
        }
        const [r, g, b, _] = parsed;
        return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`
    };
})();