/*\
title: $:/plugins/smilyorg/monaco-wikitext/completion.js
type: application/javascript
module-type: monaco

Wikitext completion support

\*/
(function(){
    "use strict";

    const { monaco } = require("$:/plugins/smilyorg/monaco/monaco.js");
    const { LANGUAGE_ID } = require("$:/plugins/smilyorg/monaco-wikitext/language.js");
    
    const MATCH_LINK = /(\[\[)([^\|\]]*)(\|?)([^\]]*)(\]?\]?)/;
    const MATCH_TRANSCLUSION = /({{)([^}]*)(}?}?)/;

    monaco.languages.registerCompletionItemProvider(LANGUAGE_ID, {
        triggerCharacters: ["[", "|", "{"],
        resolveCompletionItem(item) {
            const title = item.label;
            const tiddler = $tw.wiki.getTiddler(title);
            if (!tiddler) {
                return null;
            }
            let source = tiddler.fields.text;
            if (!source) {
                return null;
            }
            const maxChars = 1000;
            if (source.length > maxChars) {
                source = source.substr(0, maxChars);
            }
            const html = $tw.wiki.renderText("text/html", tiddler.fields.type, source);
            if (!html) {
                return null;
            }
            return {
                documentation: {
                    isTrusted: true,
                    supportHtml: true,
                    value: html,
                },
            }
        },
        provideCompletionItems(model, position, context) {
            const maxChars = 1000;
            const range = {
                startLineNumber: position.lineNumber,
                startColumn: Math.max(1, position.column - maxChars),
                endLineNumber: position.lineNumber,
                endColumn: position.column + maxChars,
            };
            const text = model.getValueInRange(range);
            const textPos = position.column - range.startColumn;

            let linkStart = findNearestDoubleChar(text, textPos, "[");
            if (context.triggerKind == monaco.languages.CompletionTriggerKind.TriggerCharacter) {
                switch (context.triggerCharacter) {
                    case "[":
                        // When triggered by [, ignore if not double [
                        if (linkStart == -1 || linkStart != textPos-2) {
                            return null;
                        }
                        break;
                            
                    case "|":
                        // When triggered by |, ignore if not inside of link
                        if (linkStart == -1) {
                            return null;
                        }
                        break;
                }
            }
            
            if (linkStart != -1) {
                const linkSuggestions = getLinkSuggestions(text, linkStart, textPos, range);
                if (linkSuggestions) {
                    return {
                        incomplete: true,
                        suggestions: linkSuggestions,
                    };
                }
            }
            
            let transStart = findNearestDoubleChar(text, textPos, "{");
            // When triggered by {, ignore if not double {
            if (
                context.triggerKind == monaco.languages.CompletionTriggerKind.TriggerCharacter &&
                context.triggerCharacter == "{" &&
                (transStart == -1 || transStart != textPos-2)
            ) {
                return null;
            }
            if (transStart != -1) {
                const transSuggestions = getTransclusionSuggestions(text, transStart, textPos, range);
                if (transSuggestions) {
                    return {
                        incomplete: true,
                        suggestions: transSuggestions,
                    };
                }
            }
            
            return { suggestions: getSuggestionsFromAllTiddlers() };
        }
    });

    function getSuggestionsFromAllTiddlers() {
        const suggestions = [];
        const titles = $tw.wiki.getTiddlers();
        for (let i = 0; i < titles.length; i++) {
            const title = titles[i];
            suggestions.push({
                kind: monaco.languages.CompletionItemKind.Field,
                label: title,
                insertText: `[[${title}]] `,
            })
        }
        return suggestions;
    }

    function findNearestDoubleChar(text, start, char) {
        for (let i = start; i >= 1; i--) {
            if (text[i - 1] == char && text[i] == char) {
                return i - 1;
            }
        }
        return -1;
    }

    function getLinkSuggestions(text, start, cursor, range) {
        const contents = text.substr(start);
        const link = MATCH_LINK.exec(contents);
        if (!link || link.length == 0) {
            return null;
        }
        
        const end = start + link[0].length;
        if (cursor > end) {
            return null;
        }

        let display = link[2];
        let pipe = link[3];
        let title = link[4];
        if (!title && !pipe) {
            title = display;
            display = "";
        }
        let titles = $tw.wiki.search(title, {
            field: "title"
        });
        
        const suggestions = [];
        for (let i = 0; i < titles.length; i++) {
            const title = titles[i];
            const systemTiddler = title.startsWith("$:/");
            if (systemTiddler) {
                continue;
            }
            const insertText = `[[${display}${pipe}${title}]]`;
            suggestions.push({
                kind: monaco.languages.CompletionItemKind.Field,
                label: title,
                filterText: insertText,
                range: {
                    startLineNumber: range.startLineNumber,
                    endLineNumber: range.endLineNumber,
                    startColumn: range.startColumn + start,
                    endColumn: range.startColumn + end,
                },
                insertText: insertText,
            })
        }
        
        return suggestions;
    }
    
    function getTransclusionSuggestions(text, start, cursor, range) {
        const contents = text.substr(start);
        const trans = MATCH_TRANSCLUSION.exec(contents);
        console.log(MATCH_TRANSCLUSION, text, start, contents);
        if (!trans || trans.length == 0) {
            return null;
        }
        
        const end = start + trans[0].length;
        if (cursor > end) {
            return null;
        }

        let title = trans[2];
        let titles = $tw.wiki.search(title, {
            field: "title"
        });
        
        const suggestions = [];
        for (let i = 0; i < titles.length; i++) {
            const title = titles[i];
            const systemTiddler = title.startsWith("$:/");
            if (systemTiddler) {
                continue;
            }
            const insertText = `{{${title}}}`;
            suggestions.push({
                kind: monaco.languages.CompletionItemKind.Field,
                label: title,
                filterText: insertText,
                range: {
                    startLineNumber: range.startLineNumber,
                    endLineNumber: range.endLineNumber,
                    startColumn: range.startColumn + start,
                    endColumn: range.startColumn + end,
                },
                insertText: insertText,
            })
        }
        
        return suggestions;
    }
    
})();
