/*\
title: $:/plugins/smilyorg/monaco-wikitext/parser.js
type: application/javascript
module-type: monaco

Wikitext enhanced parser support

\*/
(function(){
    "use strict";

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

    Object.assign(exports, {
        getTokenType,
        getTokenModifiers,
        extractTokensFromTree,
    });
    
})();
