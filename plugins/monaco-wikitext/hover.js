/*\
title: $:/plugins/smilyorg/monaco-wikitext/hover.js
type: application/javascript
module-type: monaco

Wikitext hover support

\*/
(function(){
    "use strict";

    const { monaco } = require("$:/plugins/smilyorg/monaco/monaco.js");
    const { LANGUAGE_ID } = require("$:/plugins/smilyorg/monaco-wikitext/language.js");
    const { extractTokensFromTree } = require("$:/plugins/smilyorg/monaco-wikitext/parser.js");

    let currentHoverTiddler = null;
    monaco.editor.registerCommand("open-tiddler", () => {
        if (!currentHoverTiddler) return;
        $tw.wiki.addToStory(currentHoverTiddler);
    })

    monaco.languages.registerHoverProvider(LANGUAGE_ID, {
        provideHover(model, position, _) {
            const text = model.getLineContent(position.lineNumber);
            const offset = position.column;
            const parsed = $tw.wiki.parseText("text/vnd.tiddlywiki", text);
            
            const matchingNodes = [];
            extractTokensFromTree(parsed, (start, end, tokenType, tokenModifiers, node, parent) => {
                if (offset >= start && offset <= end && node) {
                    node.start = start;
                    node.end = end;
                    node.parent = parent;
                    matchingNodes.push(node);
                }
            })
            if (matchingNodes.length == 0) {
                return null;
            }
            const node = matchingNodes[0];
            return {
                range: {
                    startLineNumber: position.lineNumber,
                    startColumn: 1 + node.start,
                    endLineNumber: position.lineNumber,
                    endColumn: 1 + node.end,
                },
                contents: getHoverContentsFromNode(node),
            }
        }
    });

    /**
     * Get hover contents based on tree node
     * @param {object} node 
     * @returns 
     */
     function getHoverContentsFromNode(node) {
        switch (node.type) {
            case "text":
                switch (node.parent.type) {
                    case "link":
                        if (node.parent.attributes.to.type == "string") {
                            const title = node.parent.attributes.to.value;
                            const html = $tw.wiki.renderTiddler("text/html", title);
                            currentHoverTiddler = title;
                            return [
                                {
                                    isTrusted: true,
                                    value: `**[${title}](command:open-tiddler)**`,
                                },
                                {
                                    isTrusted: true,
                                    supportHtml: true,
                                    value: html || "_Not found_",
                                }
                            ]
                        }
                        return null;
                }
                break;
            case "transclude":
                if (node.attributes.tiddler.type == "string") {
                    const title = node.attributes.tiddler.value;
                    const html = $tw.wiki.renderTiddler("text/html", title);
                    return [{
                        isTrusted: true,
                        supportHtml: true,
                        value: html
                    }]
                }
                break;
        }
        return null;
    }
    
})();
