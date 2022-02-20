/*\
title: $:/plugins/smilyorg/monaco/edit-monaco.js
type: application/javascript
module-type: widget

Edit-Monaco widget

\*/
(function(){

/*jslint node: true, browser: true */
/*global $tw: false */
"use strict";

var editTextWidgetFactory = require("$:/core/modules/editor/factory.js").editTextWidgetFactory,
	MonacoEngine = require("$:/plugins/smilyorg/monaco/engine.js").MonacoEngine;

exports["edit-monaco"] = editTextWidgetFactory(MonacoEngine,MonacoEngine);

})();
