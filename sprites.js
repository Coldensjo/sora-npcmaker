/*
 * sprites.js — Rendering engine that draws item icons and outfits directly from
 * the Tibia client .dat / .spr files (no pre-rendered .gif / external API).
 *
 * The .dat describes every client thing (items 100..itemCount, then creatures /
 * outfits) as dimensions + a list of sprite ids. The .spr holds the
 * RLE-compressed 32x32 sprite pixels. We parse both, compose the requested
 * image on a canvas, and return a data URL that drops into an <img src>.
 *
 * Outfits use a 2-layer scheme: layer 0 is the base colour sprite, layer 1 is a
 * template "mask" whose yellow/red/green/blue pixels select head/body/legs/feet
 * and are tinted with the 133-colour Tibia outfit palette.
 *
 * Format here is the classic Tibia 8.0 layout (DAT signature 0x467FD7E6):
 * non-extended (16-bit sprite ids) and non-transparent (3 bytes/pixel). Logic
 * mirrors remeres-map-editor-redux (dat_item_parser.cpp, sprite_archive.cpp,
 * normal_image.cpp, template_image.cpp, outfit_colors.cpp, outfit_colorizer.cpp,
 * sprite_icon_generator.cpp).
 *
 * This module only renders; file loading is handled by assets.js, which calls
 * TibiaSprites.loadFromBuffers(datBuffer, sprBuffer).
 */
(function () {
    'use strict';

    var SPRITE_PIXELS = 32;
    var PX_PER_SPRITE = SPRITE_PIXELS * SPRITE_PIXELS;

    // The 133 outfit template colours (RGB), from outfit_colors.cpp.
    var OUTFIT_PALETTE = [16777215,16766143,16771519,16777151,15335359,13959103,12582847,12582868,12582889,12582911,12577279,12571903,12566527,13942783,15319039,16760831,16760809,16760788,16760767,14342874,12558223,12562319,12566415,11517839,10469263,9420687,9420703,9420719,9420735,9416639,9412543,9408447,10457023,11505599,12554175,12554159,12554143,12554127,11974326,12549983,12562319,12566367,10469215,8372063,6274911,6274943,6274975,6275007,6266815,6258623,6250431,8347583,10444735,12541887,12541855,12541823,12541791,9539985,12544575,12555327,12566335,9748287,6995775,4177727,4177770,4177812,4177855,4166847,4156095,4145087,6963135,9715647,12533695,12533652,12533610,12533567,7171437,16733440,16755200,16776960,11206400,5570304,65280,65364,65450,65535,43519,22015,255,5570815,11075839,16646399,16711850,16711765,16711680,4737096,12533504,12549888,12566272,8371968,4177664,48896,48959,49023,49087,32703,16319,191,4128959,8323263,12517567,12517503,12517439,12517376,2368548,8333824,8344832,8355584,5603072,2785024,32512,32554,32597,32639,21631,10879,127,2752639,5505151,8323199,8323157,8323114,8323072];

    // ----- DAT flag ids (post-remap, matching the DatFlags enum) -------------
    var FLAG_GROUND = 0, FLAG_WRITABLE = 8, FLAG_WRITABLE_ONCE = 9, FLAG_LIGHT = 21,
        FLAG_DISPLACEMENT = 24, FLAG_ELEVATION = 25, FLAG_MINIMAP_COLOR = 28,
        FLAG_LENS_HELP = 29, FLAG_CLOTH = 32, FLAG_MARKET = 33, FLAG_USABLE = 34,
        FLAG_WINGS = 38, FLAG_LAST = 255;

    // Tibia 8.0 (DAT_FORMAT_78): flag 8 becomes "chargeable" and every flag
    // above 8 is shifted down by one versus the modern enum.
    function remapFlag(flag) {
        if (flag === 8) return 254;
        if (flag > 8) return flag - 1;
        return flag;
    }

    function ByteReader(buffer) { this.view = new DataView(buffer); this.pos = 0; }
    ByteReader.prototype.u8 = function () { return this.view.getUint8(this.pos++); };
    ByteReader.prototype.u16 = function () { var v = this.view.getUint16(this.pos, true); this.pos += 2; return v; };
    ByteReader.prototype.u32 = function () { var v = this.view.getUint32(this.pos, true); this.pos += 4; return v; };
    ByteReader.prototype.skip = function (n) { this.pos += n; };
    ByteReader.prototype.skipString = function () { this.pos += this.u16(); };

    function readFlagPayload(r, flag) {
        switch (flag) {
            case FLAG_GROUND: r.u16(); return;
            case FLAG_WRITABLE:
            case FLAG_WRITABLE_ONCE:
            case FLAG_CLOTH:
            case FLAG_LENS_HELP:
            case FLAG_USABLE: r.skip(2); return;
            case FLAG_LIGHT: r.u16(); r.u16(); return;
            case FLAG_DISPLACEMENT: r.u16(); r.u16(); return;
            case FLAG_ELEVATION: r.u16(); return;
            case FLAG_MINIMAP_COLOR: r.u16(); return;
            case FLAG_MARKET: r.skip(6); r.skipString(); r.skip(4); return;
            case FLAG_WINGS: r.skip(16); return;
            default: return;
        }
    }

    function readFlags(r) {
        for (var i = 0; i < 255; i++) {
            var flag = r.u8();
            if (flag === FLAG_LAST) return;
            readFlagPayload(r, remapFlag(flag));
        }
        throw new Error('DAT: flag list overflow');
    }

    function readEntry(r) {
        readFlags(r);
        var width = r.u8();
        var height = r.u8();
        if (width > 1 || height > 1) r.skip(1); // "exact size" byte
        var layers = r.u8();
        var patternX = r.u8();
        var patternY = r.u8();
        var patternZ = r.u8();
        var frames = r.u8();
        // No frame-duration block in 8.0.
        var count = width * height * layers * patternX * patternY * patternZ * frames;
        var sprites = new Array(count);
        for (var s = 0; s < count; s++) sprites[s] = r.u16();
        return {
            width: width, height: height, layers: layers,
            patternX: patternX, patternY: patternY, patternZ: patternZ,
            frames: frames, sprites: sprites
        };
    }

    // Parses items (100..itemCount) and creatures (itemCount+1..+creatureCount).
    function parseDat(buffer) {
        var r = new ByteReader(buffer);
        var signature = r.u32();
        var itemCount = r.u16();
        var creatureCount = r.u16();
        r.u16(); // effectCount
        r.u16(); // distanceCount

        var items = {};
        var creatures = {};
        var id;
        for (id = 100; id <= itemCount; id++) items[id] = readEntry(r);
        // Creature N (lookType N) is the Nth entry after the items.
        for (var look = 1; look <= creatureCount; look++) creatures[look] = readEntry(r);

        return {
            signature: signature, itemCount: itemCount, creatureCount: creatureCount,
            items: items, creatures: creatures
        };
    }

    // Reads the .spr index table (offset of every sprite).
    function parseSpr(buffer) {
        var view = new DataView(buffer);
        var spriteCount = view.getUint16(4, true);
        var offsets = new Uint32Array(spriteCount + 1);
        var p = 6;
        for (var i = 1; i <= spriteCount; i++) { offsets[i] = view.getUint32(p, true); p += 4; }
        return { view: view, count: spriteCount, offsets: offsets };
    }

    // Decompresses one 32x32 sprite into the RGBA `out` buffer (transparent runs
    // are left at alpha 0; colored runs are 3 bytes RGB each in this format).
    function decodeSprite(spr, id, out) {
        out.fill(0);
        if (!id || id >= spr.offsets.length) return out;
        var offset = spr.offsets[id];
        if (offset === 0) return out;
        var view = spr.view;
        var p = offset + 3; // skip the 3-byte color key
        var size = view.getUint16(p, true);
        p += 2;
        var end = p + size;
        var write = 0;
        while (p + 1 < end && write < PX_PER_SPRITE) {
            write += view.getUint16(p, true); p += 2; // transparent run
            if (p + 1 >= end) break;
            var colored = view.getUint16(p, true); p += 2;
            for (var c = 0; c < colored && write < PX_PER_SPRITE; c++) {
                var o = write * 4;
                out[o] = view.getUint8(p);
                out[o + 1] = view.getUint8(p + 1);
                out[o + 2] = view.getUint8(p + 2);
                out[o + 3] = 255;
                p += 3; write++;
            }
        }
        return out;
    }

    // Flat sprite-list index for a thing, matching GameSprite::getIndex.
    function spriteIndex(e, w, h, layer, px, py, pz, frame) {
        var idx = (e.frames > 1) ? (frame % e.frames) : 0;
        idx = idx * e.patternZ + pz;
        idx = idx * e.patternY + py;
        idx = idx * e.patternX + px;
        idx = idx * e.layers + layer;
        idx = idx * e.height + h;
        idx = idx * e.width + w;
        return idx;
    }

    function tintPixel(colorIndex, rgb) {
        var t = OUTFIT_PALETTE[colorIndex] || 0xFFFFFF;
        rgb[0] = (rgb[0] * ((t >> 16) & 0xFF) / 255) | 0;
        rgb[1] = (rgb[1] * ((t >> 8) & 0xFF) / 255) | 0;
        rgb[2] = (rgb[2] * (t & 0xFF) / 255) | 0;
    }

    var TibiaSprites = {
        ready: false,
        _dat: null,
        _spr: null,
        _itemCache: {},
        _readyPromise: null,
        _resolveReady: null,
        _base: new Uint8ClampedArray(PX_PER_SPRITE * 4),
        _mask: new Uint8ClampedArray(PX_PER_SPRITE * 4)
    };

    TibiaSprites._initPromise = function () {
        if (!this._readyPromise) {
            var self = this;
            this._readyPromise = new Promise(function (resolve) { self._resolveReady = resolve; });
        }
    };
    TibiaSprites._initPromise();

    TibiaSprites.loadFromBuffers = function (datBuffer, sprBuffer) {
        this._dat = parseDat(datBuffer);
        this._spr = parseSpr(sprBuffer);
        this.ready = true;
        if (this._resolveReady) this._resolveReady();
        this.decorate(document);
        console.log('TibiaSprites: ' + Object.keys(this._dat.items).length + ' items, ' +
            this._dat.creatureCount + ' outfits, ' + this._spr.count + ' sprites.');
    };

    TibiaSprites.whenReady = function (cb) {
        if (this.ready) { cb(); return; }
        this._readyPromise.then(cb);
    };

    function newCanvas(size) {
        var c = document.createElement('canvas');
        c.width = size; c.height = size;
        return c;
    }

    // ----- Item icons -------------------------------------------------------
    TibiaSprites.getItemDataURL = function (clientId) {
        clientId = parseInt(clientId, 10);
        if (!this.ready || isNaN(clientId)) return null;
        if (Object.prototype.hasOwnProperty.call(this._itemCache, clientId)) return this._itemCache[clientId];

        var item = this._dat.items[clientId];
        if (!item) { this._itemCache[clientId] = null; return null; }

        var tiles = Math.max(item.width, item.height);
        var canvas = newCanvas(tiles * SPRITE_PIXELS);
        var ctx = canvas.getContext('2d');
        var painted = false;

        for (var l = 0; l < item.layers; l++) {
            for (var w = 0; w < item.width; w++) {
                for (var h = 0; h < item.height; h++) {
                    var idx = spriteIndex(item, w, h, l, 0, 0, 0, 0);
                    var spriteId = item.sprites[idx] || 0;
                    if (!spriteId) continue;
                    decodeSprite(this._spr, spriteId, this._base);
                    ctx.putImageData(new ImageData(this._base.slice(0), SPRITE_PIXELS, SPRITE_PIXELS),
                        (item.width - w - 1) * SPRITE_PIXELS, (item.height - h - 1) * SPRITE_PIXELS);
                    painted = true;
                }
            }
        }

        var url = painted ? canvas.toDataURL('image/png') : null;
        this._itemCache[clientId] = url;
        return url;
    };

    // ----- Outfits ----------------------------------------------------------
    // look = { head, body, legs, feet, direction }
    // Renders the base outfit (no addons / no mount) to a fresh data URL. Not
    // cached because the colour combination changes constantly.
    TibiaSprites.getOutfitDataURL = function (lookType, look) {
        if (!this.ready) return null;
        var e = this._dat.creatures[parseInt(lookType, 10)];
        if (!e) return null;
        look = look || {};
        var direction = (look.direction == null) ? 2 : look.direction; // south = facing viewer

        var tiles = Math.max(e.width, e.height);
        var spritePx = tiles * SPRITE_PIXELS;
        // 2x2 (64x64) outfits anchor on the south-east tile; pad north-west so
        // feet line up with 32x32 outfits when the preview image is centered.
        var pad = (spritePx === 64 && e.width >= 2 && e.height >= 2) ? SPRITE_PIXELS : 0;
        var canvas = newCanvas(spritePx + pad);
        var ctx = canvas.getContext('2d');

        var frameDir = e.patternX === 4 ? direction : 0;
        this._drawThing(ctx, e, frameDir, 0, 0, look);

        return canvas.toDataURL('image/png');
    };

    // Draws every tile/layer of one frame of a thing onto ctx. When `look` is
    // provided and the thing has 2 layers, layer 1 is treated as the colour mask.
    TibiaSprites._drawThing = function (ctx, e, frameDir, py, pz, look) {
        var colorize = look && e.layers >= 2;
        for (var w = 0; w < e.width; w++) {
            for (var h = 0; h < e.height; h++) {
                var baseIdx = spriteIndex(e, w, h, 0, frameDir, py, pz, 0);
                decodeSprite(this._spr, e.sprites[baseIdx] || 0, this._base);
                if (colorize) {
                    decodeSprite(this._spr, e.sprites[baseIdx + e.width * e.height] || 0, this._mask);
                    this._applyMask(this._base, this._mask, look);
                }
                ctx.putImageData(new ImageData(this._base.slice(0), SPRITE_PIXELS, SPRITE_PIXELS),
                    (e.width - w - 1) * SPRITE_PIXELS, (e.height - h - 1) * SPRITE_PIXELS);
            }
        }
    };

    var _rgb = [0, 0, 0];
    TibiaSprites._applyMask = function (base, mask, look) {
        for (var i = 0; i < PX_PER_SPRITE; i++) {
            var o = i * 4;
            if (base[o + 3] === 0) continue;
            var mr = mask[o], mg = mask[o + 1], mb = mask[o + 2];
            var color = -1;
            if (mr && mg && !mb) color = look.head;
            else if (mr && !mg && !mb) color = look.body;
            else if (!mr && mg && !mb) color = look.legs;
            else if (!mr && !mg && mb) color = look.feet;
            if (color < 0) continue;
            _rgb[0] = base[o]; _rgb[1] = base[o + 1]; _rgb[2] = base[o + 2];
            tintPixel(color || 0, _rgb);
            base[o] = _rgb[0]; base[o + 1] = _rgb[1]; base[o + 2] = _rgb[2];
        }
    };

    // ----- <img> helpers (items) -------------------------------------------
    TibiaSprites.applyTo = function (img, clientId) {
        var self = this;
        this.whenReady(function () {
            var url = self.getItemDataURL(clientId);
            if (url) img.src = url; else img.style.visibility = 'hidden';
        });
    };

    TibiaSprites.decorate = function (root) {
        var scope = root || document;
        var imgs = scope.querySelectorAll('img[data-sprite-id]');
        for (var i = 0; i < imgs.length; i++) {
            var img = imgs[i];
            if (img.getAttribute('data-sprite-done') === '1') continue;
            img.setAttribute('data-sprite-done', '1');
            this.applyTo(img, img.getAttribute('data-sprite-id'));
        }
    };

    window.TibiaSprites = TibiaSprites;
})();
