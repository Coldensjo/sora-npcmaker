/*
 * parser.js — Reads NPC definitions back into editor state.
 * Supports Canary RevScript (.lua) and classic TFS/OTServ NPC XML (.xml).
 */
(function () {
    'use strict';

    var DEFAULT_DIALOGUE = {
        greet: 'Hello |PLAYERNAME|.',
        farewell: 'Farewell.',
        walkaway: 'How rude!'
    };

    function baseState() {
        return {
            name: '',
            walkInterval: null,
            walkRadius: null,
            outfit: { lookType: 128, lookHead: 0, lookBody: 0, lookLegs: 0, lookFeet: 0 },
            tradeItems: [],
            dialogue: {
                greet: DEFAULT_DIALOGUE.greet,
                farewell: DEFAULT_DIALOGUE.farewell,
                walkaway: DEFAULT_DIALOGUE.walkaway
            },
            keywords: []
        };
    }

    function unescapeLua(str) {
        if (!str) return '';
        return String(str)
            .replace(/\\n/g, '\n')
            .replace(/\\"/g, '"')
            .replace(/\\\\/g, '\\');
    }

    function matchString(source, re) {
        var m = source.match(re);
        return m ? unescapeLua(m[1]) : null;
    }

    function matchInt(source, re) {
        var m = source.match(re);
        return m ? parseInt(m[1], 10) : null;
    }

    function extractBracedBlock(source, startIndex) {
        var depth = 0;
        var started = false;
        for (var i = startIndex; i < source.length; i++) {
            var ch = source[i];
            if (ch === '{') {
                depth++;
                started = true;
            } else if (ch === '}') {
                depth--;
                if (started && depth === 0) {
                    return source.slice(startIndex + 1, i);
                }
            }
        }
        return null;
    }

    function outfitVal(block, key) {
        var r = block.match(new RegExp('\\b' + key + '\\s*=\\s*(\\d+)', 'i'));
        return r ? parseInt(r[1], 10) : null;
    }

    function applyOutfitBlock(state, block) {
        if (!block) return;
        var lookType = outfitVal(block, 'lookType');
        var lookTypeEx = outfitVal(block, 'lookTypeEx');
        state.outfit.lookType = lookType != null ? lookType : (lookTypeEx != null ? lookTypeEx : 128);
        state.outfit.lookHead = outfitVal(block, 'lookHead') || 0;
        state.outfit.lookBody = outfitVal(block, 'lookBody') || 0;
        state.outfit.lookLegs = outfitVal(block, 'lookLegs') || 0;
        state.outfit.lookFeet = outfitVal(block, 'lookFeet') || 0;
    }

    function parseParameterMessages(state, source) {
        var greet = matchString(source, /setMessage\s*\(\s*MESSAGE_GREET\s*,\s*"((?:[^"\\]|\\.)*)"/) ||
            matchString(source, /setMessage\s*\(\s*MESSAGE_GREET\s*,\s*'((?:[^'\\]|\\.)*)'/);
        var farewell = matchString(source, /setMessage\s*\(\s*MESSAGE_FAREWELL\s*,\s*"((?:[^"\\]|\\.)*)"/) ||
            matchString(source, /setMessage\s*\(\s*MESSAGE_FAREWELL\s*,\s*'((?:[^'\\]|\\.)*)'/);
        var walkaway = matchString(source, /setMessage\s*\(\s*MESSAGE_WALKAWAY\s*,\s*"((?:[^"\\]|\\.)*)"/) ||
            matchString(source, /setMessage\s*\(\s*MESSAGE_WALKAWAY\s*,\s*'((?:[^'\\]|\\.)*)'/);
        if (greet) state.dialogue.greet = greet;
        if (farewell) state.dialogue.farewell = farewell;
        if (walkaway) state.dialogue.walkaway = walkaway;
    }

    function parseKeywordsFromLua(source) {
        var keywords = [];
        var patterns = [
            /addKeyword\s*\(\s*\{\s*"((?:[^"\\]|\\.)*)"\s*\}[\s\S]*?text\s*=\s*"((?:[^"\\]|\\.)*)"/g,
            /addKeyword\s*\(\s*\{\s*'((?:[^'\\]|\\.)*)'\s*\}[\s\S]*?text\s*=\s*'((?:[^'\\]|\\.)*)'/g,
            /addKeyword\s*\(\s*\{\s*"((?:[^"\\]|\\.)*)"\s*\}[\s\S]*?text\s*=\s*'((?:[^'\\]|\\.)*)'/g,
            /addKeyword\s*\(\s*\{\s*'((?:[^'\\]|\\.)*)'\s*\}[\s\S]*?text\s*=\s*"((?:[^"\\]|\\.)*)"/g
        ];
        for (var p = 0; p < patterns.length; p++) {
            var re = patterns[p];
            var m;
            while ((m = re.exec(source)) !== null) {
                keywords.push({
                    trigger: unescapeLua(m[1]),
                    response: unescapeLua(m[2])
                });
            }
        }
        return keywords;
    }

    window.isRevscriptNpcLua = function (source) {
        if (!source) return false;
        return /npcConfig\.outfit\s*=/i.test(source) || /Game\.createNpcType/i.test(source);
    };

    window.parseNpcScriptKeywords = parseKeywordsFromLua;

    window.parseNpcXml = function (source) {
        var state = baseState();
        if (!source || typeof source !== 'string') return state;

        var doc = new DOMParser().parseFromString(source, 'text/xml');
        if (doc.querySelector('parsererror')) return state;

        var npc = doc.querySelector('npc');
        if (!npc) return state;

        state.name = npc.getAttribute('name') || '';

        var walkInterval = parseInt(npc.getAttribute('walkinterval'), 10);
        if (!isNaN(walkInterval)) state.walkInterval = walkInterval;

        var walkRadius = parseInt(npc.getAttribute('walkradius'), 10);
        if (!isNaN(walkRadius)) state.walkRadius = walkRadius;

        var look = npc.querySelector('look');
        if (look) {
            state.outfit.lookType = parseInt(look.getAttribute('type'), 10) || 128;
            state.outfit.lookHead = parseInt(look.getAttribute('head'), 10) || 0;
            state.outfit.lookBody = parseInt(look.getAttribute('body'), 10) || 0;
            state.outfit.lookLegs = parseInt(look.getAttribute('legs'), 10) || 0;
            state.outfit.lookFeet = parseInt(look.getAttribute('feet'), 10) || 0;
        }

        var params = npc.querySelectorAll('parameters parameter');
        for (var i = 0; i < params.length; i++) {
            var key = (params[i].getAttribute('key') || '').toLowerCase();
            var val = params[i].getAttribute('value') || '';
            if (key === 'message_greet') state.dialogue.greet = val;
            else if (key === 'message_farewell') state.dialogue.farewell = val;
            else if (key === 'message_walkaway') state.dialogue.walkaway = val;
        }

        return state;
    };

    window.parseNpcLua = function (source) {
        var state = baseState();
        if (!source || typeof source !== 'string') return state;

        state.name = matchString(source, /local\s+internalNpcName\s*=\s*"((?:[^"\\]|\\.)*)"/) ||
            matchString(source, /local\s+npcName\s*=\s*"((?:[^"\\]|\\.)*)"/) ||
            matchString(source, /local\s+internalNpcName\s*=\s*'((?:[^'\\]|\\.)*)'/) ||
            matchString(source, /local\s+npcName\s*=\s*'((?:[^'\\]|\\.)*)'/) ||
            matchString(source, /npcConfig\.name\s*=\s*"((?:[^"\\]|\\.)*)"/) ||
            matchString(source, /npcConfig\.name\s*=\s*'((?:[^'\\]|\\.)*)'/) ||
            '';

        state.walkInterval = matchInt(source, /npcConfig\.walkInterval\s*=\s*(\d+)/);
        state.walkRadius = matchInt(source, /npcConfig\.walkRadius\s*=\s*(\d+)/);

        var outfitMatch = source.match(/npcConfig\.outfit\s*=\s*\{/i);
        if (outfitMatch) {
            applyOutfitBlock(state, extractBracedBlock(source, outfitMatch.index + outfitMatch[0].length - 1));
        } else {
            var inlineOutfit = source.match(/\boutfit\s*=\s*\{/i);
            if (inlineOutfit) {
                applyOutfitBlock(state, extractBracedBlock(source, inlineOutfit.index + inlineOutfit[0].length - 1));
            }
        }

        parseParameterMessages(state, source);
        state.keywords = parseKeywordsFromLua(source);

        var shopMatch = source.match(/npcConfig\.shop\s*=\s*\{/i);
        if (shopMatch) {
            var shopBody = extractBracedBlock(source, shopMatch.index + shopMatch[0].length - 1);
            if (shopBody) {
                var itemRe = /\{\s*itemName\s*=\s*"((?:[^"\\]|\\.)*)"[\s\S]*?clientId\s*=\s*(\d+)([\s\S]*?)\}/g;
                var itemMatch;
                while ((itemMatch = itemRe.exec(shopBody)) !== null) {
                    var extras = itemMatch[3];
                    var buy = 0;
                    var sell = 0;
                    var bm = extras.match(/buy\s*=\s*(\d+)/);
                    var sm = extras.match(/sell\s*=\s*(\d+)/);
                    if (bm) buy = parseInt(bm[1], 10);
                    if (sm) sell = parseInt(sm[1], 10);
                    state.tradeItems.push({
                        id: itemMatch[2],
                        name: unescapeLua(itemMatch[1]),
                        buy: buy,
                        sell: sell
                    });
                }
            }
        }

        return state;
    };

    window.parseNpcFile = function (filename, source) {
        var lower = (filename || '').toLowerCase();
        if (lower.endsWith('.xml')) return window.parseNpcXml(source);
        if (lower.endsWith('.lua')) return window.parseNpcLua(source);
        return baseState();
    };
})();
