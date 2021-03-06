/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// VERSION 2.0.11

this.__defineGetter__('gURLBar', function() { return window.gURLBar; });
this.__defineGetter__('locationContainer', function() { return $('urlbar-container'); });
this.__defineGetter__('searchContainer', function() { return $('search-container'); });

this.urlbar = {
	get container () { return $(objName+'-urlbar-container'); },
	get bar () { return $(objName+'-urlbar-bar'); },
	get PP () { return $(objName+'-urlbar-PP'); },
	get historydropmarker () { return $ª($('urlbar'), 'historydropmarker'); },

	flexContainers: false,

	key: {
		id: objName+'-urlbar-key',
		command: objName+':ToggleURLBarBar',
		get keycode () { return Prefs.urlbar_keycode; },
		get accel () { return Prefs.urlbar_accel; },
		get shift () { return Prefs.urlbar_shift; },
		get alt () { return Prefs.urlbar_alt; },
		get ctrl () { return Prefs.urlbar_ctrl; }
	},

	observe: function(aSubject, aTopic, aData) {
		switch(aSubject) {
			case 'urlbar_pp':
				this.togglePP();
				break;

			case 'urlbar_keycode':
			case 'urlbar_accel':
			case 'urlbar_shift':
			case 'urlbar_alt':
			case 'urlbar_ctrl':
				this.setKey();
				break;

			case 'urlbar_autohide':
				this.autoHide();
				break;

			case 'urlbar_whenfocused':
				this.whenFocused();
				break;
		}
	},

	handleEvent: function(e) {
		switch(e.type) {
			case 'ToggledPuzzleBar':
				this.isActive();
				break;

			case 'PuzzleBarsMoved':
				this.move();
				break;

			case 'beforecustomization':
			case 'aftercustomization':
				this.customize(e);
				break;

			case 'HoverPuzzleBar':
				if(!this.bar._autohide) { break; }

				let dropmarker = this.historydropmarker;
				if(this.bar.hovers) {
					autoHide.setBarListeners(this.bar, dropmarker, true);
					this.bar._autohide.add(dropmarker);
				} else {
					autoHide.setBarListeners(this.bar, dropmarker, false);
					this.bar._autohide.delete(dropmarker);
				}
				break;
		}
	},

	attrWatcher: function() {
		this.brightText();
	},

	setKey: function() {
		if(this.key.keycode != 'none') { Keysets.register(this.key); }
		else { Keysets.unregister(this.key); }
	},

	isActive: function() {
		toggleAttribute(this.container, 'active', !this.bar.collapsed);
	},

	startWidth: 0,
	lastWidth: 0,
	move: function() {
		// Bugfix: Endless loop because width of urlbarBar here is always 0
		if(trueAttribute(document.documentElement, 'disablechrome')) { return; }

		// Bugfix for the add-on being completely cutoff at startup
		if(this.bar.clientWidth == 0) {
			aSync(() => { this.move(); });
			return;
		}

		// if we always reset this sheet, the animation wouldn't happen when toggling on the toolbar
		if(this.lastWidth != this.bar.clientWidth) {
			this.lastWidth = this.bar.clientWidth;

			let sscode = '\
				@namespace url(http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul);\n\
				@-moz-document url("'+document.baseURI+'") {\n\
					window['+objName+'_UUID="'+_UUID+'"] #'+objName+'-urlbar-container[active] {\n\
						width: '+this.bar.clientWidth+'px;\n\
					}\n\
				}';

			Styles.load('urlbarMove_'+_UUID, sscode, true);
		}

		// Bugfix for the add-on being partially cutoff at startup
		if(this.startWidth == 0) {
			this.startWidth = this.bar.clientWidth;
			if(STARTED == APP_STARTUP) {
				aSync(() => {
					if(this.bar.clientWidth != this.startWidth) { this.move(); }
				}, 1000);
			}
		}
	},

	togglePP: function() {
		this.PP.hidden = !Prefs.urlbar_pp;
		toggleAttribute(this.bar, 'hidePP', !Prefs.urlbar_pp);
	},

	autoHide: function() {
		if(Prefs.urlbar_autohide) {
			autoHide.init(this.bar, [this.container, this.PP], this.bar, 'opacity');

			// hovering the urlbar dropmarker should keep the toolbar shown, but only if it was shown already
			Listeners.add(this.bar, 'HoverPuzzleBar', this);
		} else {
			autoHide.deinit(this.bar);
			Listeners.remove(this.bar, 'HoverPuzzleBar', this);
		}
	},

	// only autohide when the location bar is focused
	whenFocused: function() {
		toggleAttribute(gURLBar, objName+'-WhenFocused', Prefs.urlbar_whenfocused);
	},

	customize: function(e) {
		if(e && (e === true || e.type == 'beforecustomization')) {
			Overlays.overlayWindow(window, 'urlbarCustomize');
		} else {
			Overlays.removeOverlayWindow(window, 'urlbarCustomize');
		}
	},

	_parseRGB: /^rgba?\((\d+), (\d+), (\d+)/,

	parseRGB: function(aColorString) {
		let rgb = this._parseRGB.exec(aColorString);
		rgb.shift();
		return { r: parseInt(rgb[0]), g: parseInt(rgb[1]), b: parseInt(rgb[2]) };
	},

	parseLuminance: function(rgb) {
		return 0.2125 * rgb.r + 0.7154 * rgb.g + 0.0721 * rgb.b;
	},

	brightText: function() {
		// We don't actually want to follow the brighttext attribute in the nav-bar, because the background we're interested on is the urlbar's.
		let style = getComputedStyle(gURLBar);
		let rgb = this.parseRGB(style.color);
		let luminance = this.parseLuminance(rgb);
		toggleAttribute(this.bar, 'brighttext', luminance > 110);
	},

	onLoad: function() {
		this.bar._puzzleBar = this;

		Listeners.add(this.bar, 'ToggledPuzzleBar', this);
		Listeners.add(window, 'PuzzleBarsMoved', this);
		Watchers.addAttributeWatcher(gNavBar, 'brighttext', this);

		this.togglePP();
		this.isActive();
		this.move();
		this.whenFocused();
		this.brightText();
		this.autoHide();

		bars.init(this.bar, this.PP);

		Listeners.add(window, 'beforecustomization', this);
		Listeners.add(window, 'aftercustomization', this);
		this.customize(customizing);
	},

	onUnload: function() {
		Listeners.remove(window, 'beforecustomization', this);
		Listeners.remove(window, 'aftercustomization', this);
		Overlays.removeOverlayWindow(window, 'urlbarCustomize');

		Listeners.remove(this.bar, 'ToggledPuzzleBar', this);
		Listeners.remove(window, 'PuzzleBarsMoved', this);
		Watchers.removeAttributeWatcher(gNavBar, 'brighttext', this);

		// deinitialize bar after we've removed all listeners and handlers, so they don't react to this uselessly
		autoHide.deinit(this.bar);
		Listeners.remove(this.bar, 'HoverPuzzleBar', this);
		bars.deinit(this.bar, this.PP);
		removeAttribute(gURLBar, objName+'-WhenFocused');

		delete this.bar._puzzleBar;
	}
};

Modules.LOADMODULE = function() {
	Prefs.listen('urlbar_pp', urlbar);
	Prefs.listen('urlbar_autohide', urlbar);
	Prefs.listen('urlbar_whenfocused', urlbar);
	Prefs.listen('urlbar_keycode', urlbar);
	Prefs.listen('urlbar_accel', urlbar);
	Prefs.listen('urlbar_shift', urlbar);
	Prefs.listen('urlbar_alt', urlbar);
	Prefs.listen('urlbar_ctrl', urlbar);

	urlbar.setKey();

	// Prevent the location bar's flex attribute from taking over and moving stuff when we hover/open the add-on bar in it
	if(locationContainer
	&& searchContainer
	&& locationContainer.parentNode == searchContainer.parentNode
	&& !locationContainer.getAttribute('width')
	&& !searchContainer.getAttribute('width')) {
		urlbar.flexContainers = true;
		setAttribute(locationContainer, 'width', locationContainer.clientWidth);
		setAttribute(searchContainer, 'width', searchContainer.clientWidth);
	}

	Overlays.overlayWindow(window, 'urlbar', urlbar);
};

Modules.UNLOADMODULE = function() {
	Overlays.removeOverlayWindow(window, 'urlbar');
	Styles.unload('urlbarMove_'+_UUID);

	Prefs.unlisten('urlbar_pp', urlbar);
	Prefs.unlisten('urlbar_autohide', urlbar);
	Prefs.unlisten('urlbar_whenfocused', urlbar);
	Prefs.unlisten('urlbar_keycode', urlbar);
	Prefs.unlisten('urlbar_accel', urlbar);
	Prefs.unlisten('urlbar_shift', urlbar);
	Prefs.unlisten('urlbar_alt', urlbar);
	Prefs.unlisten('urlbar_ctrl', urlbar);

	if(urlbar.flexContainers) {
		removeAttribute(locationContainer, 'width');
		removeAttribute(searchContainer, 'width');
	}

	if(UNLOADED || !Prefs.urlbar_bar) {
		Keysets.unregister(urlbar.key);
	}
};
