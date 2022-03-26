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
            $tw.modules.forEachModuleOfType('monaco', function (title, exportModules) {
                // Actually, no need to call require(title)
            });
        });
    }

    function MonacoEngine(options) {
        options = options || {};

        this.widget = options.widget;
        this.wiki = this.widget.wiki;
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
        this.addActions();

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

    MonacoEngine.prototype.addActions = function() {

        this.editor.addAction({
            id: "preferences-open-settings",
            label: "Preferences: Open Settings",
            precondition: null,
            keybindings: null,
            keybindingContext: null,
            contextMenuGroupId: null,
            contextMenuOrder: null,
            run: editor => {
                this.wiki.addToStory("$:/ControlPanel");
            },
        })

        const runToolbarAction = (tool, editor) => {
            const result = this.widget.invokeActionString(tool.text, this.widget);
            console.log("run", tool.title, "result", result);
        }
        for (const action of this.getToolbarActions(runToolbarAction)) {
            this.editor.addAction(action);
        }
    }

    // Chrome keycodes from https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/keyCode
    MonacoEngine.prototype.keyCodeToMonaco = function(keyCode) {
        switch (keyCode) {
            case 49: return this.monaco.KeyCode.Digit1;
            case 50: return this.monaco.KeyCode.Digit2;
            case 51: return this.monaco.KeyCode.Digit3;
            case 52: return this.monaco.KeyCode.Digit4;
            case 53: return this.monaco.KeyCode.Digit5;
            case 54: return this.monaco.KeyCode.Digit6;
            case 55: return this.monaco.KeyCode.Digit7;
            case 56: return this.monaco.KeyCode.Digit8;
            case 57: return this.monaco.KeyCode.Digit9;
            case 48: return this.monaco.KeyCode.Digit0;
            case 65: return this.monaco.KeyCode.KeyA;
            case 66: return this.monaco.KeyCode.KeyB;
            case 67: return this.monaco.KeyCode.KeyC;
            case 68: return this.monaco.KeyCode.KeyD;
            case 69: return this.monaco.KeyCode.KeyE;
            case 70: return this.monaco.KeyCode.KeyF;
            case 71: return this.monaco.KeyCode.KeyG;
            case 72: return this.monaco.KeyCode.KeyH;
            case 73: return this.monaco.KeyCode.KeyI;
            case 74: return this.monaco.KeyCode.KeyJ;
            case 75: return this.monaco.KeyCode.KeyK;
            case 76: return this.monaco.KeyCode.KeyL;
            case 77: return this.monaco.KeyCode.KeyM;
            case 78: return this.monaco.KeyCode.KeyN;
            case 79: return this.monaco.KeyCode.KeyO;
            case 80: return this.monaco.KeyCode.KeyP;
            case 81: return this.monaco.KeyCode.KeyQ;
            case 82: return this.monaco.KeyCode.KeyR;
            case 83: return this.monaco.KeyCode.KeyS;
            case 84: return this.monaco.KeyCode.KeyT;
            case 85: return this.monaco.KeyCode.KeyU;
            case 86: return this.monaco.KeyCode.KeyV;
            case 87: return this.monaco.KeyCode.KeyW;
            case 88: return this.monaco.KeyCode.KeyX;
            case 89: return this.monaco.KeyCode.KeyY;
            case 90: return this.monaco.KeyCode.KeyZ;

            case 188: return this.monaco.KeyCode.Comma;
            case 190: return this.monaco.KeyCode.Period;
            case 186: return this.monaco.KeyCode.Semicolon;
            case 222: return this.monaco.KeyCode.Quote;
            case 219: return this.monaco.KeyCode.BracketLeft;
            case 221: return this.monaco.KeyCode.BracketRight;
            case 192: return this.monaco.KeyCode.Backquote;
            case 220: return this.monaco.KeyCode.Backslash;
            case 189: return this.monaco.KeyCode.Minus;
            case 187: return this.monaco.KeyCode.Equal;

            case 0: return this.monaco.KeyCode.ContextMenu;
            case 13: return this.monaco.KeyCode.Enter;
            case 32: return this.monaco.KeyCode.Space;
            case 9: return this.monaco.KeyCode.Tab;
            case 46: return this.monaco.KeyCode.Delete;
            case 35: return this.monaco.KeyCode.End;
            case 36: return this.monaco.KeyCode.Home;
            case 45: return this.monaco.KeyCode.Insert;
            case 34: return this.monaco.KeyCode.PageDown;
            case 33: return this.monaco.KeyCode.PageUp;
            case 40: return this.monaco.KeyCode.DownArrow;
            case 37: return this.monaco.KeyCode.LeftArrow;
            case 39: return this.monaco.KeyCode.RightArrow;
            case 38: return this.monaco.KeyCode.UpArrow;
            case 27: return this.monaco.KeyCode.Escape;
            case 125: return this.monaco.KeyCode.ScrollLock;
            case 19: return this.monaco.KeyCode.PauseBreak;

            case 112: return this.monaco.KeyCode.F1;
            case 113: return this.monaco.KeyCode.F2;
            case 114: return this.monaco.KeyCode.F3;
            case 115: return this.monaco.KeyCode.F4;
            case 116: return this.monaco.KeyCode.F5;
            case 117: return this.monaco.KeyCode.F6;
            case 118: return this.monaco.KeyCode.F7;
            case 119: return this.monaco.KeyCode.F8;
            case 120: return this.monaco.KeyCode.F9;
            case 121: return this.monaco.KeyCode.F10;
            case 122: return this.monaco.KeyCode.F11;
            case 123: return this.monaco.KeyCode.F12;
            case 124: return this.monaco.KeyCode.F13;
            case 125: return this.monaco.KeyCode.F14;
            case 126: return this.monaco.KeyCode.F15;
            case 127: return this.monaco.KeyCode.F16;
            case 128: return this.monaco.KeyCode.F17;
            case 129: return this.monaco.KeyCode.F18;
            case 130: return this.monaco.KeyCode.F19;

            case 144: return this.monaco.KeyCode.NumLock;
            case 96: return this.monaco.KeyCode.Numpad0;
            case 97: return this.monaco.KeyCode.Numpad1;
            case 98: return this.monaco.KeyCode.Numpad2;
            case 99: return this.monaco.KeyCode.Numpad3;
            case 100: return this.monaco.KeyCode.Numpad4;
            case 101: return this.monaco.KeyCode.Numpad5;
            case 102: return this.monaco.KeyCode.Numpad6;
            case 103: return this.monaco.KeyCode.Numpad7;
            case 104: return this.monaco.KeyCode.Numpad8;
            case 105: return this.monaco.KeyCode.Numpad9;
            case 107: return this.monaco.KeyCode.NumpadAdd;
            case 194: return this.monaco.KeyCode.NumpadComma;
            case 110: return this.monaco.KeyCode.NumpadDecimal;
            case 111: return this.monaco.KeyCode.NumpadDivide;
            // case 13: return this.monaco.KeyCode.NumpadEnter; // Doesn't exist
            // case 12: return this.monaco.KeyCode.NumpadEqual; // Doesn't exist
            case 106: return this.monaco.KeyCode.NumpadMultiply;
            case 109: return this.monaco.KeyCode.NumpadSubtract;
        }
        return this.monaco.KeyCode.Unknown;
    }

    MonacoEngine.prototype.evaluateEditCondition = function(condition) {
        // Set targetTiddler needed for filterTiddlers
        const parent = this.widget.parentWidget;
        const prevTarget = parent.variables["targetTiddler"];
        parent.setVariable("targetTiddler", this.widget.editTitle);

        // Filter the one editTiddler used for the editor to see if it matches the condition
        const editTiddlerIterator = this.wiki.makeTiddlerIterator([this.widget.editTitle]);
        const filtered = this.wiki.filterTiddlers(condition, this.widget, editTiddlerIterator);

        // Restore original targetTiddler value if any
        if (prevTarget === undefined) {
            delete parent.variables["targetTiddler"];
        } else {
            parent.variables["targetTiddler"] = prevTarget;
        }

        // Condition evaluates to true if only the original tiddler was returned after filtering
        return filtered && filtered[0] == this.widget.editTitle;
    }

    MonacoEngine.prototype.getToolbarActions = function(run) {
        const tools = this.wiki.getTiddlersWithTag("$:/tags/EditorToolbar");
        return tools.map(toolTitle => {
            const tool = this.wiki.getTiddler(toolTitle).fields;
            const matchesCondition = this.evaluateEditCondition(tool.condition);
            if (!matchesCondition) return null;
            const description = this.wiki.renderText("text/plain", "text/vnd.tiddlywiki", tool.description);
            let keybindings = null;
            if (tool.shortcuts) {
                const keys = $tw.keyboardManager.parseKeyDescriptors(tool.shortcuts, { wiki: this.wiki });
                keybindings = keys.map(key => {
                    const code = this.keyCodeToMonaco(key.keyCode);
                    if (code == this.monaco.KeyCode.Unknown) {
                        console.warn("Unsupported keyCode", key.keyCode, "for tool", tool.title);
                        return 0;
                    }
                    let keybinding = code;
                    if (key.shiftKey) keybinding |= this.monaco.KeyMod.Shift;
                    if (key.altKey) keybinding |= this.monaco.KeyMod.Alt;
                    if (key.ctrlKey) keybinding |= this.monaco.KeyMod.CtrlCmd;
                    if (key.metaKey) keybinding |= this.monaco.KeyMod.WinCtrl;
                    return keybinding;
                });
            }
            return {
                id: toolTitle,
                label: description,
                precondition: null,
                keybindings,
                keybindingContext: null,
                contextMenuGroupId: null,
                contextMenuOrder: null,
                run: editor => run(tool, editor),
            }
        }).filter(action => !!action);
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
            height = parseInt(this.wiki.getTiddlerText(HEIGHT_VALUE_TITLE, "400px"), 10);
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
