/*\
title: $:/plugins/smilyorg/monaco/monaco.js
type: application/javascript
module-type: library

Convenience lib to return Monaco singleton

\*/
(function(){
    "use strict";

    const monaco = window.monaco;
    if (!monaco) {
        throw new Error("monaco not found");
    }
    exports.monaco = monaco;
    
})();
