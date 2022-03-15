/*\
title: $:/plugins/smilyorg/monaco-wikitext/highlight.js
type: application/javascript
module-type: monaco

Wikitext highlight support

\*/
(function(){
    "use strict";

    const { monaco } = require("$:/plugins/smilyorg/monaco/monaco.js");
    const { LANGUAGE_ID } = require("$:/plugins/smilyorg/monaco-wikitext/language.js");
    const { extractTokensFromTree } = require("$:/plugins/smilyorg/monaco-wikitext/parser.js");

    class State {
        clone() {
            return this;
        }
        equals(state) {
            return true;
        }
    }

    monaco.languages.setTokensProvider(LANGUAGE_ID, {
        getInitialState() {
            return new State();
        },
        tokenize(line, state) {
            const parsed = $tw.wiki.parseText("text/vnd.tiddlywiki", line);
            const tokens = [];
            let prevEnd = 0;
            extractTokensFromTree(parsed, (start, end, tokenType, tokenModifiers) => {
                if (prevEnd != start) {
                    tokens.push({
                        startIndex: prevEnd,
                        scopes: "unknown"
                    });
                }
                let scopes = tokenType;
                if (tokenModifiers) {
                    scopes += `.${tokenModifiers.join(".")}`;
                }
                tokens.push({
                    startIndex: start,
                    scopes: scopes,
                })
                prevEnd = end;
            })
            return {
                tokens: tokens,
                endState: state,
            }
        }
    })
    
})();
