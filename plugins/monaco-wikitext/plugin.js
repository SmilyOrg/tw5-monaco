/*\
title: $:/plugins/smilyorg/monaco-wikitext/plugin.js
type: application/javascript
module-type: monaco

TODO

\*/
(function(){

    /*jslint browser: true */
    /*global $tw: false */
    "use strict";

    const monaco = window.monaco;
    if (!monaco) {
        throw new Error("monaco not found");
    }

    const LANGUAGE_ID = "tiddlywiki-wikitext";
    monaco.languages.register({ id: LANGUAGE_ID });



    //   _______ _                         
    //  |__   __| |                        
    //     | |  | |__   ___ _ __ ___   ___ 
    //     | |  | '_ \ / _ \ '_ ` _ \ / _ \
    //     | |  | | | |  __/ | | | | |  __/
    //     |_|  |_| |_|\___|_| |_| |_|\___|
    // 

    // TODO: move to configuration tiddler?
    monaco.editor.defineTheme('tiddlywiki-wikitext', {
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
    monaco.editor.setTheme("tiddlywiki-wikitext");



    //   _    _                     
    //  | |  | |                    
    //  | |__| | _____   _____ _ __ 
    //  |  __  |/ _ \ \ / / _ \ '__|
    //  | |  | | (_) \ V /  __/ |   
    //  |_|  |_|\___/ \_/ \___|_|   
    // 
                             
    let currentHoverTiddler = null;
    monaco.editor.registerCommand("open-tiddler", () => {
        if (!currentHoverTiddler) return;
        $tw.wiki.addToStory(currentHoverTiddler);
    })

    monaco.languages.registerHoverProvider(LANGUAGE_ID, {
        provideHover(model, position, cancellation) {
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

    

    //   _    _ _       _     _ _       _     _   
    //  | |  | (_)     | |   | (_)     | |   | |  
    //  | |__| |_  __ _| |__ | |_  __ _| |__ | |_ 
    //  |  __  | |/ _` | '_ \| | |/ _` | '_ \| __|
    //  | |  | | | (_| | | | | | | (_| | | | | |_ 
    //  |_|  |_|_|\__, |_| |_|_|_|\__, |_| |_|\__|
    //             __/ |           __/ |          
    //            |___/           |___/           

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



    //    _____                      _      _   _             
    //   / ____|                    | |    | | (_)            
    //  | |     ___  _ __ ___  _ __ | | ___| |_ _  ___  _ __  
    //  | |    / _ \| '_ ` _ \| '_ \| |/ _ \ __| |/ _ \| '_ \ 
    //  | |___| (_) | | | | | | |_) | |  __/ |_| | (_) | | | |
    //   \_____\___/|_| |_| |_| .__/|_|\___|\__|_|\___/|_| |_|
    //                        | |                             
    //                        |_|                             

    const MATCH_LINK = /(\[\[)([^\|\]]*)(\|?)([^\]]*)(\]?\]?)/;
    const MATCH_TRANSCLUSION = /({{)([^}]*)(}?}?)/;

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



    //   ______                _   _                 
    //  |  ____|              | | (_)                
    //  | |__ _   _ _ __   ___| |_ _  ___  _ __  ___ 
    //  |  __| | | | '_ \ / __| __| |/ _ \| '_ \/ __|
    //  | |  | |_| | | | | (__| |_| | (_) | | | \__ \
    //  |_|   \__,_|_| |_|\___|\__|_|\___/|_| |_|___/

    /**
     * Get token type based on tree node
     * @param {object} node 
     * @returns {string} token type
     */
     function getTokenType(node) {
        if (!node) return null;
        switch (node.type) {
            case "element":
                switch (node.tag) {
                    case "h1":
                    case "h2":
                    case "h3":
                    case "h4":
                    case "h5":
                    case "h6":
                        return "header"; 
                    case "a":
                        return "link";
                }
                return `${node.type}-${node.tag}`;
        }
        return node.type;
    }

    /**
     * Get token modifiers based on tree node
     * @param {object} node 
     * @returns {string} token type
     */
    function getTokenModifiers(node) {
        if (!node) return null;
        switch (node.type) {
            case "link":
                const tiddler = $tw.wiki.getTiddler(node.attributes.to.value);
                if (!tiddler) {
                    return ["broken"];
                }
                return null;
        }
        return null;
    }

    /**
     * Extract tokens from the TiddlyWiki parser node tree,
     * applying heuristics for missing ranges.
     * 
     * @param {object} parsed TiddlyWiki parser result
     * @param {function} onToken Called for each token
     */
    function extractTokensFromTree(parsed, onToken) {
        const tree = parsed.tree;
        const stackIndex = [0];
        const stackNodes = [tree];
        let searchStackIndex = [];
        let searchStackNodes = [];
        let depth = 0;
        let lastEnd = 0;
        while (true) {
            const index = stackIndex[depth];
            const nodes = stackNodes[depth];
            // prewalk right
            stackIndex[depth]++;
            if (index >= nodes.length) {
                // walk up
                depth--;
                if (depth < 0) {
                    break;
                }
                continue;
            }

            const node = nodes[index];
            const children = node.children;

            if (children) {
                // walk down
                depth++;
                stackIndex[depth] = 0;
                stackNodes[depth] = children;
                continue
            }

            let nodeStart = node.start;
            let nodeEnd = node.end;

            // If the start position is not available, travel
            // up the tree and find the closest possible edge
            // to use as the start position of the range
            if (nodeStart === undefined) {
                let searchDepth = depth;
                for (let i = 0; i <= searchDepth; i++) {
                    searchStackIndex[i] = stackIndex[i];
                    searchStackNodes[i] = stackNodes[i];
                }
                while (true) {
                    searchStackIndex[searchDepth]--;
                    const searchIndex = searchStackIndex[searchDepth];
                    const searchNodes = searchStackNodes[searchDepth];
                    if (searchIndex < 0) {
                        searchDepth--;
                        if (searchDepth < 0) {
                            nodeStart = 0;
                            break;
                        }
                        continue;
                    }
                    const searchNode = searchNodes[searchIndex];
                    if (searchNode.end !== undefined) {
                        let ancestor = false;
                        for (let i = depth; i >= 0; i--) {
                            if (searchNode == stackNodes[i][stackIndex[i] - 1]) {
                                ancestor = true;
                                break;
                            }
                        }
                        nodeStart = ancestor ? searchNode.start : searchNode.end;
                        break;
                    }
                    if (searchNode.children?.length > 0) {
                        searchDepth++;
                        searchStackIndex[searchDepth] = 0;
                        searchStackNodes[searchDepth] = searchNode.children;
                        continue;
                    }
                }
            }

            // If the end position is not available, travel
            // down the tree and find the closest possible edge
            // to use as the end position of the range
            if (nodeEnd === undefined) {
                let searchDepth = depth;
                for (let i = 0; i <= searchDepth; i++) {
                    searchStackIndex[i] = stackIndex[i];
                    searchStackNodes[i] = stackNodes[i];
                }
                while (true) {
                    const searchIndex = searchStackIndex[searchDepth];
                    const searchNodes = searchStackNodes[searchDepth];
                    searchStackIndex[searchDepth] = searchIndex + 1;
                    if (searchIndex >= searchNodes.length) {
                        searchDepth--;
                        if (searchDepth < 0) {
                            nodeEnd = parsed.source.length;
                            break;
                        }
                        continue;
                    }
                    const searchNode = searchNodes[searchIndex];
                     if (searchNode.start !== undefined) {
                        let ancestor = false;
                        for (let i = depth; i >= 0; i--) {
                            if (searchNode == stackNodes[i][stackIndex[i] - 1]) {
                                ancestor = true;
                                break;
                            }
                        }
                        nodeEnd = ancestor ? searchNode.end : searchNode.start;
                        break;
                    }
                    if (searchNode.children?.length > 0) {
                        searchDepth++;
                        searchStackIndex[searchDepth] = 0;
                        searchStackNodes[searchDepth] = searchNode.children;
                        continue;
                    }
                }
            }
            
            // Ignore nodes without a valid range
            if (nodeStart === undefined && nodeEnd === undefined) {
                continue;
            }
        
            let tokenType = null;
            let tokenModifiers = null;

            const parent = depth == 0 ? null : stackNodes[depth - 1][stackIndex[depth - 1] - 1];
            switch (node.type) {
                case "text":
                    tokenType = getTokenType(parent);
                    tokenModifiers = getTokenModifiers(parent);
                    break;
                default:
                    tokenType = getTokenType(node);
                    tokenModifiers = getTokenModifiers(node);
            }

            if (nodeStart < lastEnd) {
                console.warn("overlapping token, last ended", lastEnd, "next starting", nodeStart, node);
            }
            
            // Ignore unknown tokens
            if (tokenType === null) {
                continue;
            }

            // See if we can find formatting characters to split them out
            // as separate tokens for de-emphasis
            let prefix = null;
            let suffix = null;
            switch (tokenType) {
                case "element-em":      prefix = "//"; suffix = "//"; break;
                case "element-u":       prefix = "__"; suffix = "__"; break;
                case "element-strong":  prefix = "''"; suffix = "''"; break;
                case "element-sup":     prefix = "^^"; suffix = "^^"; break;
                case "element-sub":     prefix = ",,"; suffix = ",,"; break;
                case "element-strike":  prefix = "~~"; suffix = "~~"; break;
                case "link":            prefix = "[["; suffix = "]]"; break;
                case "transclude":      prefix = "{{"; suffix = "}}"; break;
            }

            // Try to split out prefix and suffix
            let wrapperFound = false;
            let middleStart = nodeStart;
            let middleEnd = nodeEnd;
            const source = parsed.source;

            // Match expected prefix and suffix, both inset if the token
            // includes them, like >__text__< and outset if they wrap
            // the token, like __>text<__
            if (!prefix || !suffix) {}
            else if (
                prefix == source.substring(nodeStart, nodeStart + prefix.length) &&
                suffix == source.substring(nodeEnd - suffix.length, nodeEnd)
            ) {
                wrapperFound = true;
                middleStart = nodeStart + prefix.length;
                middleEnd = nodeEnd - suffix.length;
            } else if (
                prefix == source.substring(nodeStart - prefix.length, nodeStart) &&
                suffix == source.substring(nodeEnd, nodeEnd + suffix.length)
            ) {
                wrapperFound = true;
            }

            // Output prefix token if found
            if (wrapperFound) {
                onToken(middleStart - prefix.length, middleStart, "punctuation", ["start"]);     
            }

            // Process the middle part
            switch (tokenType) {
                case "link":
                    if (source.substring(middleStart, middleStart + node.text.length + 1) == node.text + "|") {
                        // Split the text and title as part of a [[text|title]] link
                        onToken(middleStart, middleStart + node.text.length, tokenType, tokenModifiers, node, parent);
                        onToken(middleStart + node.text.length, middleStart + node.text.length + 1, "punctuation", ["middle"], node, parent);
                        onToken(middleStart + node.text.length + 1, middleEnd, tokenType, ["title"].concat(tokenModifiers), node, parent);
                    } else {
                        onToken(middleStart, middleEnd, tokenType, tokenModifiers, node, parent);
                    }
                    break;
                default:
                    onToken(middleStart, middleEnd, tokenType, tokenModifiers, node, parent);
            }

            // Output suffix token if found
            if (wrapperFound) {
                onToken(middleEnd, middleEnd + suffix.length, "punctuation", ["end"]);     
            }

            lastEnd = nodeEnd;
        }
    }

})();
