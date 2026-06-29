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

// Classic TFS / XML NPC script (NpcHandler + ShopModule)
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
