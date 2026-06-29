// Logic

// State
window.NPC = {
    state: {
        name: '',
        walkInterval: null,
        walkRadius: null,
        outfit: { lookType: 128, lookHead: 0, lookBody: 0, lookLegs: 0, lookFeet: 0 },
        tradeItems: [],
        dialogue: { greet: 'Hello |PLAYERNAME|.', farewell: 'Farewell.', walkaway: 'How rude!' },
        keywords: []
    },
    selectedItem: null,
    activeColorPart: 'head',
    loadedNpcs: [],
    activeLoadedIndex: null,
    loadedFolderName: '',
    folderHandle: null,
    editingKeywordIndex: null
};

function gid(id) { return document.getElementById(id); }

// Sanitization
window.sanitize = function(str) {
    if (!str) return '';
    var map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#x27;',
        "/": '&#x2F;'
    };
    return String(str).replace(/[&<>"'/]/g, function(s) { return map[s]; });
};

// Shop
window.addTradeItem = function () {
    var rawVal = (gid('shop-item-search').value || '').trim().toLowerCase();

    var items = (window.APP_DATA && window.APP_DATA.items) || {};
    if (!window.NPC.selectedItem && rawVal) {
        var ids = Object.keys(items);
        for (var i = 0; i < ids.length; i++) {
            var id = ids[i];
            var n = (items[id].name || '').toLowerCase();
            if (id === rawVal || n === rawVal || n.includes(rawVal)) {
                window.NPC.selectedItem = { id: id, name: items[id].name };
                break;
            }
        }
    }

    if (!window.NPC.selectedItem) {
        alert('Please select an item from the catalog first.');
        return;
    }

    var bPrice = parseFloat(gid('shop-buy-price').value) || 0;
    var sPrice = parseFloat(gid('shop-sell-price').value) || 0;

    if (bPrice <= 0 && sPrice <= 0) {
        alert('Please enter a buy or sell price greater than 0.');
        return;
    }

    window.NPC.state.tradeItems.push({
        id: window.NPC.selectedItem.id,
        name: window.NPC.selectedItem.name,
        buy: bPrice,
        sell: sPrice
    });

    window.renderTradeItems();
    gid('shop-item-search').value = '';
    gid('shop-buy-price').value  = '';
    gid('shop-sell-price').value = '';
    window.NPC.selectedItem = null;
};

window.removeItem = function (index) {
    window.NPC.state.tradeItems.splice(index, 1);
    window.renderTradeItems();
};

window.renderTradeItems = function () {
    var tbody = gid('shop-items-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    window.NPC.state.tradeItems.forEach(function (item, index) {
        var tr = document.createElement('tr');
        tr.innerHTML =
            '<td><img data-sprite-id="' + window.sanitize(item.id) + '" style="width:24px;image-rendering:pixelated;"></td>' +
            '<td>' + window.sanitize(item.name) + '<div style="font-size:10px;color:#777">ID: ' + window.sanitize(item.id) + '</div></td>' +
            '<td style="color:#2ecc71">' + window.sanitize(item.buy) + ' gp</td>' +
            '<td style="color:#e74c3c">' + window.sanitize(item.sell) + ' gp</td>' +
            '<td style="text-align:center"><button class="rpg-btn danger" style="padding:4px 10px;font-size:11px;" onclick="window.removeItem(' + index + ')">X</button></td>';
        tbody.appendChild(tr);
    });
    if (window.TibiaSprites) window.TibiaSprites.decorate(tbody);
};

// Keywords
function autoResizeKwResponse() {
    var el = gid('kw-response');
    if (!el) return;
    el.style.height = 'auto';
    var max = parseFloat(getComputedStyle(el).maxHeight);
    var next = el.scrollHeight;
    if (!isNaN(max) && max > 0 && next > max) {
        el.style.height = max + 'px';
        el.style.overflowY = 'auto';
    } else {
        el.style.height = next + 'px';
        el.style.overflowY = 'hidden';
    }
}

function resetKeywordForm() {
    window.NPC.editingKeywordIndex = null;
    gid('kw-trigger').value  = '';
    gid('kw-response').value = '';
    var btn = gid('btn-add-kw');
    if (btn) btn.textContent = 'Add';
    autoResizeKwResponse();
}

window.addKeyword = function () {
    var trigger = (gid('kw-trigger').value || '').trim();
    var resp    = (gid('kw-response').value || '').trim();
    if (!trigger || !resp) { alert('Please enter a keyword and a response.'); return; }
    var idx = window.NPC.editingKeywordIndex;
    if (idx != null) {
        window.NPC.state.keywords[idx] = { trigger: trigger, response: resp };
    } else {
        window.NPC.state.keywords.push({ trigger: trigger, response: resp });
    }
    window.renderKeywords();
    resetKeywordForm();
};

window.editKeyword = function (index) {
    var kw = window.NPC.state.keywords[index];
    if (!kw) return;
    window.NPC.editingKeywordIndex = index;
    gid('kw-trigger').value  = kw.trigger;
    gid('kw-response').value   = kw.response;
    var btn = gid('btn-add-kw');
    if (btn) btn.textContent = 'Save';
    autoResizeKwResponse();
    gid('kw-trigger').focus();
};

window.removeKeyword = function (index) {
    window.NPC.state.keywords.splice(index, 1);
    if (window.NPC.editingKeywordIndex === index) {
        resetKeywordForm();
    } else if (window.NPC.editingKeywordIndex != null && window.NPC.editingKeywordIndex > index) {
        window.NPC.editingKeywordIndex -= 1;
    }
    window.renderKeywords();
};

window.renderKeywords = function () {
    var tbody = gid('keywords-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    window.NPC.state.keywords.forEach(function (kw, index) {
        var tr = document.createElement('tr');
        tr.innerHTML =
            '<td style="color:var(--accent);font-weight:bold">' + window.sanitize(kw.trigger) + '</td>' +
            '<td>' + window.sanitize(kw.response) + '</td>' +
            '<td style="text-align:center">' +
                '<button class="rpg-btn" style="padding:4px 10px;font-size:11px;margin-right:4px;" onclick="window.editKeyword(' + index + ')">Edit</button>' +
                '<button class="rpg-btn danger" style="padding:4px 10px;font-size:11px;" onclick="window.removeKeyword(' + index + ')">X</button>' +
            '</td>';
        tbody.appendChild(tr);
    });
};

function stateFingerprint(state) {
    return JSON.stringify({
        name: state.name,
        walkInterval: state.walkInterval,
        walkRadius: state.walkRadius,
        outfit: state.outfit,
        tradeItems: state.tradeItems,
        dialogue: state.dialogue,
        keywords: state.keywords
    });
}

function markNpcSaved(npc, state) {
    npc._savedFingerprint = stateFingerprint(state);
}

function isNpcDirty(npc, state) {
    return stateFingerprint(state) !== (npc._savedFingerprint || '');
}

function makeLoadedNpc(entry) {
    markNpcSaved(entry, entry.state);
    return entry;
}

function sanitizeNpcFilename(name) {
    var base = (name || 'npc').trim().replace(/[<>:"/\\|?*\x00-\x1f]/g, '').replace(/\s+/g, '_');
    return base || 'npc';
}

function getSavePathForNpc(npc, state) {
    if (npc && npc.saveRelativePath) return npc.saveRelativePath;
    if (npc && npc.relativePath && npc.relativePath.toLowerCase().endsWith('.lua')) {
        return npc.relativePath;
    }
    if (npc && npc.filename && npc.filename.toLowerCase().endsWith('.lua')) {
        return npc.filename;
    }
    return sanitizeNpcFilename(state.name) + '.lua';
}

function notifyCannotSaveToDisk(silent) {
    if (silent) return;
    alert('Load an NPC folder with Load Folder to save changes directly to disk.');
}

async function writeTextFileToDir(dir, relativePath, content) {
    var parts = relativePath.replace(/\\/g, '/').split('/').filter(Boolean);
    var fileName = parts.pop();
    var current = dir;
    for (var i = 0; i < parts.length; i++) {
        try {
            current = await current.getDirectoryHandle(parts[i]);
        } catch (err) {
            if (err.name !== 'NotFoundError') throw err;
            current = await current.getDirectoryHandle(parts[i], { create: true });
        }
    }
    var fileHandle;
    try {
        fileHandle = await current.getFileHandle(fileName);
    } catch (err) {
        if (err.name !== 'NotFoundError') throw err;
        fileHandle = await current.getFileHandle(fileName, { create: true });
    }
    var writable = await fileHandle.createWritable();
    await writable.write(content);
    await writable.close();
}

function flashSaveButton(label) {
    var btn = gid('btn-save');
    if (!btn) return;
    var original = btn.textContent;
    btn.textContent = label;
    setTimeout(function () { btn.textContent = original; }, 1200);
}

function filenameToNpcName(filename) {
    if (!filename) return '';
    return filename.replace(/^.*\//, '').replace(/\.(xml|lua)$/i, '');
}

function getNpcDisplayName(npc) {
    if (!npc) return 'Unnamed';
    var name = (npc.state && npc.state.name) ? String(npc.state.name).trim() : '';
    if (name) return name;
    return filenameToNpcName(npc.sourceFilename || npc.filename || npc.relativePath) || 'Unnamed';
}

function collectEditorState(existingNpc) {
    var state = cloneNpcState(window.NPC.state);
    var nameEl = gid('npc-name');
    if (nameEl) state.name = nameEl.value;
    var walkEl = gid('npc-walk-interval');
    if (walkEl && walkEl.value !== '') state.walkInterval = parseInt(walkEl.value, 10);
    var radiusEl = gid('npc-walk-radius');
    if (radiusEl && radiusEl.value !== '') state.walkRadius = parseInt(radiusEl.value, 10);
    var greetEl = gid('msg-greet');
    if (greetEl) state.dialogue.greet = greetEl.value;
    var farewellEl = gid('msg-farewell');
    if (farewellEl) state.dialogue.farewell = farewellEl.value;
    var walkawayEl = gid('msg-walkaway');
    if (walkawayEl) state.dialogue.walkaway = walkawayEl.value;

    if (!String(state.name || '').trim()) {
        if (existingNpc && existingNpc.state && existingNpc.state.name) {
            state.name = existingNpc.state.name;
        } else if (existingNpc) {
            state.name = filenameToNpcName(existingNpc.sourceFilename || existingNpc.filename || existingNpc.relativePath);
        }
    }
    return state;
}

async function persistNpcState(index, state, options) {
    options = options || {};
    var silent = options.silent === true;
    var npc = window.NPC.loadedNpcs[index];
    if (!npc) return false;

    var savePath = getSavePathForNpc(npc, state);
    npc.state = state;

    if (typeof window.generateLUA !== 'function') {
        if (!silent) alert('Generator not loaded');
        return false;
    }

    var dir = window.NPC.folderHandle;
    if (!dir) {
        notifyCannotSaveToDisk(silent);
        return false;
    }
    if (!(await ensureDirectoryWritePermission(dir))) {
        if (!silent) alert('Write permission denied. Use Load Folder and allow access to save changes.');
        return false;
    }

    try {
        var lua = window.generateLUA(state);
        await writeTextFileToDir(dir, savePath, lua);
        markNpcSaved(npc, state);
        if (!silent) flashSaveButton('Saved!');
        return true;
    } catch (err) {
        if (!silent) alert('Could not save file: ' + err.message);
        return false;
    }
}

var _npcLoadSerial = 0;

window.saveNPC = async function (options) {
    options = options || {};
    var silent = options.silent === true;
    var index = options.npcIndex != null ? options.npcIndex : window.NPC.activeLoadedIndex;
    var npc = index != null ? window.NPC.loadedNpcs[index] : null;
    var state = collectEditorState(npc);
    window.NPC.state = cloneNpcState(state);

    if (npc) {
        var saved = await persistNpcState(index, state, options);
        updateNpcBrowserItem(index);
        return saved;
    }

    notifyCannotSaveToDisk(silent);
    return false;
};

// Modal (kept for download preview via help flow if needed)
window.showLuaModal = function () {
    var modal = gid('output-modal');
    if (!modal) { alert('Modal not found'); return; }
    if (typeof window.generateLUA !== 'function') { alert('Generator not loaded'); return; }
    gid('lua-output').value = window.generateLUA(window.NPC.state);
    modal.style.cssText = 'display:flex !important; position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.85); justify-content:center; align-items:center; z-index:9999;';
};

window.closeLuaModal = function () {
    var modal = gid('output-modal');
    if (modal) modal.style.display = 'none';
};

window.downloadLua = function () {
    var text = gid('lua-output').value;
    if (!text) return;
    var blob = new Blob([text], { type: 'text/plain' });
    var a = document.createElement('a');
    a.download = (window.NPC.state.name || 'npc').toLowerCase().replace(/\s+/g, '_') + '.lua';
    a.href = URL.createObjectURL(blob);
    a.click();
};

window.showHelpModal = function () {
    var modal = gid('help-modal');
    if (modal) modal.style.cssText = 'display:flex !important; position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.85); justify-content:center; align-items:center; z-index:9999;';
};

window.closeHelpModal = function () {
    var modal = gid('help-modal');
    if (modal) modal.style.display = 'none';
};

// Reset
window.resetNPC = function () {
    if (confirm('Reset all data?')) window.location.reload();
};

// NPC folder browser
var DEFAULT_OUTFIT = { lookType: 128, lookHead: 0, lookBody: 0, lookLegs: 0, lookFeet: 0 };

function normalizeOutfit(outfit) {
    outfit = outfit || DEFAULT_OUTFIT;
    return {
        lookType: outfit.lookType != null ? outfit.lookType : 128,
        lookHead: outfit.lookHead != null ? outfit.lookHead : 0,
        lookBody: outfit.lookBody != null ? outfit.lookBody : 0,
        lookLegs: outfit.lookLegs != null ? outfit.lookLegs : 0,
        lookFeet: outfit.lookFeet != null ? outfit.lookFeet : 0
    };
}

function cloneNpcState(state) {
    state = state || {};
    return {
        name: state.name || '',
        walkInterval: state.walkInterval,
        walkRadius: state.walkRadius,
        outfit: normalizeOutfit(state.outfit),
        tradeItems: (state.tradeItems || []).map(function (i) {
            return { id: i.id, name: i.name, buy: i.buy, sell: i.sell };
        }),
        dialogue: {
            greet: (state.dialogue && state.dialogue.greet) || 'Hello |PLAYERNAME|.',
            farewell: (state.dialogue && state.dialogue.farewell) || 'Farewell.',
            walkaway: (state.dialogue && state.dialogue.walkaway) || 'How rude!'
        },
        keywords: (state.keywords || []).map(function (k) {
            return { trigger: k.trigger, response: k.response };
        })
    };
}

function findOutfitFilterButton(category) {
    var cats = window.OUTFIT_CATEGORIES || [];
    var idx = cats.indexOf(category);
    if (idx < 0) return null;
    return document.querySelectorAll('.outfit-filter-btn')[idx] || null;
}

function outfitOptionExists(outfitSelect, lookType) {
    lookType = String(lookType);
    for (var i = 0; i < outfitSelect.options.length; i++) {
        if (outfitSelect.options[i].value === lookType) return true;
    }
    return false;
}

function ensureOutfitInSelect(lookType) {
    lookType = parseInt(lookType, 10) || 128;
    var outfitSelect = gid('outfit-select');
    if (!outfitSelect) return lookType;

    if (outfitOptionExists(outfitSelect, lookType)) {
        outfitSelect.value = String(lookType);
        return lookType;
    }

    var data = window.OUTFIT_DATA || {};
    var info = data[lookType];
    if (info && info.category && typeof window.filterOutfits === 'function') {
        window.filterOutfits(info.category, findOutfitFilterButton(info.category), lookType);
    }

    if (!outfitOptionExists(outfitSelect, lookType)) {
        var opt = document.createElement('option');
        opt.value = String(lookType);
        opt.textContent = info ? (info.name + ' (' + lookType + ')') : ('LookType ' + lookType);
        outfitSelect.appendChild(opt);
    }

    outfitSelect.value = String(lookType);
    return lookType;
}

function setField(id, value) {
    var el = gid(id);
    if (el) el.value = value != null ? value : '';
}

window.filterOutfits = function (category, btnEl, preferredLookType) {
    var outfitSelect = gid('outfit-select');
    if (!outfitSelect) return;

    document.querySelectorAll('.outfit-filter-btn').forEach(function (b) { b.classList.remove('active'); });
    if (btnEl) btnEl.classList.add('active');

    var source = window.OUTFIT_DATA || {};
    outfitSelect.innerHTML = '';
    var ids = Object.keys(source).filter(function (oid) {
        return !category || source[oid].category === category;
    }).sort(function (a, b) {
        return (source[a].name || '').localeCompare(source[b].name || '');
    });

    ids.forEach(function (oid) {
        var opt = document.createElement('option');
        opt.value = oid;
        opt.textContent = source[oid].name + ' (' + oid + ')';
        outfitSelect.appendChild(opt);
    });

    var preferred = preferredLookType != null ? String(preferredLookType) : null;
    if (preferred && ids.indexOf(preferred) !== -1) {
        outfitSelect.value = preferred;
    } else if (ids.length) {
        outfitSelect.value = ids[0];
    }

    if (preferredLookType == null) updatePreview();
};

function outfitThumbKey(outfit) {
    outfit = normalizeOutfit(outfit);
    return outfit.lookType + ':' + outfit.lookHead + ':' + outfit.lookBody + ':' +
        outfit.lookLegs + ':' + outfit.lookFeet;
}

function paintOutfitThumb(imgEl, outfit, npc) {
    outfit = normalizeOutfit(outfit);
    var key = outfitThumbKey(outfit);
    if (npc && npc._thumbUrl && npc._thumbKey === key) {
        imgEl.src = npc._thumbUrl;
        imgEl.dataset.thumbPainted = '1';
        return;
    }
    function apply() {
        if (!window.TibiaSprites || !window.TibiaSprites.ready) return false;
        var url = window.TibiaSprites.getOutfitDataURL(outfit.lookType, {
            head: outfit.lookHead,
            body: outfit.lookBody,
            legs: outfit.lookLegs,
            feet: outfit.lookFeet,
            direction: 2
        });
        if (url) {
            imgEl.src = url;
            if (npc) {
                npc._thumbUrl = url;
                npc._thumbKey = key;
            }
        } else {
            imgEl.removeAttribute('src');
        }
        imgEl.dataset.thumbPainted = '1';
        return true;
    }
    if (apply()) return;
    if (window.TibiaSprites && window.TibiaSprites.whenReady) {
        window.TibiaSprites.whenReady(apply);
    }
}

var _thumbObserver = null;

function observeNpcThumb(img, index) {
    img.dataset.npcIndex = String(index);
    var npc = window.NPC.loadedNpcs[index];
    if (npc && npc._thumbUrl) {
        img.src = npc._thumbUrl;
        img.dataset.thumbPainted = '1';
        return;
    }
    if (!('IntersectionObserver' in window)) {
        if (npc) paintOutfitThumb(img, npc.state.outfit, npc);
        return;
    }
    if (!_thumbObserver) {
        var root = gid('npc-browser-list');
        _thumbObserver = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (!entry.isIntersecting) return;
                var el = entry.target;
                var idx = parseInt(el.dataset.npcIndex, 10);
                var entryNpc = window.NPC.loadedNpcs[idx];
                if (entryNpc && el.dataset.thumbPainted !== '1') {
                    paintOutfitThumb(el, entryNpc.state.outfit, entryNpc);
                }
                _thumbObserver.unobserve(el);
            });
        }, { root: root, rootMargin: '120px' });
    }
    _thumbObserver.observe(img);
}

function refreshNpcBrowserThumb(index) {
    var list = gid('npc-browser-list');
    if (!list) return;
    var btn = list.querySelector('.npc-browser-item[data-index="' + index + '"]');
    if (!btn) return;
    var npc = window.NPC.loadedNpcs[index];
    if (!npc) return;
    var img = btn.querySelector('.npc-browser-thumb img');
    if (!img) return;
    var key = outfitThumbKey(npc.state.outfit);
    if (npc._thumbUrl && npc._thumbKey === key) {
        img.src = npc._thumbUrl;
        img.dataset.thumbPainted = '1';
        return;
    }
    img.dataset.thumbPainted = '';
    paintOutfitThumb(img, npc.state.outfit, npc);
}

function updateNpcBrowserSelection() {
    var list = gid('npc-browser-list');
    if (!list) return;
    var active = window.NPC.activeLoadedIndex;
    list.querySelectorAll('.npc-browser-item').forEach(function (btn) {
        var idx = parseInt(btn.dataset.index, 10);
        btn.classList.toggle('active', idx === active);
    });
}

function updateNpcBrowserItem(index) {
    var list = gid('npc-browser-list');
    if (!list) return;
    var btn = list.querySelector('.npc-browser-item[data-index="' + index + '"]');
    var npc = window.NPC.loadedNpcs[index];
    if (!btn || !npc) return;
    var nameEl = btn.querySelector('.npc-browser-name');
    if (nameEl) nameEl.textContent = getNpcDisplayName(npc);
    refreshNpcBrowserThumb(index);
}

function repaintAllNpcThumbs() {
    var list = gid('npc-browser-list');
    if (!list) return;
    list.querySelectorAll('.npc-browser-item').forEach(function (btn) {
        var idx = parseInt(btn.dataset.index, 10);
        var npc = window.NPC.loadedNpcs[idx];
        if (!npc) return;
        var img = btn.querySelector('.npc-browser-thumb img');
        if (!img || img.dataset.thumbPainted === '1') return;
        observeNpcThumb(img, idx);
    });
}

function syncEditorFromState(state) {
    state = cloneNpcState(state);
    window.NPC.state = state;

    gid('npc-name').value = state.name;
    gid('npc-walk-interval').value = state.walkInterval != null ? state.walkInterval : '';
    gid('npc-walk-radius').value = state.walkRadius != null ? state.walkRadius : '';
    gid('msg-greet').value = state.dialogue.greet;
    gid('msg-farewell').value = state.dialogue.farewell;
    gid('msg-walkaway').value = state.dialogue.walkaway;

    state.outfit.lookType = ensureOutfitInSelect(state.outfit.lookType);
    window.NPC.state.outfit.lookType = state.outfit.lookType;
    updatePreview();
    refreshPaletteSelection();
    window.renderTradeItems();
    resetKeywordForm();
    window.renderKeywords();
}

function refreshPaletteSelection() {
    var val = 0;
    var p = window.NPC.activeColorPart;
    var o = window.NPC.state.outfit;
    if (p === 'head') val = o.lookHead;
    if (p === 'body') val = o.lookBody;
    if (p === 'legs') val = o.lookLegs;
    if (p === 'feet') val = o.lookFeet;

    document.querySelectorAll('.color-block').forEach(function (b) {
        b.classList.remove('selected');
        if (b.dataset.colorId == val) b.classList.add('selected');
    });
}

window.renderNpcBrowser = function () {
    var list = gid('npc-browser-list');
    var countEl = gid('npc-browser-count');
    var folderEl = gid('npc-browser-folder');
    if (!list) return;

    var npcs = window.NPC.loadedNpcs || [];
    if (folderEl) {
        folderEl.textContent = window.NPC.loadedFolderName || '';
    }
    if (countEl) {
        countEl.textContent = npcs.length ? (npcs.length + ' NPC' + (npcs.length === 1 ? '' : 's')) : '';
    }

    list.innerHTML = '';
    if (!npcs.length) {
        list.innerHTML = '<div class="npc-browser-empty">Select a folder of NPC .xml or .lua files from your server.</div>';
        return;
    }

    npcs.forEach(function (npc, index) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'npc-browser-item' + (window.NPC.activeLoadedIndex === index ? ' active' : '');
        btn.dataset.index = String(index);

        var thumb = document.createElement('div');
        thumb.className = 'npc-browser-thumb';
        var img = document.createElement('img');
        img.alt = '';
        observeNpcThumb(img, index);
        thumb.appendChild(img);

        var nameEl = document.createElement('div');
        nameEl.className = 'npc-browser-name';
        nameEl.textContent = getNpcDisplayName(npc);

        btn.appendChild(thumb);
        btn.appendChild(nameEl);
        list.appendChild(btn);
    });
};

window.loadNPCIntoEditor = async function (index) {
    var serial = ++_npcLoadSerial;
    var prevIndex = window.NPC.activeLoadedIndex;

    if (prevIndex !== null && prevIndex !== index) {
        var prevNpc = window.NPC.loadedNpcs[prevIndex];
        var snapshot = collectEditorState(prevNpc);
        prevNpc.state = snapshot;
        if (isNpcDirty(prevNpc, snapshot)) {
            persistNpcState(prevIndex, snapshot, { silent: true });
        }
        refreshNpcBrowserThumb(prevIndex);
        if (serial !== _npcLoadSerial) return;
    }

    var npc = window.NPC.loadedNpcs[index];
    if (!npc) return;

    window.NPC.activeLoadedIndex = index;
    syncEditorFromState(npc.state);
    updateNpcBrowserSelection();
};

function fileRelativePath(file) {
    return (file.relativePath || file.webkitRelativePath || file.name || '').replace(/\\/g, '/');
}

function shouldSkipNpcPath(path) {
    var lower = path.toLowerCase();
    return lower.indexOf('/lib/') !== -1 || lower.indexOf('lib/') === 0;
}

function scriptKeyFromPath(path) {
    var parts = path.split('/');
    return parts[parts.length - 1].toLowerCase();
}

window.processNpcFiles = async function (files, folderName) {
    var allFiles = Array.from(files);
    var xmlFiles = [];
    var luaFiles = [];
    var scriptMap = {};
    var scriptPathMap = {};

    allFiles.forEach(function (file) {
        var path = fileRelativePath(file);
        if (shouldSkipNpcPath(path)) return;
        var lower = file.name.toLowerCase();
        if (lower.endsWith('.xml')) {
            xmlFiles.push({ file: file, path: path });
        } else if (lower.endsWith('.lua')) {
            luaFiles.push({ file: file, path: path });
            var scriptKey = scriptKeyFromPath(path);
            scriptMap[scriptKey] = file;
            scriptPathMap[scriptKey] = path;
        }
    });

    window.NPC.loadedNpcs = [];
    window.NPC.activeLoadedIndex = null;
    window.NPC.loadedFolderName = folderName || '';

    var list = gid('npc-browser-list');
    if (list) list.innerHTML = '<div class="npc-browser-empty">Loading NPCs…</div>';

    var xmlScriptNames = {};

    var xmlNpcPromises = xmlFiles.map(function (xmlEntry) {
        return (async function () {
            try {
                var xmlText = await xmlEntry.file.text();
                var state = window.parseNpcXml(xmlText);
                var scriptMatch = xmlText.match(/<npc\b[^>]*\sscript\s*=\s*["']([^"']+)["']/i);
                var scriptAttr = scriptMatch ? scriptMatch[1] : '';
                var saveRelativePath = xmlEntry.path.replace(/\.xml$/i, '.lua');
                if (scriptAttr) {
                    xmlScriptNames[scriptAttr.toLowerCase()] = true;
                    var scriptFile = scriptMap[scriptAttr.toLowerCase()];
                    var scriptPath = scriptPathMap[scriptAttr.toLowerCase()];
                    if (scriptPath) saveRelativePath = scriptPath;
                    if (scriptFile) {
                        var scriptText = await scriptFile.text();
                        var kw = window.parseNpcScriptKeywords(scriptText);
                        if (kw.length) state.keywords = kw;
                    }
                }

                if (!state.name) {
                    state.name = xmlEntry.file.name.replace(/\.xml$/i, '');
                }
                state.outfit = normalizeOutfit(state.outfit);
                return makeLoadedNpc({
                    filename: xmlEntry.file.name,
                    sourceFilename: xmlEntry.file.name,
                    relativePath: xmlEntry.path,
                    saveRelativePath: saveRelativePath,
                    state: state
                });
            } catch (err) {
                console.warn('Failed to parse ' + xmlEntry.file.name, err);
                return null;
            }
        })();
    });

    var xmlNpcs = await Promise.all(xmlNpcPromises);
    window.NPC.loadedNpcs = xmlNpcs.filter(Boolean);

    var revscriptPromises = [];
    for (var j = 0; j < luaFiles.length; j++) {
        var luaEntry = luaFiles[j];
        var luaName = luaEntry.file.name.toLowerCase();
        if (xmlScriptNames[luaName]) continue;
        if (luaEntry.path.toLowerCase().indexOf('/scripts/') !== -1 ||
            luaEntry.path.toLowerCase().indexOf('scripts/') === 0) {
            continue;
        }

        revscriptPromises.push((async function (entry) {
            try {
                var luaText = await entry.file.text();
                if (!window.isRevscriptNpcLua(luaText)) return null;

                var luaState = window.parseNpcLua(luaText);
                if (!luaState.name) {
                    luaState.name = entry.file.name.replace(/\.lua$/i, '');
                }
                luaState.outfit = normalizeOutfit(luaState.outfit);
                return makeLoadedNpc({
                    filename: entry.file.name,
                    sourceFilename: entry.file.name,
                    relativePath: entry.path,
                    saveRelativePath: entry.path,
                    state: luaState
                });
            } catch (err2) {
                console.warn('Failed to parse ' + entry.file.name, err2);
                return null;
            }
        })(luaEntry));
    }

    var revscriptNpcs = await Promise.all(revscriptPromises);
    window.NPC.loadedNpcs = window.NPC.loadedNpcs.concat(revscriptNpcs.filter(Boolean));

    window.NPC.loadedNpcs.sort(function (a, b) {
        return (a.state.name || a.filename).localeCompare(b.state.name || b.filename, undefined, { sensitivity: 'base' });
    });

    window.renderNpcBrowser();
};

var NPC_FOLDER_DB = 'sora-npcmaker';
var NPC_FOLDER_STORE = 'handles';
var NPC_FOLDER_KEY = 'npc-folder';

function openNpcFolderDb() {
    return new Promise(function (resolve, reject) {
        var req = indexedDB.open(NPC_FOLDER_DB, 1);
        req.onupgradeneeded = function () {
            req.result.createObjectStore(NPC_FOLDER_STORE);
        };
        req.onerror = function () { reject(req.error); };
        req.onsuccess = function () { resolve(req.result); };
    });
}

function saveNpcFolderHandle(handle) {
    return openNpcFolderDb().then(function (db) {
        return new Promise(function (resolve, reject) {
            var tx = db.transaction(NPC_FOLDER_STORE, 'readwrite');
            tx.objectStore(NPC_FOLDER_STORE).put(handle, NPC_FOLDER_KEY);
            tx.oncomplete = function () { resolve(); };
            tx.onerror = function () { reject(tx.error); };
        });
    });
}

function loadNpcFolderHandle() {
    return openNpcFolderDb().then(function (db) {
        return new Promise(function (resolve, reject) {
            var tx = db.transaction(NPC_FOLDER_STORE, 'readonly');
            var req = tx.objectStore(NPC_FOLDER_STORE).get(NPC_FOLDER_KEY);
            req.onsuccess = function () { resolve(req.result || null); };
            req.onerror = function () { reject(req.error); };
        });
    });
}

function clearNpcFolderHandle() {
    return openNpcFolderDb().then(function (db) {
        return new Promise(function (resolve, reject) {
            var tx = db.transaction(NPC_FOLDER_STORE, 'readwrite');
            tx.objectStore(NPC_FOLDER_STORE).delete(NPC_FOLDER_KEY);
            tx.oncomplete = function () { resolve(); };
            tx.onerror = function () { reject(tx.error); };
        });
    });
}

async function ensureDirectoryReadPermission(dir) {
    if (!dir || typeof dir.queryPermission !== 'function') return false;
    var perm = await dir.queryPermission({ mode: 'read' });
    if (perm === 'granted') return true;
    if (perm === 'denied') return false;
    return (await dir.requestPermission({ mode: 'read' })) === 'granted';
}

async function ensureDirectoryWritePermission(dir) {
    if (!dir || typeof dir.queryPermission !== 'function') return false;
    var perm = await dir.queryPermission({ mode: 'readwrite' });
    if (perm === 'granted') return true;
    if (perm === 'denied') return false;
    return (await dir.requestPermission({ mode: 'readwrite' })) === 'granted';
}

async function collectNpcFilesFromDir(dir, files, basePath) {
    for await (var entry of dir.values()) {
        var rel = (basePath || '') + entry.name;
        if (entry.kind === 'file') {
            var lower = entry.name.toLowerCase();
            if (lower.endsWith('.xml') || lower.endsWith('.lua')) {
                var file = await entry.getFile();
                file.relativePath = rel;
                files.push(file);
            }
        } else if (entry.kind === 'directory' && entry.name.toLowerCase() !== 'lib') {
            await collectNpcFilesFromDir(entry, files, rel + '/');
        }
    }
}

async function loadNpcFolderFromHandle(dir, persist) {
    var files = [];
    await collectNpcFilesFromDir(dir, files, '');
    window.NPC.folderHandle = dir;
    await window.processNpcFiles(files, dir.name);
    if (persist !== false) {
        try {
            await saveNpcFolderHandle(dir);
        } catch (err) {
            console.warn('Could not save NPC folder handle', err);
        }
    }
}

window.restoreSavedNpcFolder = async function () {
    if (!window.showDirectoryPicker || !window.indexedDB) return;
    try {
        var dir = await loadNpcFolderHandle();
        if (!dir) return;
        if (!(await ensureDirectoryReadPermission(dir))) return;
        window.NPC.folderHandle = dir;
        await loadNpcFolderFromHandle(dir, false);
    } catch (err) {
        console.warn('Could not restore saved NPC folder', err);
    }
};

window.pickNpcFolder = async function () {
    if (window.showDirectoryPicker) {
        try {
            var pickerOpts = { id: 'sora-npcmaker-npc-folder', mode: 'readwrite' };
            var savedDir = await loadNpcFolderHandle();
            if (savedDir) pickerOpts.startIn = savedDir;
            var dir = await window.showDirectoryPicker(pickerOpts);
            await loadNpcFolderFromHandle(dir, true);
        } catch (err) {
            if (err && err.name !== 'AbortError') {
                console.error(err);
                alert('Could not read folder: ' + err.message);
            }
        }
        return;
    }

    var input = gid('npc-folder-input');
    if (input) {
        alert('Direct save requires Chrome or Edge. Use Load Folder (not the legacy file picker).');
    }
};

// Catalog
window.renderCatalog = function (category, activeBtnEl) {
    document.querySelectorAll('#category-filters .cat-btn').forEach(function (b) { b.classList.remove('highlight'); });
    if (activeBtnEl && activeBtnEl.classList) activeBtnEl.classList.add('highlight');

    var grid = gid('catalog-grid');
    if (!grid) return;
    grid.innerHTML = '';

    // Coarse OTB groups can be very large (the "Misc" bucket holds thousands of
    // items), so cap how many icons we render at once and steer users to search.
    var CATALOG_LIMIT = 500;
    var catalogItems = (window.APP_DATA && window.APP_DATA.items) || {};
    var matches = Object.keys(catalogItems).filter(function (id) {
        return catalogItems[id].category === category;
    });

    matches.slice(0, CATALOG_LIMIT).forEach(function (id) {
        var info = catalogItems[id];
        var div = document.createElement('div');
        div.style.cssText = 'text-align:center;cursor:pointer;padding:5px;border:1px solid transparent;border-radius:3px;';
        div.innerHTML =
            '<img data-sprite-id="' + window.sanitize(id) + '" style="width:32px;height:32px;object-fit:contain;image-rendering:pixelated;" title="' + window.sanitize(info.name) + '">' +
            '<div style="font-size:10px;color:#ad9372;margin-top:3px;word-break:break-all;">' + window.sanitize(info.name) + '</div>';

        div.onmouseover = function () { div.style.background = 'rgba(255,255,255,0.08)'; div.style.borderColor = 'var(--accent)'; };
        div.onmouseout  = function () { div.style.background = 'transparent'; div.style.borderColor = 'transparent'; };
        div.onclick = (function (itemId, itemName) {
            return function () {
                gid('shop-item-search').value = itemName;
                window.NPC.selectedItem = { id: itemId, name: itemName };
                gid('shop-buy-price').focus();
            };
        }(id, info.name));
        grid.appendChild(div);
    });

    if (matches.length > CATALOG_LIMIT) {
        var note = document.createElement('div');
        note.style.cssText = 'grid-column:1/-1;color:#888;font-size:11px;padding:8px;text-align:center;';
        note.textContent = 'Showing first ' + CATALOG_LIMIT + ' of ' + matches.length +
            ' items — use the search box above to find a specific item.';
        grid.appendChild(note);
    }

    if (window.TibiaSprites) window.TibiaSprites.decorate(grid);
};

// Autocomplete
function initAutocomplete() {
    console.log("Initializing Autocomplete...");
    var searchInput = gid('shop-item-search');
    var dropdown    = gid('shop-item-dropdown');
    
    if (!searchInput || !dropdown) {
        console.error("Critical: Search elements not found in DOM");
        return;
    }

    function handleInput(e) {
        var raw = searchInput.value || "";
        var val = raw.toLowerCase().trim();
        
        dropdown.innerHTML = '';
        window.NPC.selectedItem = null;
        
        if (val.length === 0) { 
            dropdown.style.display = 'none'; 
            return; 
        }

        // Try different global paths for APP_DATA
        var dataRoot = window.APP_DATA || (typeof APP_DATA !== 'undefined' ? APP_DATA : null);
        var items = (dataRoot && dataRoot.items) ? dataRoot.items : null;
        
        if (!items) {
            console.error("APP_DATA.items is missing or inaccessible");
            return;
        }

        var results = [];
        var ids = Object.keys(items);
        
        // Use a simple high-speed loop
        for (var i = 0; i < ids.length; i++) {
            var id   = ids[i];
            var info = items[id];
            var name = (info.name || "").toLowerCase();
            
            // Priority matching
            var rank = -1;
            if (id === val) rank = 0;
            else if (name.indexOf(val) === 0) rank = 1;
            else if (name.indexOf(val) !== -1) rank = 2;
            
            if (rank !== -1) {
                results.push({ id: id, name: info.name, rank: rank });
                if (results.length > 100) break; // Hard limit for safety
            }
        }

        // Sort: Rank first, then alphabetically
        results.sort(function(a, b) {
            if (a.rank !== b.rank) return a.rank - b.rank;
            return a.name.localeCompare(b.name);
        });

        var displayLimit = results.slice(0, 30);
        
        if (displayLimit.length > 0) {
            displayLimit.forEach(function(res) {
                var itemDiv = document.createElement('div');
                itemDiv.className = 'suggestion-item';
                itemDiv.style.cssText = 'display:flex; align-items:center; gap:10px; padding:8px 12px; cursor:pointer; border-bottom:1px solid rgba(255,255,255,0.05);';
                
                itemDiv.innerHTML = 
                    '<img data-sprite-id="' + window.sanitize(res.id) + '" style="width:24px;height:24px;image-rendering:pixelated;">' +
                    '<div style="flex:1; font-size:13px; color:#eee;">' + window.sanitize(res.name) + '</div>' +
                    '<div style="font-size:11px; color:#666;">' + window.sanitize(res.id) + '</div>';
                
                itemDiv.onclick = function() {
                    searchInput.value = res.name;
                    window.NPC.selectedItem = { id: res.id, name: res.name };
                    gid('shop-buy-price').focus();
                    dropdown.style.display = 'none';
                };
                dropdown.appendChild(itemDiv);
            });

            if (window.TibiaSprites) window.TibiaSprites.decorate(dropdown);
            dropdown.style.display = 'block';
            dropdown.style.zIndex = '9999999';
        } else {
            dropdown.style.display = 'none';
        }
    }

    // Bind multiple events for broad compatibility
    searchInput.addEventListener('input', handleInput);
    searchInput.addEventListener('keyup', handleInput);
    searchInput.addEventListener('focus', handleInput);

    // Close on outside click
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.autocomplete-wrapper')) {
            dropdown.style.display = 'none';
        }
    });

    console.log("Autocomplete Initialized Successfully");
}




// Palette
const TIBIA_PALETTE = [
    "#FFFFFF", "#FFD5BF", "#FFEABF", "#FFFFBF", "#EAFFBF", "#D5FFBF", "#BFFFBF", "#BFFFD5", "#BFFFEA", "#BFFFFF", "#BFEAFF", "#BFD5FF", "#BFBFFF", "#D5BFFF", "#EABFFF", "#FFBFFF", "#FFBFEA", "#FFBFD5", "#FFBFBF", // Row 1
    "#DBDBDB", "#BF9F8F", "#BFAF8F", "#BFBF8F", "#AFBF8F", "#9FBF8F", "#8FBF8F", "#8FBF9F", "#8FBFAF", "#8FBFBF", "#8FAFBF", "#8F9FBF", "#8F8FBF", "#9F8FBF", "#AF8FBF", "#BF8FBF", "#BF8FAF", "#BF8F9F", "#BF8F8F", // Row 2
    "#B6B6B6", "#BF7F5F", "#BF9F5F", "#BFBF5F", "#9FBF5F", "#7FBF5F", "#5FBF5F", "#5FBF7F", "#5FBF9F", "#5FBFBF", "#5F9FBF", "#5F7FBF", "#5F5FBF", "#7F5FBF", "#9F5FBF", "#BF5FBF", "#BF5F9F", "#BF5F7F", "#BF5F5F", // Row 3
    "#929292", "#BF6A3F", "#BF953F", "#BFBF3F", "#95BF3F", "#6ABF3F", "#3FBF3F", "#3FBF6A", "#3FBF95", "#3FBFBF", "#3F95BF", "#3F6ABF", "#3F3FBF", "#6A3FBF", "#953FBF", "#BF3FBF", "#BF3F95", "#BF3F6A", "#BF3F3F", // Row 4
    "#6D6D6D", "#FF5500", "#FFAA00", "#FFFF00", "#AAFF00", "#55FF00", "#00FF00", "#00FF55", "#00FFAA", "#00FFFF", "#00AAFF", "#0055FF", "#0000FF", "#5500FF", "#AA00FF", "#FF00FF", "#FF00AA", "#FF0055", "#FF0000", // Row 5 (Pure)
    "#494949", "#BF4000", "#BF7F00", "#BFBF00", "#7FBF00", "#40BF00", "#00BF00", "#00BF40", "#00BF7F", "#00BFBF", "#007FBF", "#0040BF", "#0000BF", "#4000BF", "#7F00BF", "#BF00BF", "#BF007F", "#BF0040", "#BF0000", // Row 6
    "#242424", "#802A00", "#805500", "#808000", "#558000", "#2A8000", "#008000", "#00802A", "#008055", "#008080", "#005580", "#002A80", "#000080", "#2A0080", "#550080", "#800080", "#800055", "#80002A", "#800000"  // Row 7
];

function getTibiaColor(index) {
    return TIBIA_PALETTE[index] || "#000000";
}

window.selectColor = function(idx) {
    var part = window.NPC.activeColorPart;
    if (part === 'head') window.NPC.state.outfit.lookHead = idx;
    if (part === 'body') window.NPC.state.outfit.lookBody = idx;
    if (part === 'legs') window.NPC.state.outfit.lookLegs = idx;
    if (part === 'feet') window.NPC.state.outfit.lookFeet = idx;
    updatePreview();
};

function initPalette() {
    var palette = gid('palette-grid');
    if (!palette) return;
    palette.innerHTML = '';
    
    for (var i = 0; i < TIBIA_PALETTE.length; i++) {
        var block = document.createElement('div');
        block.className = 'color-block';
        block.dataset.colorId = i;
        block.style.background = TIBIA_PALETTE[i];
        block.onclick = function() {
            var cid = parseInt(this.dataset.colorId);
            window.selectColor(cid);
            document.querySelectorAll('.color-block').forEach(function(b) { b.classList.remove('selected'); });
            this.classList.add('selected');
        };
        palette.appendChild(block);
    }

    // Attach listeners to part buttons
    document.querySelectorAll('.part-btn').forEach(function (btn) {
        btn.onclick = function () {
            document.querySelectorAll('.part-btn').forEach(function (b) { b.classList.remove('active'); });
            btn.classList.add('active');
            window.NPC.activeColorPart = btn.dataset.part;
            
            // Highlight current selection for this part
            var val = 0;
            var p = window.NPC.activeColorPart;
            if (p === 'head') val = window.NPC.state.outfit.lookHead;
            if (p === 'body') val = window.NPC.state.outfit.lookBody;
            if (p === 'legs') val = window.NPC.state.outfit.lookLegs;
            if (p === 'feet') val = window.NPC.state.outfit.lookFeet;
            
            document.querySelectorAll('.color-block').forEach(function (d) { d.classList.remove('selected'); });
            var tgt = document.querySelector('.color-block[data-color-id="' + val + '"]');
            if (tgt) tgt.classList.add('selected');
        };
    });
}

window.randomizeColors = function(mode) {
    function rand() { return Math.floor(Math.random() * TIBIA_PALETTE.length); }
    
    // 1. Randomize Colors (for both modes)
    window.NPC.state.outfit.lookHead = rand();
    window.NPC.state.outfit.lookBody = rand();
    window.NPC.state.outfit.lookLegs = rand();
    window.NPC.state.outfit.lookFeet = rand();

    // 2. Randomize Outfit (only for 'full' mode) — pick any option currently in
    // the dropdown so it stays within the active outfit category.
    if (mode === 'full') {
        var select = gid('outfit-select');
        if (select && select.options.length > 0) {
            var randomOpt = select.options[Math.floor(Math.random() * select.options.length)];
            select.value = randomOpt.value;
            window.NPC.state.outfit.lookType = parseInt(randomOpt.value, 10);
        }
    }

    updatePreview();
    // Refresh selection highlights in palette for active part
    var val = 0;
    var p = window.NPC.activeColorPart;
    if (p === 'head') val = window.NPC.state.outfit.lookHead;
    if (p === 'body') val = window.NPC.state.outfit.lookBody;
    if (p === 'legs') val = window.NPC.state.outfit.lookLegs;
    if (p === 'feet') val = window.NPC.state.outfit.lookFeet;
    
    document.querySelectorAll('.color-block').forEach(function(b) { 
        b.classList.remove('selected');
        if (b.dataset.colorId == val) b.classList.add('selected');
    });
};


function getPreviewNpcName() {
    var name = String((window.NPC.state && window.NPC.state.name) || '').trim();
    if (name) return name;
    var idx = window.NPC.activeLoadedIndex;
    if (idx != null) {
        var npc = window.NPC.loadedNpcs[idx];
        if (npc) return getNpcDisplayName(npc);
    }
    return 'Unnamed';
}

function updatePreviewNpcName() {
    var nameEl = gid('preview-npc-name');
    if (!nameEl) return;
    nameEl.textContent = getPreviewNpcName();
}

// Preview — rendered locally from the .spr (see sprites.js).
function updatePreview() {
    var outfitSelect = gid('outfit-select');
    var previewImg   = gid('preview-outfit');
    if (!outfitSelect || !previewImg) return;
    var type   = parseInt(outfitSelect.value || '128', 10);
    var o      = window.NPC.state.outfit;

    window.NPC.state.outfit.lookType = type;

    if (window.TibiaSprites && window.TibiaSprites.ready) {
        var url = window.TibiaSprites.getOutfitDataURL(type, {
            head: o.lookHead, body: o.lookBody, legs: o.lookLegs, feet: o.lookFeet,
            direction: 2
        });
        if (url) {
            previewImg.src = url;
        } else {
            previewImg.removeAttribute('src');
        }
    }

    updatePreviewNpcName();
}

// Initialization
document.addEventListener('DOMContentLoaded', function () {

    // Tabs
    document.querySelectorAll('.tab-btn').forEach(function (tab) {
        tab.addEventListener('click', function () {
            document.querySelectorAll('.tab-btn').forEach(function (t) { t.classList.remove('active'); });
            document.querySelectorAll('.tab-content').forEach(function (c) { c.classList.remove('active'); });
            tab.classList.add('active');
            gid(tab.dataset.target).classList.add('active');
        });
    });

    // Outfit dropdown + filter buttons — powered by OUTFIT_DATA (outfits.xml).
    var outfitSelect = gid('outfit-select');

    // Builds the outfit category buttons, defaulting to the group that contains
    // the standard Civilian (128) outfit and pre-selecting it when present.
    function buildOutfitFilters() {
        var container = gid('outfit-type-filter');
        if (!container) return;
        container.innerHTML = '';
        var cats = window.OUTFIT_CATEGORIES || [];
        var data = window.OUTFIT_DATA || {};
        var defaultCat = (data[128] && data[128].category) || cats[0];

        cats.forEach(function (cat) {
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'rpg-btn outfit-filter-btn' + (cat === defaultCat ? ' active' : '');
            btn.textContent = cat.replace(/\s*Outfits$/i, '');
            btn.onclick = (function (c, b) { return function () { window.filterOutfits(c, b); }; }(cat, btn));
            container.appendChild(btn);
        });

        window.filterOutfits(defaultCat, container.querySelector('.outfit-filter-btn.active'));
        if (data[128]) { outfitSelect.value = '128'; updatePreview(); }
    }

    function buildCategoryButtons() {
        var filters = gid('category-filters');
        var categories = (window.APP_DATA && window.APP_DATA.categories) || [];
        if (!filters) return;
        filters.innerHTML = '';
        categories.forEach(function (cat, idx) {
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'rpg-btn cat-btn' + (idx === 0 ? ' highlight' : '');
            btn.textContent = cat;
            btn.onclick = (function (c, b) { return function () { window.renderCatalog(c, b); }; }(cat, btn));
            filters.appendChild(btn);
        });
        if (filters.firstElementChild) {
            window.renderCatalog(categories[0], filters.firstElementChild);
        }
    }

    outfitSelect.addEventListener('change', updatePreview);

    // Autocomplete (reads APP_DATA lazily, so it's safe to init now).
    initAutocomplete();
    setTimeout(initAutocomplete, 500);

    initPalette();

    // The catalog and outfit list depend on the async game files.
    function buildGameDataUI() {
        buildOutfitFilters();
        buildCategoryButtons();
        updatePreview();
    }
    if (window.APP_DATA && window.OUTFIT_DATA) {
        buildGameDataUI();
    } else {
        window.addEventListener('gamedata-ready', buildGameDataUI);
    }

    // Basic config fields
    gid('npc-name').addEventListener('input',          function (e) { window.NPC.state.name = e.target.value; updatePreviewNpcName(); });
    gid('npc-walk-interval').addEventListener('input', function (e) { window.NPC.state.walkInterval           = parseInt(e.target.value); });
    gid('npc-walk-radius').addEventListener('input',   function (e) { window.NPC.state.walkRadius             = parseInt(e.target.value); });
    gid('msg-greet').addEventListener('input',         function (e) { window.NPC.state.dialogue.greet         = e.target.value; });
    gid('msg-farewell').addEventListener('input',      function (e) { window.NPC.state.dialogue.farewell       = e.target.value; });
    gid('msg-walkaway').addEventListener('input',      function (e) { window.NPC.state.dialogue.walkaway       = e.target.value; });

    var kwResponse = gid('kw-response');
    if (kwResponse) {
        kwResponse.addEventListener('input', autoResizeKwResponse);
        autoResizeKwResponse();
    }

    var folderInput = gid('npc-folder-input');
    if (folderInput) {
        folderInput.addEventListener('change', function () {
            folderInput.value = '';
            alert('Direct save requires Chrome or Edge. Use Load Folder to select your NPC directory.');
        });
    }

    var npcBrowserList = gid('npc-browser-list');
    if (npcBrowserList) {
        npcBrowserList.addEventListener('click', function (e) {
            var item = e.target.closest('.npc-browser-item');
            if (!item || item.dataset.index == null) return;
            window.loadNPCIntoEditor(parseInt(item.dataset.index, 10));
        });
    }

    window.addEventListener('gamedata-ready', function () {
        if (window.NPC.loadedNpcs && window.NPC.loadedNpcs.length) {
            window.renderNpcBrowser();
            repaintAllNpcThumbs();
        }
    });

    window.restoreSavedNpcFolder();
});
