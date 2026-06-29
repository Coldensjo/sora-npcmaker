/*
 * gamedata.js — Builds the catalog/outfit metadata the UI needs, replacing the
 * old generated data.js / outfit_data.js.
 *
 *   items.otb   -> server id <-> client id (+ coarse item group)
 *   items.xml   -> server id -> item name
 *   outfits.xml -> look type  -> outfit name (themed via XML comments)
 *
 * The NPC shop is keyed by clientId (see generator.js), and sprites are rendered
 * by clientId, so the catalog is keyed by client id with names resolved through
 * the OTB server->client mapping. Categories come from the OTB item group.
 *
 * Produces window.APP_DATA = { items, categories } and
 * window.OUTFIT_DATA = { looktype: {name, category} } + window.OUTFIT_CATEGORIES,
 * then dispatches the 'gamedata-ready' event. File I/O is done by assets.js,
 * which calls GameData.build(otbBuffer, itemsXmlText, outfitsXmlText).
 */
(function () {
    'use strict';

    var NODE_START = 0xFE, NODE_END = 0xFF, ESCAPE = 0xFD;
    var ATTR_SERVERID = 0x10, ATTR_CLIENTID = 0x11;
    var FLAG_PICKUPABLE = 1 << 5; // itemflags_t in otb_item_format.h

    // OTB item groups (ItemGroup_t), used as coarse catalog categories.
    var OTB_GROUPS = ['Misc', 'Ground', 'Container', 'Weapon', 'Ammunition', 'Armor',
        'Rune', 'Teleport', 'Magic Field', 'Writable', 'Key', 'Splash', 'Fluid',
        'Door', 'Deprecated', 'Podium'];

    // Walks the escaped OTB node tree and returns server->client + group per item.
    function parseOtb(buffer) {
        var bytes = new Uint8Array(buffer);
        var pos = 4; // skip 4-byte file header
        if (bytes[pos] !== NODE_START) throw new Error('items.otb: missing root node');
        pos++;

        function parseNode() {
            var node = { data: [], children: [] };
            while (pos < bytes.length) {
                var b = bytes[pos++];
                if (b === ESCAPE) { node.data.push(bytes[pos++]); continue; }
                if (b === NODE_START) { node.children.push(parseNode()); continue; }
                if (b === NODE_END) return node;
                node.data.push(b);
            }
            return node;
        }

        var root = parseNode();
        var serverToClient = {};
        var clientToGroup = {};
        var serverPickupable = {};
        for (var i = 0; i < root.children.length; i++) {
            var d = root.children[i].data;
            var group = d[0];
            // group(1) + flags(4, little-endian uint32)
            var flags = (d[1] | (d[2] << 8) | (d[3] << 16) | (d[4] << 24)) >>> 0;
            var o = 5;
            var server = 0, client = 0;
            while (o + 3 <= d.length) {
                var attr = d[o];
                var len = d[o + 1] | (d[o + 2] << 8);
                o += 3;
                if (o + len > d.length) break;
                if (attr === ATTR_SERVERID) server = d[o] | (d[o + 1] << 8);
                else if (attr === ATTR_CLIENTID) client = d[o] | (d[o + 1] << 8);
                o += len;
            }
            if (server && client) {
                serverToClient[server] = client;
                clientToGroup[client] = group;
                serverPickupable[server] = (flags & FLAG_PICKUPABLE) !== 0;
            }
        }
        return { serverToClient: serverToClient, clientToGroup: clientToGroup, serverPickupable: serverPickupable };
    }

    // Reads the combat values from an item's <attribute> children.
    function readCombat(el) {
        var attack = 0, defense = 0, armor = 0;
        var attrs = el.getElementsByTagName('attribute');
        for (var j = 0; j < attrs.length; j++) {
            var key = (attrs[j].getAttribute('key') || '').toLowerCase();
            if (key !== 'attack' && key !== 'defense' && key !== 'armor') continue;
            var val = parseInt(attrs[j].getAttribute('value'), 10) || 0;
            if (key === 'attack') attack = val;
            else if (key === 'defense') defense = val;
            else armor = val;
        }
        return { attack: attack, defense: defense, armor: armor };
    }

    // server id -> { name, attack, defense, armor }, expanding fromid/toid ranges.
    function parseItemsXml(text) {
        var doc = new DOMParser().parseFromString(text, 'text/xml');
        var nodes = doc.getElementsByTagName('item');
        var info = {};
        for (var i = 0; i < nodes.length; i++) {
            var el = nodes[i];
            var name = el.getAttribute('name');
            if (!name) continue;
            var combat = readCombat(el);
            var rec = { name: name, attack: combat.attack, defense: combat.defense, armor: combat.armor };
            var id = el.getAttribute('id');
            if (id) {
                info[parseInt(id, 10)] = rec;
            } else {
                var from = parseInt(el.getAttribute('fromid'), 10);
                var to = parseInt(el.getAttribute('toid'), 10);
                if (!isNaN(from) && !isNaN(to)) {
                    for (var sid = from; sid <= to; sid++) info[sid] = rec;
                }
            }
        }
        return info;
    }

    // look type -> { name, category }. Category is the most recent XML comment
    // (e.g. "GM Outfits", "Orc Outfits") preceding the entry.
    function parseOutfitsXml(text) {
        var doc = new DOMParser().parseFromString(text, 'text/xml');
        var root = doc.getElementsByTagName('outfits')[0];
        var outfits = {};
        var categories = [];
        var current = 'Outfits';
        if (root) {
            var nodes = root.childNodes;
            for (var i = 0; i < nodes.length; i++) {
                var n = nodes[i];
                if (n.nodeType === 8) { // comment
                    var label = n.nodeValue.trim();
                    if (label) {
                        current = label;
                        if (categories.indexOf(current) === -1) categories.push(current);
                    }
                } else if (n.nodeType === 1 && n.nodeName === 'outfit') {
                    if (n.getAttribute('enabled') === 'no') continue;
                    var look = parseInt(n.getAttribute('looktype'), 10);
                    var name = n.getAttribute('name') || ('Outfit ' + look);
                    if (!isNaN(look)) outfits[look] = { name: name, category: current };
                }
            }
        }
        return { outfits: outfits, categories: categories };
    }

    var GameData = {};

    GameData.build = function (otbBuffer, itemsXmlText, outfitsXmlText) {
        var otb = parseOtb(otbBuffer);
        var itemInfo = parseItemsXml(itemsXmlText);

        // Build the catalog keyed by client id, named via OTB server->client.
        var items = {};
        var usedCategories = {};
        var serverIds = Object.keys(otb.serverToClient);
        for (var i = 0; i < serverIds.length; i++) {
            var server = parseInt(serverIds[i], 10);
            var info = itemInfo[server];
            if (!info) continue; // only show items that have a real name
            if (!otb.serverPickupable[server]) continue; // shop only sells pickupable items
            var client = otb.serverToClient[server];
            if (!client) continue;

            // Combat attributes win over the coarse OTB group: anything with an
            // attack is a Weapon, otherwise defense => Shield, otherwise armor =>
            // Equipment; everything else keeps its OTB group (Container/Fluid/Misc).
            var category;
            if (info.attack > 0) category = 'Weapons';
            else if (info.defense > 0) category = 'Shields';
            else if (info.armor > 0) category = 'Equipment';
            else category = OTB_GROUPS[otb.clientToGroup[client] || 0] || 'Misc';

            // First name wins if several server ids map to the same client id.
            if (!items[client]) {
                items[client] = { name: info.name, category: category, serverId: server };
                usedCategories[category] = true;
            }
        }

        // Order categories: combat groups first, then OTB groups, Misc last.
        var ordered = ['Weapons', 'Shields', 'Equipment']
            .concat(OTB_GROUPS.slice(1).filter(function (c) { return c !== 'Deprecated'; }))
            .concat(['Misc']);
        var categories = ordered.filter(function (c) { return usedCategories[c]; });

        window.APP_DATA = {
            items: items,
            categories: categories
        };

        var outfitData = parseOutfitsXml(outfitsXmlText);
        window.OUTFIT_DATA = outfitData.outfits;
        window.OUTFIT_CATEGORIES = outfitData.categories;

        console.log('GameData: ' + Object.keys(items).length + ' named items in ' +
            categories.length + ' categories, ' + Object.keys(outfitData.outfits).length + ' outfits.');

        window.dispatchEvent(new Event('gamedata-ready'));
    };

    window.GameData = GameData;
})();
