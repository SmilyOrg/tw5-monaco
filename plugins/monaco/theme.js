/*\
title: $:/plugins/smilyorg/monaco/theme.js
type: application/javascript
module-type: monaco

Monaco theming support

\*/
(function(){
    "use strict";

    const { monaco } = require("$:/plugins/smilyorg/monaco/monaco.js");
    const THEME_NAME = "custom";
    const THEME_CONFIG = "$:/config/monaco/theme";
    const THEME_TAG = "$:/tags/monaco/theme";
    
    let currentThemeTitle = null;
    let currentPaletteTitle = $tw.wiki.getTiddlerText("$:/palette");

    // Define initial theme
    setTheme($tw.wiki.getTiddlerText(THEME_CONFIG));

    // Only one monaco theme is used and then updated when needed
    // for easier bookkeeping
    monaco.editor.setTheme(THEME_NAME);

    // Listen for theme or palette changes
    $tw.hooks.addHook("th-page-refreshed", () => {
        const themeTitle = $tw.wiki.getTiddlerText(THEME_CONFIG);
        const paletteTitle = $tw.wiki.getTiddlerText("$:/palette");

        if (currentThemeTitle == themeTitle && paletteTitle == currentPaletteTitle) {
            return;
        }
        currentThemeTitle = themeTitle;
        currentPaletteTitle = paletteTitle;

        setTheme($tw.wiki.getTiddlerText(THEME_CONFIG));
	});
    
    function setTheme(themeTitle) {
        
        // Extract and parse theme JSON
        const themeJson = $tw.wiki.renderTiddler("application/json", themeTitle);
        let theme = null;
        try {
            theme = JSON.parse(themeJson);
        } catch (e) {
            console.error("Unable to set theme", themeJson, e);
            return;
        }

        if (theme.colors) {
            // Delete empty colors
            for (const key in theme.colors) {
                if (Object.hasOwnProperty.call(theme.colors, key)) {
                    const color = theme.colors[key];
                    if (!color) delete theme.colors[key];
                }
            }
        }

        if (theme.rules) {
            // Delete empty rule colors
            for (const rule of theme.rules) {
                if (rule.foreground === "") delete rule.foreground;
                if (rule.background === "") delete rule.background;
                if (rule.fontStyle === "") delete rule.fontStyle;   
            }
        }

        // Update Monaco theme
        monaco.editor.defineTheme(THEME_NAME, {
            base: 'vs',
            inherit: false,
            colors: {},
            tokenColors: [],
            rules: [],
            ...theme,
        });
    }

    function getActions() {
        const titles = $tw.wiki.getTiddlersWithTag(THEME_TAG);
        return titles.map(title => {
            const theme = $tw.wiki.getTiddler(title);
            return {
                id: `theme-set-${title}`,
                label: `Theme: ${theme.fields.name}`,
                precondition: null,
                keybindings: null,
                keybindingContext: null,
                contextMenuGroupId: null,
                contextMenuOrder: null,
                run: () => {
                    $tw.wiki.setText(THEME_CONFIG, "text", null, title);
                },
            }
        });
    }

    exports.getActions = getActions;
})();
