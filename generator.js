window.generateLUA = function(state) {
	// Helpers
	const safeLua = (str) => {
		if (!str) return "";
		// Escape backslashes first, then double quotes, then newlines
		return String(str)
			.replace(/\\/g, '\\\\')
			.replace(/"/g, '\\"')
			.replace(/\n/g, '\\n');
	};

	let name = safeLua(state.name || "Default NPC");
	
	// Header
	let lua = `local internalNpcName = "${name}"\n`;
	lua += `local npcType = Game.createNpcType(internalNpcName)\n`;
	lua += `local npcConfig = {}\n\n`;

	lua += `npcConfig.name = internalNpcName\n`;
	lua += `npcConfig.description = internalNpcName\n\n`;

	lua += `npcConfig.health = 100\n`;
	lua += `npcConfig.maxHealth = 100\n`;
	lua += `npcConfig.walkInterval = ${parseInt(state.walkInterval) || 2000}\n`;
	lua += `npcConfig.walkRadius = ${parseInt(state.walkRadius) || 2}\n\n`;

	// Outfit
	lua += `npcConfig.outfit = {\n`;
	lua += `\tlookType = ${state.outfit.lookType || 128},\n`;
	lua += `\tlookHead = ${state.outfit.lookHead || 0},\n`;
	lua += `\tlookBody = ${state.outfit.lookBody || 0},\n`;
	lua += `\tlookLegs = ${state.outfit.lookLegs || 0},\n`;
	lua += `\tlookFeet = ${state.outfit.lookFeet || 0},\n`;
	lua += `}\n\n`;

	// Flags
	lua += `npcConfig.flags = {\n`;
	lua += `\tfloorchange = false,\n`;
	lua += `}\n\n`;

	// Handlers Init
	lua += `local keywordHandler = KeywordHandler:new()\n`;
	lua += `local npcHandler = NpcHandler:new(keywordHandler)\n\n`;

	// Callbacks
	lua += `npcType.onThink = function(npc, interval)\n\tnpcHandler:onThink(npc, interval)\nend\n\n`;
	lua += `npcType.onAppear = function(npc, creature)\n\tnpcHandler:onAppear(npc, creature)\nend\n\n`;
	lua += `npcType.onDisappear = function(npc, creature)\n\tnpcHandler:onDisappear(npc, creature)\nend\n\n`;
	lua += `npcType.onMove = function(npc, creature, fromPosition, toPosition)\n\tnpcHandler:onMove(npc, creature, fromPosition, toPosition)\nend\n\n`;
	lua += `npcType.onSay = function(npc, creature, type, message)\n\tnpcHandler:onSay(npc, creature, type, message)\nend\n\n`;
	lua += `npcType.onCloseChannel = function(npc, creature)\n\tnpcHandler:onCloseChannel(npc, creature)\nend\n\n`;

	// Messages
	lua += `npcHandler:setMessage(MESSAGE_GREET, "${safeLua(state.dialogue.greet) || 'Hello |PLAYERNAME|.'}")\n`;
	lua += `npcHandler:setMessage(MESSAGE_FAREWELL, "${safeLua(state.dialogue.farewell) || 'Farewell.'}")\n`;
	lua += `npcHandler:setMessage(MESSAGE_WALKAWAY, "${safeLua(state.dialogue.walkaway) || 'How rude!'}")\n`;
	lua += `npcHandler:setMessage(MESSAGE_SENDTRADE, "Sure.")\n\n`;

	// Keywords
	if (state.keywords && state.keywords.length > 0) {
		state.keywords.forEach(kw => {
			// Format trigger as { "name" } and response as double quoted string
			let safeResponse = safeLua(kw.response);
			lua += `keywordHandler:addKeyword({ "${safeLua(kw.trigger)}" }, StdModule.say, { npcHandler = npcHandler, text = "${safeResponse}" })\n`;
		});
		lua += `\n`;
	}

	lua += `npcHandler:addModule(FocusModule:new(), npcConfig.name, true, true, true)\n\n`;

	// Shop
	if (state.tradeItems && state.tradeItems.length > 0) {
		lua += `npcConfig.shop = {\n`;
		state.tradeItems.forEach(item => {
			let buyStr = item.buy > 0 ? `, buy = ${item.buy}` : '';
			let sellStr = item.sell > 0 ? `, sell = ${item.sell}` : '';
			lua += `\t{ itemName = "${safeLua(item.name)}", clientId = ${item.id}${buyStr}${sellStr} },\n`;
		});
		lua += `}\n`;
		
		lua += `-- On buy npc shop message\n`;
		lua += `npcType.onBuyItem = function(npc, player, itemId, subType, amount, ignore, inBackpacks, totalCost)\n`;
		lua += `\tnpc:sellItem(player, itemId, amount, subType, 0, ignore, inBackpacks)\n`;
		lua += `end\n`;
		
		lua += `-- On sell npc shop message\n`;
		lua += `npcType.onSellItem = function(npc, player, itemId, subtype, amount, ignore, name, totalCost)\n`;
		lua += `\tplayer:sendTextMessage(MESSAGE_TRADE, string.format("Sold %ix %s for %i gold.", amount, name, totalCost))\n`;
		lua += `end\n`;
		
		lua += `-- On check npc shop message (look item)\n`;
		lua += `npcType.onCheckItem = function(npc, player, clientId, subType) end\n\n`;
	}

	lua += `npcType:register(npcConfig)\n`;
	
	return lua;
};

(function () {
	const safeLuaStr = (str) => {
		if (!str) return '';
		return String(str)
			.replace(/\\/g, '\\\\')
			.replace(/"/g, '\\"')
			.replace(/\n/g, '\\n');
	};

	const classicItemLabel = (name) => (name || 'item').toLowerCase().replace(/'/g, "\\'");
	const classicKeywordTrigger = (str) => String(str || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");

	const normalizeNewlines = (text) => String(text || '').replace(/\r\n/g, '\n');

	const escapeXmlAttr = (str) => String(str || '')
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');

	function skipBalancedStatement(lines, startIdx) {
		var depth = 0;
		var started = false;
		for (var i = startIdx; i < lines.length; i++) {
			var line = lines[i];
			for (var c = 0; c < line.length; c++) {
				if (line[c] === '(') { depth++; started = true; }
				else if (line[c] === ')') depth--;
			}
			if (started && depth <= 0) return i + 1;
		}
		return startIdx + 1;
	}

	function skipFunctionBlock(lines, startIdx) {
		var fnDepth = 0;
		for (var n = startIdx; n < lines.length; n++) {
			var trimmed = lines[n].trim();
			if (/= function\s*\(/.test(trimmed) || /^function\b/.test(trimmed)) fnDepth++;
			if (/\bend\b/.test(trimmed)) {
				fnDepth--;
				if (fnDepth <= 0) return n + 1;
			}
		}
		return startIdx + 1;
	}

	function isClassicManagedLine(trimmed) {
		return /^keywordHandler:addKeyword\s*\(/.test(trimmed) ||
			/^shopModule:addBuyableItem\s*\(/.test(trimmed) ||
			/^shopModule:addSellableItem\s*\(/.test(trimmed) ||
			/^local shopModule = ShopModule:new\(\)/.test(trimmed) ||
			/^npcHandler:addModule\(shopModule\)/.test(trimmed);
	}

	function buildClassicShopLines(state) {
		var lines = [];
		if (!state.tradeItems || !state.tradeItems.length) return lines;
		lines.push('local shopModule = ShopModule:new()');
		lines.push('npcHandler:addModule(shopModule)');
		lines.push('');
		state.tradeItems.forEach(function (item) {
			var label = classicItemLabel(item.name);
			var id = parseInt(item.id, 10) || 0;
			if (item.buy > 0) {
				lines.push("shopModule:addBuyableItem({'" + label + "'}, " + id + ', ' + parseInt(item.buy, 10) + ')');
			}
			if (item.sell > 0) {
				lines.push("shopModule:addSellableItem({'" + label + "'}, " + id + ', ' + parseInt(item.sell, 10) + ')');
			}
		});
		if (lines[lines.length - 1] !== '') lines.push('');
		return lines;
	}

	function buildClassicKeywordLines(state) {
		var lines = [];
		(state.keywords || []).forEach(function (kw) {
			lines.push("keywordHandler:addKeyword({'" + classicKeywordTrigger(kw.trigger) + "'}, StdModule.say, {npcHandler = npcHandler, onlyFocus = true, text = \"" + safeLuaStr(kw.response) + '"})');
		});
		if (lines.length) lines.push('');
		return lines;
	}

	function findClassicInsertIndex(lines) {
		for (var i = 0; i < lines.length; i++) {
			var t = lines[i].trim();
			if (/^npcHandler:setCallback\(/.test(t) || /^npcHandler:addModule\(FocusModule/.test(t)) {
				return i;
			}
		}
		return lines.length;
	}

	window.patchClassicScript = function (state, existingSource) {
		if (!existingSource || !String(existingSource).trim()) {
			return window.generateClassicScript(state, null);
		}

		var lines = normalizeNewlines(existingSource).split('\n');
		var kept = [];
		var i = 0;
		while (i < lines.length) {
			var trimmed = lines[i].trim();
			if (isClassicManagedLine(trimmed)) {
				i = skipBalancedStatement(lines, i);
				continue;
			}
			kept.push(lines[i]);
			i++;
		}

		var insert = buildClassicShopLines(state).concat(buildClassicKeywordLines(state));
		var insertAt = findClassicInsertIndex(kept);
		if (insert.length) {
			Array.prototype.splice.apply(kept, [insertAt, 0].concat(insert));
		}

		return kept.join('\n').replace(/\n{3,}/g, '\n\n');
	};

	function replaceLuaAssignment(source, key, valueLine) {
		var re = new RegExp('^\\s*' + key.replace(/\./g, '\\.') + '\\s*=.*$', 'm');
		if (re.test(source)) return source.replace(re, valueLine);
		return source;
	}

	function replaceBracedAssignment(source, key, innerLines) {
		var re = new RegExp('(' + key.replace(/\./g, '\\.') + '\\s*=\\s*)\\{', 'm');
		var m = source.match(re);
		if (!m) return source;
		var start = m.index + m[0].length - 1;
		var depth = 0;
		var end = start;
		for (var i = start; i < source.length; i++) {
			if (source[i] === '{') depth++;
			else if (source[i] === '}') {
				depth--;
				if (depth === 0) { end = i; break; }
			}
		}
		var block = key + ' = {\n' + innerLines + '\n}';
		return source.slice(0, m.index) + block + source.slice(end + 1);
	}

	function replaceSetMessage(source, constant, message) {
		var re = new RegExp('npcHandler:setMessage\\(\\s*' + constant + '\\s*,\\s*"((?:[^"\\\\]|\\\\.)*)"\\s*\\)', 'm');
		if (re.test(source)) {
			return source.replace(re, 'npcHandler:setMessage(' + constant + ', "' + safeLuaStr(message) + '")');
		}
		re = new RegExp("npcHandler:setMessage\\(\\s*" + constant + "\\s*,\\s*'((?:[^'\\\\]|\\\\.)*)'\\s*\\)", 'm');
		if (re.test(source)) {
			return source.replace(re, 'npcHandler:setMessage(' + constant + ', "' + safeLuaStr(message) + '")');
		}
		return source;
	}

	function stripRevscriptManagedBlocks(lines) {
		var kept = [];
		var i = 0;
		while (i < lines.length) {
			var trimmed = lines[i].trim();
			if (/^keywordHandler:addKeyword\s*\(/.test(trimmed)) {
				i = skipBalancedStatement(lines, i);
				continue;
			}
			if (/^npcConfig\.shop\s*=/.test(trimmed)) {
				i = skipBalancedStatement(lines, i);
				continue;
			}
			if (/^npcType\.onBuyItem\s*=/.test(trimmed) || /^npcType\.onSellItem\s*=/.test(trimmed) || /^npcType\.onCheckItem\s*=/.test(trimmed)) {
				i = skipFunctionBlock(lines, i);
				continue;
			}
			kept.push(lines[i]);
			i++;
		}
		return kept;
	}

	function buildRevscriptKeywordLines(state) {
		var lines = [];
		(state.keywords || []).forEach(function (kw) {
			lines.push('keywordHandler:addKeyword({ "' + safeLuaStr(kw.trigger) + '" }, StdModule.say, { npcHandler = npcHandler, text = "' + safeLuaStr(kw.response) + '" })');
		});
		if (lines.length) lines.push('');
		return lines;
	}

	function buildRevscriptShopBlock(state) {
		if (!state.tradeItems || !state.tradeItems.length) return [];
		var lines = ['npcConfig.shop = {'];
		state.tradeItems.forEach(function (item) {
			var buyStr = item.buy > 0 ? ', buy = ' + parseInt(item.buy, 10) : '';
			var sellStr = item.sell > 0 ? ', sell = ' + parseInt(item.sell, 10) : '';
			lines.push('\t{ itemName = "' + safeLuaStr(item.name) + '", clientId = ' + item.id + buyStr + sellStr + ' },');
		});
		lines.push('}');
		lines.push('-- On buy npc shop message');
		lines.push('npcType.onBuyItem = function(npc, player, itemId, subType, amount, ignore, inBackpacks, totalCost)');
		lines.push('\tnpc:sellItem(player, itemId, amount, subType, 0, ignore, inBackpacks)');
		lines.push('end');
		lines.push('-- On sell npc shop message');
		lines.push('npcType.onSellItem = function(npc, player, itemId, subtype, amount, ignore, name, totalCost)');
		lines.push('\tplayer:sendTextMessage(MESSAGE_TRADE, string.format("Sold %ix %s for %i gold.", amount, name, totalCost))');
		lines.push('end');
		lines.push('-- On check npc shop message (look item)');
		lines.push('npcType.onCheckItem = function(npc, player, clientId, subType) end');
		lines.push('');
		return lines;
	}

	function findRevscriptInsertIndex(lines) {
		for (var i = 0; i < lines.length; i++) {
			var t = lines[i].trim();
			if (/^npcHandler:addModule\(FocusModule/.test(t) || /^npcType:register\(/.test(t)) {
				return i;
			}
		}
		return lines.length;
	}

	window.patchRevscriptLua = function (state, existingSource) {
		if (!existingSource || !String(existingSource).trim()) {
			return window.generateLUA(state);
		}

		var source = normalizeNewlines(existingSource);
		var name = safeLuaStr(state.name || 'Default NPC');
		var o = state.outfit || {};
		var d = state.dialogue || {};

		source = source.replace(/local internalNpcName\s*=\s*"((?:[^"\\]|\\.)*)"/, 'local internalNpcName = "' + name + '"');
		source = source.replace(/local internalNpcName\s*=\s*'((?:[^'\\]|\\.)*)'/, 'local internalNpcName = "' + name + '"');
		source = replaceLuaAssignment(source, 'npcConfig.name', 'npcConfig.name = "' + name + '"');
		source = replaceLuaAssignment(source, 'npcConfig.walkInterval', 'npcConfig.walkInterval = ' + (parseInt(state.walkInterval, 10) || 2000));
		source = replaceLuaAssignment(source, 'npcConfig.walkRadius', 'npcConfig.walkRadius = ' + (parseInt(state.walkRadius, 10) || 2));

		var outfitInner =
			'\tlookType = ' + (o.lookType || 128) + ',\n' +
			'\tlookHead = ' + (o.lookHead || 0) + ',\n' +
			'\tlookBody = ' + (o.lookBody || 0) + ',\n' +
			'\tlookLegs = ' + (o.lookLegs || 0) + ',\n' +
			'\tlookFeet = ' + (o.lookFeet || 0) + ',';
		if (/npcConfig\.outfit\s*=\s*\{/.test(source)) {
			source = replaceBracedAssignment(source, 'npcConfig.outfit', outfitInner);
		}

		source = replaceSetMessage(source, 'MESSAGE_GREET', d.greet || 'Hello |PLAYERNAME|.');
		source = replaceSetMessage(source, 'MESSAGE_FAREWELL', d.farewell || 'Farewell.');
		source = replaceSetMessage(source, 'MESSAGE_WALKAWAY', d.walkaway || 'How rude!');

		var lines = stripRevscriptManagedBlocks(source.split('\n'));
		var insert = buildRevscriptKeywordLines(state).concat(buildRevscriptShopBlock(state));
		var insertAt = findRevscriptInsertIndex(lines);
		if (insert.length) {
			Array.prototype.splice.apply(lines, [insertAt, 0].concat(insert));
		}

		return lines.join('\n').replace(/\n{3,}/g, '\n\n');
	};

	function setXmlAttrOnTag(text, tagName, attr, value) {
		if (value == null || value === '') return text;
		var escaped = escapeXmlAttr(value);
		var tagRe = new RegExp('(<' + tagName + '\\b[^>]*\\s' + attr + '\\s*=\\s*["\'])([^"\']*)(["\'])', 'i');
		if (tagRe.test(text)) return text.replace(tagRe, '$1' + escaped + '$3');
		var openRe = new RegExp('(<' + tagName + '\\b)([^>]*)(>)', 'i');
		return text.replace(openRe, '$1$2 ' + attr + '="' + escaped + '"$3');
	}

	function setNpcParameter(text, key, value) {
		var escaped = escapeXmlAttr(value);
		var re = new RegExp('(<parameter\\s+key="' + key + '"\\s+value=")([^"]*)(")', 'i');
		if (re.test(text)) return text.replace(re, '$1' + escaped + '$3');
		re = new RegExp("(<parameter\\s+key='" + key + "'\\s+value=')([^']*)(')", 'i');
		if (re.test(text)) return text.replace(re, '$1' + escaped + '$3');
		return text.replace(/<\/parameters>/i, '\t\t<parameter key="' + key + '" value="' + escaped + '"/>\n\t</parameters>');
	}

	window.patchNpcXml = function (state, existingXml) {
		if (!existingXml || !String(existingXml).trim()) {
			return window.generateNpcXml(state, existingXml);
		}

		var text = normalizeNewlines(existingXml);
		var o = state.outfit || {};
		var d = state.dialogue || {};

		text = text.replace(/(<npc\b[^>]*\sname\s*=\s*["'])([^"']*)(["'])/i, '$1' + escapeXmlAttr(state.name || '') + '$3');

		if (state.walkInterval != null && !isNaN(state.walkInterval)) {
			text = setXmlAttrOnTag(text, 'npc', 'walkinterval', String(state.walkInterval));
		}
		if (state.walkRadius != null && !isNaN(state.walkRadius)) {
			text = setXmlAttrOnTag(text, 'npc', 'walkradius', String(state.walkRadius));
		}

		text = setXmlAttrOnTag(text, 'look', 'type', String(o.lookType != null ? o.lookType : 128));
		text = setXmlAttrOnTag(text, 'look', 'head', String(o.lookHead != null ? o.lookHead : 0));
		text = setXmlAttrOnTag(text, 'look', 'body', String(o.lookBody != null ? o.lookBody : 0));
		text = setXmlAttrOnTag(text, 'look', 'legs', String(o.lookLegs != null ? o.lookLegs : 0));
		text = setXmlAttrOnTag(text, 'look', 'feet', String(o.lookFeet != null ? o.lookFeet : 0));

		text = setNpcParameter(text, 'message_greet', d.greet || 'Hello |PLAYERNAME|.');
		text = setNpcParameter(text, 'message_farewell', d.farewell || 'Farewell.');
		text = setNpcParameter(text, 'message_walkaway', d.walkaway || 'How rude!');

		return text;
	};
})();

// Classic TFS / XML NPC script (NpcHandler + ShopModule) — used only when no existing file
window.generateClassicScript = function (state, existingSource) {
	const safeLua = (str) => {
		if (!str) return '';
		return String(str)
			.replace(/\\/g, '\\\\')
			.replace(/"/g, '\\"')
			.replace(/\n/g, '\\n');
	};

	const classicItemLabel = (name) => (name || 'item').toLowerCase().replace(/'/g, "\\'");
	const classicKeywordTrigger = (str) => String(str || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");

	const extractVoiceBlock = (source) => {
		if (!source) return '';
		const m = source.match(/local voices\s*=\s*\{[\s\S]*?\}\s*\r?\nnpcHandler:addModule\(VoiceModule:new\(voices\)\)\s*\r?\n?/);
		return m ? m[0] + '\n' : '';
	};

	let lua = 'local keywordHandler = KeywordHandler:new()\n';
	lua += 'local npcHandler = NpcHandler:new(keywordHandler)\n';
	lua += 'NpcSystem.parseParameters(npcHandler)\n\n';
	lua += 'function onCreatureAppear(cid)              npcHandler:onCreatureAppear(cid)            end\n';
	lua += 'function onCreatureDisappear(cid)           npcHandler:onCreatureDisappear(cid)         end\n';
	lua += 'function onCreatureSay(cid, type, msg)      npcHandler:onCreatureSay(cid, type, msg)    end\n';
	lua += 'function onThink()                          npcHandler:onThink()                        end\n\n';

	lua += extractVoiceBlock(existingSource);

	if (state.tradeItems && state.tradeItems.length > 0) {
		lua += 'local shopModule = ShopModule:new()\n';
		lua += 'npcHandler:addModule(shopModule)\n\n';
		state.tradeItems.forEach((item) => {
			const label = classicItemLabel(item.name);
			const id = parseInt(item.id, 10) || 0;
			if (item.buy > 0) {
				lua += `shopModule:addBuyableItem({'${label}'}, ${id}, ${parseInt(item.buy, 10)})\n`;
			}
			if (item.sell > 0) {
				lua += `shopModule:addSellableItem({'${label}'}, ${id}, ${parseInt(item.sell, 10)})\n`;
			}
		});
		lua += '\n';
	}

	if (state.keywords && state.keywords.length > 0) {
		state.keywords.forEach((kw) => {
			lua += `keywordHandler:addKeyword({'${classicKeywordTrigger(kw.trigger)}'}, StdModule.say, {npcHandler = npcHandler, onlyFocus = true, text = "${safeLua(kw.response)}"})\n`;
		});
		lua += '\n';
	}

	lua += 'npcHandler:setCallback(CALLBACK_MESSAGE_DEFAULT, creatureSayCallback)\n';
	lua += 'npcHandler:addModule(FocusModule:new())\n';
	return lua;
};

// Patch XML NPC definition (outfit, walk, dialogue parameters)
window.generateNpcXml = function (state, existingXml) {
	if (!existingXml) return existingXml || '';

	const doc = new DOMParser().parseFromString(existingXml, 'text/xml');
	if (doc.querySelector('parsererror')) return existingXml;

	const npc = doc.querySelector('npc');
	if (!npc) return existingXml;

	const escapeXml = (str) => String(str || '')
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');

	npc.setAttribute('name', state.name || '');

	if (state.walkInterval != null && !isNaN(state.walkInterval)) {
		npc.setAttribute('walkinterval', String(state.walkInterval));
	}
	if (state.walkRadius != null && !isNaN(state.walkRadius)) {
		npc.setAttribute('walkradius', String(state.walkRadius));
	}

	let look = npc.querySelector('look');
	if (!look) {
		look = doc.createElement('look');
		const health = npc.querySelector('health');
		if (health && health.nextSibling) {
			npc.insertBefore(look, health.nextSibling);
		} else {
			npc.appendChild(look);
		}
	}

	const o = state.outfit || {};
	look.setAttribute('type', String(o.lookType != null ? o.lookType : 128));
	look.setAttribute('head', String(o.lookHead != null ? o.lookHead : 0));
	look.setAttribute('body', String(o.lookBody != null ? o.lookBody : 0));
	look.setAttribute('legs', String(o.lookLegs != null ? o.lookLegs : 0));
	look.setAttribute('feet', String(o.lookFeet != null ? o.lookFeet : 0));

	let params = npc.querySelector('parameters');
	if (!params) {
		params = doc.createElement('parameters');
		npc.appendChild(params);
	}

	const setParam = (key, value) => {
		let el = null;
		const all = params.querySelectorAll('parameter');
		for (let i = 0; i < all.length; i++) {
			if ((all[i].getAttribute('key') || '').toLowerCase() === key) {
				el = all[i];
				break;
			}
		}
		if (!el) {
			el = doc.createElement('parameter');
			el.setAttribute('key', key);
			params.appendChild(el);
		}
		el.setAttribute('value', escapeXml(value));
	};

	const d = state.dialogue || {};
	setParam('message_greet', d.greet || 'Hello |PLAYERNAME|.');
	setParam('message_farewell', d.farewell || 'Farewell.');
	setParam('message_walkaway', d.walkaway || 'How rude!');

	return new XMLSerializer().serializeToString(doc);
};
