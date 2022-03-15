/*\
title: $:/plugins/smilyorg/monaco-wikitext/language.js
type: application/javascript
module-type: monaco

TiddlyWiki wikitext integration for Monaco

\*/
(function(){

    /*jslint browser: true */
    /*global $tw: false */
    "use strict";

    const LANGUAGE_ID = "tiddlywiki-wikitext";

    const { monaco } = require("$:/plugins/smilyorg/monaco/monaco.js");
    monaco.languages.register({ id: LANGUAGE_ID });

    exports.LANGUAGE_ID  = LANGUAGE_ID;
})();
