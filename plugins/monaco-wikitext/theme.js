/*\
title: $:/plugins/smilyorg/monaco-wikitext/theme.js
type: application/javascript
module-type: monaco

Wikitext theme

\*/
(function(){
    "use strict";

    const { monaco } = require("$:/plugins/smilyorg/monaco/monaco.js");
    const { LANGUAGE_ID } = require("$:/plugins/smilyorg/monaco-wikitext/language.js");

    // TODO: move to configuration tiddler?
    monaco.editor.defineTheme(LANGUAGE_ID, {
        base: 'vs',
        inherit: true,
        colors: {},
        tokenColors: [],
        rules: [
            { token: 'header', foreground: '0000ff' },
            { token: 'element-u', fontStyle: 'underline' },
            { token: 'element-em', fontStyle: 'italic' },
            { token: 'element-strong', fontStyle: 'bold' },
            { token: 'element-strike', fontStyle: "strikethrough" },
            { token: 'element-div', foreground: "007700" },
            { token: 'element-a', foreground: "3e5bbf" },
            { token: 'link', foreground: "3e5bbf" },
            { token: 'link.title', foreground: "b1bce1" },
            { token: "link.broken", foreground: "ff0000" },
            { token: 'transclude', foreground: "0077ff" },
            { token: "macrocall", foreground: "007700" },
            { token: "punctuation", foreground: "d0d0d0" },
        ]
    });
    monaco.editor.setTheme(LANGUAGE_ID);
})();
