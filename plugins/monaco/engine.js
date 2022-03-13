/*\
title: $:/plugins/smilyorg/monaco/engine.js
type: application/javascript
module-type: library

Text editor engine based on a Monaco instance

\*/
(function(){

    /*jslint browser: true */
    /*global $tw: false */
    "use strict";
    
    const HEIGHT_VALUE_TITLE = "$:/config/TextEditor/EditorHeight/Height";

    /**
     * Executes and returns the monaco loader based on the code contained
     * in the provided tiddler.
     * @param {string} title loader.js tiddler title 
     * @returns context object containing `require` and `define` used to load monaco
     */
    function getLoader(title) {
        const context = {};
		const code = $tw.wiki.getTiddlerText(title, "");
        new Function(code).call(context);
		return context;
	}

    if($tw.browser && !window.monaco) {
        // As monaco is loaded asynchronously, this is used to notify any pending
        // editors of the monaco initialization.
        window.monacoInit = new EventTarget();

        // Create a monaco loader, which is required as the TiddlyWiki commonjs
        // implementation is not sufficient
        const context = getLoader("$:/plugins/smilyorg/monaco/lib/loader.js");
        context.require.config({
            paths: {
                // This can be used to load files locally for a nodejs server
                // vs: "files/vs"
                vs: "https://unpkg.com/monaco-editor@0.32.1/min/vs"
            }
        });
        
        // Quick hack to make the monaco loader implementation work,
        // it might conflict with other plugins/code, but for vanilla TiddlyWiki
        // it seems to work fine.
        window.define = context.define;

        // Load the monaco editor - all the other assets are defined and loaded
        // as a result of this require and some also on-the-fly (for e.g. language support)
        context.require(["vs/editor/editor.main"], function() {
            window.monacoInit.dispatchEvent(new Event("ready"));
            
            // Run all monaco plugins
            const modules = $tw.modules.types["monaco"];
            const req = Object.getOwnPropertyNames(modules);
            if (req) {
                if (Array.isArray(req)) {
                    for (const r of req) {
                        require(r);
                    }
                } else {
                    require(req);
                }
            }
        });
    }
    
    function MonacoEngine(options) {
        options = options || {};
        
        this.widget = options.widget;
        this.value = options.value;
        this.parentNode = options.parentNode;
        this.initial = {
            type: options.type,
            value: options.value,
        }
        
        this.domNode = this.widget.document.createElement("div");
        
        let className = "tw-monaco-editor-wrapper";
        if (this.widget.editClass) {
            className += " " + this.widget.editClass;
        }
        this.domNode.className = className;

        this.parentNode.insertBefore(this.domNode, options.nextSibling);
        this.widget.domNodes.push(this.domNode);

        if (window.monaco) {
            this.initMonaco();
        } else {
            this.spinner = this.widget.document.createElement("div");
            this.spinner.className = "tw-monaco-editor-loader";
            this.domNode.appendChild(this.spinner);
            window.monacoInit.addEventListener("ready", this.initMonaco.bind(this))
        }
    }
    
    MonacoEngine.prototype.initMonaco = function() {
        if (this.editor) {
            throw new Error("Monaco already initialized");
        }

        if (this.spinner) {
            this.domNode.removeChild(this.spinner);
            this.spinner = null;
        }

        this.monaco = window.monaco;
        this.editor = this.monaco.editor.create(this.domNode, {
            model: null,
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            scrollbar: {
                alwaysConsumeMouseWheel: false,
            },
            quickSuggestions: false,
            // 'semanticHighlighting.enabled': true
        });

        this.addObserver();
        
        // Apply initial text/type
        if (this.initial) {
            this.updateModel(this.initial.value, this.initial.type);
            this.initial = null;
            this.fixHeight();
        }

        const model = this.editor.getModel();
        model.onDidChangeContent(() => {
            this.widget.saveChanges(this.editor.getValue());
        })
        // Uncomment for easier debugging of the editor - `m` will
        // be the monaco editor instance in the browser console.
        // window.m = this.editor;
    };

    /**
     * Adds mutation observers to detect when the editor node has detached from
     * the browser DOM to dispose of the attached editor resources.
     * 
     * If Monaco isn't explicitly disposed, it seems to lead to a memory leak of
     * ~5MB every time a new editor is allocated. This can happen more often than
     * expected (e.g. toggling preview or just going into and out of edit mode).
     * 
     * This is a workaround of TiddlyWiki not having a widget destructor,
     * see https://github.com/Jermolene/TiddlyWiki5/pull/2280
     * 
     */
    MonacoEngine.prototype.addObserver = function() {
        if (this.observer) this.removeObserver();
        this.observer = new MutationObserver(this.onMutation.bind(this));
        let node = this.parentNode;
        while (node != null) {
            if (node.classList && (
                node.classList.contains("tc-reveal") || 
                node.classList.contains("tc-tiddler-frame")
            )) {
                this.observer.observe(node.parentNode, {
                    childList: true,
                })
            }
            node = node.parentNode;
        }
    }

    /**
     * Removes the mutation observer added by `addObserver()`
     */
    MonacoEngine.prototype.removeObserver = function() {
        if (!this.observer) return;
        this.observer.disconnect();
        this.observer = null;
    }
    
    /**
     * Dispose any attached resources or handlers to avoid leaking resources.
     */
    MonacoEngine.prototype.dispose = function() {
        this.removeObserver();
        this.editor.getModel().dispose();
        this.editor.dispose();
        this.editor = null;
        this.monaco = null;
        this.parentNode = null;
        this.domNode = null;
        this.widget = null;
    }

    /**
     * This gets called every time any DOM changes are made to the tiddler
     * and/or the tiddler parent (e.g. story list), so it is crucial that
     * it does not contain a lot of logic.
     */
    MonacoEngine.prototype.onMutation = function() {
        // Checking `isConnected` seems like the simplest and fastest way
        // of seeing if the editor node is still part of the DOM tree.
        if (!this.parentNode.isConnected) {
            this.dispose();
        }
    }

    /**
     * Update the editor model with the provided text and language type.
     * 
     * @param {string} text The text contents to set for the editor.
     * @param {string} type The MIME type of the language to apply to the editor.
     */
    MonacoEngine.prototype.updateModel = function(text, type) {
        // Map the MIME types to the Monaco language IDs.
        // TODO: convert to a data tiddler?
        let languageId = "plaintext";
        switch (type) {
            case "text/html": languageId = "html"; break;
            case "application/javascript": languageId = "javascript"; break;
            case "text/x-markdown": languageId = "markdown"; break;
            case "text/vnd.tiddlywiki": languageId = "tiddlywiki-wikitext"; break;
        }
        const model = this.editor.getModel();
        // Replace the whole model when changing the language
        if (!model || model.getLanguageId() != languageId) {
            const newModel = this.monaco.editor.createModel(
                text,
                languageId
            );
            this.editor.setModel(newModel);
            if (model) model.dispose();
        // Only update the text if it's different as TiddlyWiki
        // often sets text that was updated and we don't want
        // to mess up the internal state of the editor (e.g. cursor position)
        // if the text is the same. 
        } else if (model.getValue() != text) {
            model.setValue(text);
        }
    }
    
    /*
    Set the text of the engine if it doesn't currently have focus
    */
    MonacoEngine.prototype.setText = function(text,type) {
        this.updateModel(text, type);
    };
    
    /*
    Update the DomNode with the new text
    */
    MonacoEngine.prototype.updateDomNodeText = function(text) {
        // TODO: not sure what this should do, doesn't seem to get called
    };
    
    /*
    Get the text of the engine
    */
    MonacoEngine.prototype.getText = function() {
        return this.editor.getValue();
    };
    
    /*
    Fix the height of textarea to fit content
    */
    MonacoEngine.prototype.fixHeight = function() {
        if (!this.editor) return;

        const layout = this.editor.getLayoutInfo();

        let height;
        if (this.widget.editAutoHeight) {
            height = this.editor.getContentHeight();
        } else {
            height = parseInt(this.widget.wiki.getTiddlerText(HEIGHT_VALUE_TITLE, "400px"), 10);
        }

        height = Math.max(height, 40);
        this.editor.layout({
            width: layout.width,
            height,
        });
    };
    
    /*
    Focus the engine node
    */
    MonacoEngine.prototype.focus  = function() {
        // TODO: if/when is this called and do we want to focus the editor?
    }
    
    /*
    Create a blank structure representing a text operation
    */
    MonacoEngine.prototype.createTextOperation = function() {
        const selection = this.editor.getSelection();
        const model = this.editor.getModel();
        var operation = {
            text: model.getValue(),
            selStart: selection && model.getOffsetAt(selection.getStartPosition()),
            selEnd: selection && model.getOffsetAt(selection.getEndPosition()),
            cutStart: null,
            cutEnd: null,
            replacement: null,
            newSelStart: null,
            newSelEnd: null
        };
        operation.selection = operation.text.substring(operation.selStart,operation.selEnd);
        return operation;
    };
    
    /*
    Execute a text operation
    */
    MonacoEngine.prototype.executeTextOperation = function(operation) {
        const model = this.editor.getModel();
        const selections = this.editor.getSelections();
        const startPos = model.getPositionAt(operation.cutStart);
        const endPos = model.getPositionAt(operation.cutEnd);
        model.pushEditOperations(
            selections,
            [{
                text: operation.replacement,
                range: {
                    startColumn: startPos.column,
                    startLineNumber: startPos.lineNumber,
                    endColumn: endPos.column,
                    endLineNumber: endPos.lineNumber,
                },
                forceMoveMarkers: true,
            }]
        );
        return model.getValue();
    };
    
    exports.MonacoEngine = $tw.browser ? MonacoEngine : require("$:/core/modules/editor/engines/simple.js").SimpleEngine;
    
    })();
    