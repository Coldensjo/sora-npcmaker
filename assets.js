/*
 * assets.js — Single loader for all Tibia game files used by the app.
 *
 * Loads (from ./assets):
 *   Tibia.dat, Tibia.spr  -> sprite rendering engine (sprites.js)
 *   items.otb, items.xml  -> item catalog (gamedata.js)
 *   outfits.xml           -> outfit names (gamedata.js)
 *
 * Binary fetch is blocked on file:// in most browsers, so if auto-load fails we
 * show a one-time picker that accepts the five files by name/extension. Serving
 * the folder over http loads everything automatically.
 */
(function () {
    'use strict';

    var FILES = {
        dat: { url: 'assets/Tibia.dat', kind: 'buffer' },
        spr: { url: 'assets/Tibia.spr', kind: 'buffer' },
        otb: { url: 'assets/items.otb', kind: 'buffer' },
        itemsXml: { url: 'assets/items.xml', kind: 'text' },
        outfitsXml: { url: 'assets/outfits.xml', kind: 'text' }
    };

    function fetchOne(spec) {
        return fetch(spec.url).then(function (res) {
            if (!res.ok) throw new Error('HTTP ' + res.status + ' for ' + spec.url);
            return spec.kind === 'text' ? res.text() : res.arrayBuffer();
        });
    }

    function finish(loaded) {
        window.TibiaSprites.loadFromBuffers(loaded.dat, loaded.spr);
        window.GameData.build(loaded.otb, loaded.itemsXml, loaded.outfitsXml);
    }

    function loadViaFetch() {
        var keys = Object.keys(FILES);
        return Promise.all(keys.map(function (k) { return fetchOne(FILES[k]); }))
            .then(function (results) {
                var loaded = {};
                keys.forEach(function (k, i) { loaded[k] = results[i]; });
                finish(loaded);
            });
    }

    // Maps a picked File to one of our slots by name / extension.
    function classify(file) {
        var n = file.name.toLowerCase();
        if (/\.dat$/.test(n)) return 'dat';
        if (/\.spr$/.test(n)) return 'spr';
        if (/\.otb$/.test(n)) return 'otb';
        if (/\.xml$/.test(n)) return n.indexOf('outfit') !== -1 ? 'outfitsXml' : 'itemsXml';
        return null;
    }

    function showPicker() {
        var bar = document.createElement('div');
        bar.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:99999999;' +
            'background:#2b211a;color:#e8d8b8;border-top:1px solid #6b563b;' +
            'padding:10px 14px;font:13px/1.4 sans-serif;display:flex;align-items:center;gap:10px;flex-wrap:wrap;';
        var msg = document.createElement('span');
        msg.innerHTML = 'Could not auto-load game files (open this page over http to skip this). ' +
            'Select <b>Tibia.dat, Tibia.spr, items.otb, items.xml, outfits.xml</b>:';
        bar.appendChild(msg);

        var input = document.createElement('input');
        input.type = 'file';
        input.accept = '.dat,.spr,.otb,.xml';
        input.multiple = true;
        input.style.color = '#e8d8b8';
        bar.appendChild(input);

        input.addEventListener('change', function () {
            var slots = {};
            var jobs = [];
            for (var i = 0; i < input.files.length; i++) {
                (function (file) {
                    var slot = classify(file);
                    if (!slot) return;
                    var kind = FILES[slot].kind;
                    jobs.push((kind === 'text' ? file.text() : file.arrayBuffer())
                        .then(function (data) { slots[slot] = data; }));
                }(input.files[i]));
            }
            Promise.all(jobs).then(function () {
                var missing = Object.keys(FILES).filter(function (k) { return !slots[k]; });
                if (missing.length) {
                    msg.innerHTML = 'Still missing: <b>' + missing.join(', ') + '</b>. Please select all five files.';
                    bar.style.borderTopColor = '#c0392b';
                    return;
                }
                finish(slots);
                bar.remove();
            });
        });

        document.body.appendChild(bar);
    }

    function start() {
        loadViaFetch().catch(function (err) {
            console.warn('assets.js: auto-load failed (' + err.message + '). Showing file picker.');
            showPicker();
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start);
    } else {
        start();
    }
})();
