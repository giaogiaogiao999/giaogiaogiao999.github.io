/**
 * Browser translation mode.
 *
 * Every language shares one URL: the visitor's browser asks a free Google
 * endpoint for the translation and swaps the text in place. Nothing is stored
 * on the server, no translation account is needed and the address never
 * changes. Translations are cached in the browser, so a second visit costs
 * nothing.
 */
( function () {
	'use strict';

	var config = window.fhwpInline;

	if ( ! config || ! config.source ) {
		return;
	}

	var COOKIE = config.cookie || 'fhwp_inline_lang';
	var SOURCE = config.source;
	var TARGETS = config.targets || {};
	var ENDPOINT = 'https://translate.googleapis.com/translate_a/single';
	var HTML_ENDPOINT = 'https://translate-pa.googleapis.com/v1/translateHtml';
	var HTML_KEY = config.key || '';
	var BATCH_SIZE = 20;
	var BATCH_CHARS = 1200;
	var CONCURRENCY = 4;
	var CACHE_LIMIT = 6000;
	var WRAPPER = 'fhwp-lang-block';
	var seoBase = null;
	var MEDIA = config.media || {};
	// Set on a subdirectory page: the language is in the URL, the server has
	// already printed every translation it has, and only what is left is
	// translated here.
	var FIXED = config.fixed || '';
	var SKIP_TAGS = {
		SCRIPT: 1,
		STYLE: 1,
		NOSCRIPT: 1,
		CODE: 1,
		PRE: 1,
		TEXTAREA: 1,
		SVG: 1,
		MATH: 1,
		IFRAME: 1,
		CANVAS: 1,
		TEMPLATE: 1
	};

	/**
	 * Read one cookie value.
	 *
	 * @param {string} name Cookie name.
	 * @return {string} Cookie value.
	 */
	function readCookie( name ) {
		var parts = ( '; ' + document.cookie ).split( '; ' + name + '=' );

		return 2 === parts.length ? decodeURIComponent( parts.pop().split( ';' ).shift() ) : '';
	}

	/**
	 * Remember the visitor's choice.
	 *
	 * @param {string} name  Cookie name.
	 * @param {string} value Cookie value.
	 * @return {void}
	 */
	function writeCookie( name, value ) {
		document.cookie = name + '=' + encodeURIComponent( value ) + ';path=/;max-age=31536000;SameSite=Lax';
	}

	/**
	 * Language the visitor asked for, empty for the original language.
	 *
	 * @return {string} Language code.
	 */
	function chosenLanguage() {
		var code = readCookie( COOKIE );

		return ( code && code !== SOURCE && TARGETS[ code ] ) ? code : '';
	}

	/**
	 * Language the visitor's browser asked for, empty when it was not detected.
	 *
	 * Only used when the visitor has not picked anything yet: the marker cookie
	 * written by the switcher (or by this function) wins from then on.
	 *
	 * @return {string} Language code.
	 */
	function browserLanguage() {
		var code = config.detected || '';

		return ( code && code !== SOURCE && TARGETS[ code ] ) ? code : '';
	}

	/**
	 * Highlight the entry of the language that is on screen.
	 *
	 * @return {void}
	 */
	function markCurrent() {
		var code = FIXED || readCookie( COOKIE );

		if ( ! code || 'source' === code ) {
			code = SOURCE;
		}
		var toggle = document.querySelector( '.fhwp-switcher--collapse .fhwp-switcher__toggle' );
		var toggleLabel = null;

		Array.prototype.forEach.call( document.querySelectorAll( '.fhwp-switcher__link[data-fhwp-lang]' ), function ( link ) {
			var item = link.parentNode;
			var isCurrent = link.getAttribute( 'data-fhwp-lang' ) === code;

			if ( isCurrent ) {
				link.setAttribute( 'aria-current', 'true' );

				if ( toggle ) {
					toggleLabel = link.innerHTML;
				}
			} else {
				link.removeAttribute( 'aria-current' );
			}

			if ( item && item.classList ) {
				item.classList.toggle( 'fhwp-switcher__item--current', isCurrent );
			}
		} );

		// The server cannot know the choice from a cookie, so the collapsed
		// button is relabelled here to show the language that is on screen.
		if ( toggle && toggleLabel ) {
			var caret = toggle.querySelector( '.fhwp-switcher__caret' );

			toggle.innerHTML = toggleLabel;

			if ( caret ) {
				toggle.appendChild( caret );
			}
		}
	}

	/**
	 * Language part of a code: de_DE and de-AT both become de.
	 *
	 * @param {string} code Language code.
	 * @return {string} Language part.
	 */
	function baseCode( code ) {
		return String( code || '' ).toLowerCase().split( /[_-]/ )[ 0 ];
	}

	/**
	 * Whether a comma separated list names the language on screen.
	 *
	 * The server expands the list to codes and prefixes before printing it, but
	 * comparing both the full code and its language part keeps hand written
	 * values working too.
	 *
	 * @param {string} list Comma separated list.
	 * @param {string} code Language code.
	 * @return {boolean} Whether it matches.
	 */
	function listMatches( list, code ) {
		var needle = String( code || '' ).toLowerCase();
		var base = baseCode( needle );
		var tokens = String( list || '' ).toLowerCase().split( ',' );
		var i;

		for ( i = 0; i < tokens.length; i++ ) {
			var token = tokens[ i ].trim();

			if ( '*' === token ) {
				return true;
			}

			if ( token && ( token === needle || token === base || baseCode( token ) === base ) ) {
				return true;
			}
		}

		return false;
	}

	/**
	 * Show or hide the blocks that are limited to certain languages.
	 *
	 * @param {string} code Language code on screen.
	 * @return {void}
	 */
	function applyLanguageBlocks( code ) {
		var blocks = document.querySelectorAll( '.' + WRAPPER );
		var i;

		for ( i = 0; i < blocks.length; i++ ) {
			var block = blocks[ i ];
			var only = block.getAttribute( 'data-fhwp-lang-in' ) || '';
			var never = block.getAttribute( 'data-fhwp-lang-not' ) || '';
			var visible = only ? listMatches( only, code ) : true;

			if ( visible && never && listMatches( never, code ) ) {
				visible = false;
			}

			if ( visible ) {
				block.removeAttribute( 'hidden' );
			} else {
				block.setAttribute( 'hidden', 'hidden' );
			}
		}
	}

	/**
	 * Close a menu the switcher may be sitting in.
	 *
	 * In a mobile header the switcher is an entry of the hamburger menu, and the
	 * theme both toggles its panel on a tap and remembers that state. Clicking a
	 * language would then leave the visitor in front of the theme's (usually
	 * white) full screen menu after the reload, which looks like a blank page.
	 * Every open toggle is closed before the page is reloaded.
	 *
	 * @return {void}
	 */
	function closeMenus() {
		var toggles = document.querySelectorAll( '[aria-expanded="true"]' );
		var i;

		for ( i = 0; i < toggles.length; i++ ) {
			toggles[ i ].setAttribute( 'aria-expanded', 'false' );
		}

		var panels = document.querySelectorAll( '.elementor-menu-toggle--open, .jkit-menu-open, .ekit-menu--open, .sub-menu--open, .dropdown-open, .menu-open, .is-open' );

		for ( i = 0; i < panels.length; i++ ) {
			var node = panels[ i ];

			node.classList.remove( 'elementor-menu-toggle--open', 'jkit-menu-open', 'ekit-menu--open', 'sub-menu--open', 'dropdown-open', 'menu-open', 'is-open' );
		}

		// Elementor themes keep the panel on <body>, so the body class goes too.
		if ( document.body && document.body.classList ) {
			document.body.classList.remove( 'elementor-menu-toggle--open', 'jkit-menu-open', 'ekit-menu--open', 'menu-open', 'dialog-open' );
			document.body.style.overflow = '';
		}
	}

	// The switcher keeps the visitor on the same URL and reloads the page; the
	// translation below then runs with the new choice.
	//
	// The listener runs in the capture phase and stops the event, so the theme
	// never sees the click: in a mobile header the same click would otherwise
	// toggle its own menu panel open (a full screen white overlay) and that panel
	// is often restored from storage on the next page load.
	if ( ! FIXED ) {
		document.addEventListener( 'click', function ( event ) {
			var link = event.target && event.target.closest ? event.target.closest( 'a[data-fhwp-lang]' ) : null;

			if ( ! link ) {
				return;
			}

			var code = link.getAttribute( 'data-fhwp-lang' );

			if ( ! code ) {
				return;
			}

			event.preventDefault();
			event.stopPropagation();

			if ( event.stopImmediatePropagation ) {
				event.stopImmediatePropagation();
			}

			closeMenus();
			// "source" is written on purpose: it records that the visitor decided,
			// so the browser language detection never overrules that choice.
			writeCookie( COOKIE, code === SOURCE ? 'source' : code );
			window.location.reload();
		}, true );
	}

	markCurrent();

	var language = FIXED || chosenLanguage();

	if ( ! FIXED && ! language && ! readCookie( COOKIE ) ) {
		var detected = browserLanguage();

		if ( detected ) {
			language = detected;
			writeCookie( COOKIE, detected );
		}
	}

	applyLanguageBlocks( language || SOURCE );

	if ( ! language ) {
		return;
	}

	var cacheKey = 'fhwp_inline_cache_' + language;
	var cache = loadCache();
	var handled = window.WeakSet ? new WeakSet() : null;
	var saveTimer = 0;

	/**
	 * Read the stored translations for this language.
	 *
	 * @return {Object} Source to translation map.
	 */
	function loadCache() {
		try {
			var raw = window.localStorage.getItem( cacheKey );

			return raw ? JSON.parse( raw ) : {};
		} catch ( e ) {
			return {};
		}
	}

	/**
	 * Store the translations in the background.
	 *
	 * @return {void}
	 */
	function saveCache() {
		window.clearTimeout( saveTimer );
		saveTimer = window.setTimeout( function () {
			try {
				if ( Object.keys( cache ).length > CACHE_LIMIT ) {
					cache = {};
				}

				window.localStorage.setItem( cacheKey, JSON.stringify( cache ) );
			} catch ( e ) {
				// Private mode or a full quota: translating still works, it is
				// just not remembered.
			}
		}, 1500 );
	}

	/**
	 * Whether a text node must be left alone.
	 *
	 * @param {Node} node Text node.
	 * @return {boolean} Whether to skip it.
	 */
	function isSkipped( node ) {
		var parent = node.parentNode;

		if ( ! parent ) {
			return true;
		}

		if ( SKIP_TAGS[ parent.nodeName ] ) {
			return true;
		}

		if ( true === parent.isContentEditable ) {
			return true;
		}

		// The switcher is translated too, so its language names follow the
		// language that is on screen. Only the editor and the admin bar are
		// left alone.
		// data-fhwp-ok marks a block the server already translated on a
		// subdirectory page: sending it to the service again would translate a
		// translation.
		return !!( parent.closest && parent.closest( '.notranslate, [translate="no"], .fhwp-editor, #wpadminbar, .fhwp-inline-skip, [data-fhwp-ok]' ) );
	}

	/**
	 * Text nodes that still need translating.
	 *
	 * @return {Array} Items with node, raw text and trimmed key.
	 */
	function collect() {
		var items = [];
		var root = document.body || document.documentElement;

		if ( ! root || ! document.createTreeWalker ) {
			return items;
		}

		var walker = document.createTreeWalker( root, NodeFilter.SHOW_TEXT, null, false );
		var node = walker.nextNode();

		while ( node ) {
			if ( ! ( handled && handled.has( node ) ) ) {
				var raw = node.nodeValue;
				var key = raw ? raw.trim() : '';

				if ( key.length > 1 && /[A-Za-z]/.test( key ) && /[\u4e00-\u9fff]/.test( key ) === false && ! isSkipped( node ) ) {
					items.push( { node: node, raw: raw, key: key } );
				} else if ( handled ) {
					handled.add( node );
				}
			}

			node = walker.nextNode();
		}

		return items;
	}

	/**
	 * Group texts into requests. Text with a line break is sent on its own,
	 * because the response is mapped back by counting lines.
	 *
	 * @param {Array} texts Source strings.
	 * @return {Array} Batches.
	 */
	function splitTexts( texts ) {
		var batches = [];
		var batch = [];
		var size = 0;

		texts.forEach( function ( text ) {
			if ( text.indexOf( '\n' ) !== -1 ) {
				batches.push( [ text ] );
				return;
			}

			if ( batch.length && ( batch.length >= BATCH_SIZE || size + text.length > BATCH_CHARS ) ) {
				batches.push( batch );
				batch = [];
				size = 0;
			}

			batch.push( text );
			size += text.length + 1;
		} );

		if ( batch.length ) {
			batches.push( batch );
		}

		return batches;
	}

	/**
	 * Ask the translation endpoint for one batch.
	 *
	 * @param {Array} texts Source strings.
	 * @return {Promise<Array|null>} Translated strings, or null on failure.
	 */
	function request( texts ) {
		var body = 'client=gtx'
			+ '&sl=' + encodeURIComponent( config.source2 )
			+ '&tl=' + encodeURIComponent( TARGETS[ language ] )
			+ '&dt=t'
			+ '&q=' + encodeURIComponent( texts.join( '\n' ) );

		return window.fetch( ENDPOINT, {
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
			body: body
		} ).then( function ( response ) {
			return response.json();
		} ).then( function ( data ) {
			var out = '';
			var chunks = data && data[ 0 ] ? data[ 0 ] : [];

			chunks.forEach( function ( chunk ) {
				if ( chunk && typeof chunk[ 0 ] === 'string' ) {
					out += chunk[ 0 ];
				}
			} );

			var parts = out.split( '\n' );

			return parts.length === texts.length ? parts : null;
		} ).catch( function () {
			return null;
		} );
	}

	/**
	 * Turn HTML entities back into plain text.
	 *
	 * @param {string} value Raw value.
	 * @return {string} Decoded value.
	 */
	function decode( value ) {
		return String( value )
			.replace( /&nbsp;/g, ' ' )
			.replace( /&lt;/g, '<' )
			.replace( /&gt;/g, '>' )
			.replace( /&quot;/g, '"' )
			.replace( /&#0?39;/g, "'" )
			.replace( /&amp;/g, '&' );
	}

	/**
	 * Translate one string through Google's HTML endpoint.
	 *
	 * This is the endpoint the GTranslate widget uses. It is the fallback
	 * because it accepts one string at a time and needs the public widget key,
	 * while the batch endpoint above needs neither.
	 *
	 * @param {string} text Source string.
	 * @return {Promise<string|null>} Translation, or null on failure.
	 */
	function requestHtml( text ) {
		if ( ! HTML_KEY ) {
			return Promise.resolve( null );
		}

		return window.fetch( HTML_ENDPOINT, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json+protobuf',
				'X-Goog-Api-Key': HTML_KEY
			},
			body: JSON.stringify( [ [ text, config.source2, TARGETS[ language ] ], 'te_lib' ] )
		} ).then( function ( response ) {
			return response.json();
		} ).then( function ( data ) {
			return ( data && data[ 0 ] && data[ 0 ][ 0 ] ) ? decode( data[ 0 ][ 0 ] ) : null;
		} ).catch( function () {
			return null;
		} );
	}

	/**
	 * Second try for a batch that the batch endpoint refused.
	 *
	 * @param {Array} batch Source strings.
	 * @return {Promise<Array|null>} Translated strings.
	 */
	function runHtmlBatch( batch ) {
		return Promise.all( batch.map( requestHtml ) ).then( function ( parts ) {
			return parts.every( function ( part ) {
				return null !== part;
			} ) ? parts : null;
		} );
	}

	/**
	 * Translate one batch, retrying string by string when the response does not
	 * line up with the request.
	 *
	 * @param {Array} batch Source strings.
	 * @return {Promise<Array|null>} Translated strings.
	 */
	function runBatch( batch ) {
		return request( batch ).then( function ( parts ) {
			if ( parts ) {
				return parts;
			}

			return runHtmlBatch( batch );
		} );
	}

	/**
	 * Put the results into the page.
	 *
	 * @return {void}
	 */
	function apply() {
		collect().forEach( function ( item ) {
			var translated = cache[ item.key ];

			if ( translated && translated !== item.key ) {
				item.node.nodeValue = item.raw.replace( item.key, translated );
			}

			if ( handled ) {
				handled.add( item.node );
			}
		} );
	}

	/**
	 * Translate everything that is not translated yet.
	 *
	 * @return {Promise} Resolves when the page is done.
	 */
	function translatePage() {
		var keys = [];
		var queued = {};

		collect().forEach( function ( item ) {
			if ( cache[ item.key ] || queued[ item.key ] ) {
				return;
			}

			queued[ item.key ] = true;
			keys.push( item.key );
		} );

		var batches = splitTexts( keys );
		var index = 0;

		function next() {
			if ( index >= batches.length ) {
				return Promise.resolve();
			}

			var batch = batches[ index++ ];

			return runBatch( batch ).then( function ( parts ) {
				if ( parts ) {
					batch.forEach( function ( text, i ) {
						if ( parts[ i ] ) {
							cache[ text ] = parts[ i ];
						}
					} );

					saveCache();
				}

				return next();
			} );
		}

		var workers = [];

		for ( var i = 0; i < CONCURRENCY; i++ ) {
			workers.push( next() );
		}

		return Promise.all( workers ).then( apply );
	}

	/**
	 * Translate what the page builder adds after the first run.
	 *
	 * @return {void}
	 */
	function observe() {
		if ( ! window.MutationObserver || ! document.body ) {
			return;
		}

		var timer = 0;

		new window.MutationObserver( function () {
			window.clearTimeout( timer );
			timer = window.setTimeout( function () {
				applyMedia();
				translatePage();
			}, 400 );
		} ).observe( document.body, { childList: true, subtree: true } );
	}

	function start() {
		applyDirection();
		applySeo();
		applyMedia();

		if ( document.body && document.body.classList ) {
			document.body.classList.add( 'fhwp-inline-active' );
		}

		translatePage().then( observe );
	}

	/**
	 * Path of a URL, empty when it is not a URL at all.
	 *
	 * Images are matched by path, so the same pair works whether the theme
	 * writes a full address, a protocol relative one or a path on its own, and
	 * whether or not a caching plugin added a query string.
	 *
	 * @param {string} url URL.
	 * @return {string}
	 */
	function pathOf( url ) {
		if ( ! url ) {
			return '';
		}

		var node = document.createElement( 'a' );

		node.href = url;

		return node.pathname || '';
	}

	/**
	 * Swap the images the language on screen replaces.
	 *
	 * The pairs come from the settings of the plugin: a banner, a product photo
	 * or a logo that has a version of its own in another language. Text is
	 * translated by the engine, images are swapped here - a translation API has
	 * no idea what a picture shows.
	 *
	 * Running twice changes nothing: only source paths are keys of the map, and
	 * a swapped image no longer matches one.
	 *
	 * @return {void}
	 */
	function applyMedia() {
		var pairs = MEDIA[ language ] || {};

		if ( ! Object.keys( pairs ).length ) {
			return;
		}

		/**
		 * Replacement of one URL, the URL itself when it was not replaced.
		 *
		 * @param {string} url URL.
		 * @return {string}
		 */
		function swap( url ) {
			var path = pathOf( url );

			return ( path && pairs[ path ] ) ? pairs[ path ] : url;
		}

		/**
		 * Replacement inside a srcset.
		 *
		 * @param {string} value srcset value.
		 * @return {string}
		 */
		function swapSet( value ) {
			return ( value || '' ).split( ',' ).map( function ( part ) {
				var bits = part.trim().split( /\s+/ );

				if ( bits[ 0 ] ) {
					bits[ 0 ] = swap( bits[ 0 ] );
				}

				return bits.join( ' ' );
			} ).join( ', ' );
		}

		/**
		 * Replacement inside a CSS value.
		 *
		 * @param {string} value CSS.
		 * @return {string}
		 */
		function swapCss( value ) {
			return ( value || '' ).replace( /url\(\s*(['"]?)([^'")]+)\1\s*\)/g, function ( match, quote, url ) {
				var next = swap( url );

				return next === url ? match : 'url(' + quote + next + quote + ')';
			} );
		}

		Array.prototype.forEach.call( document.querySelectorAll( 'img[src]' ), function ( image ) {
			image.setAttribute( 'src', swap( image.getAttribute( 'src' ) ) );

			if ( image.getAttribute( 'srcset' ) ) {
				image.setAttribute( 'srcset', swapSet( image.getAttribute( 'srcset' ) ) );
			}
		} );

		Array.prototype.forEach.call( document.querySelectorAll( 'source[srcset]' ), function ( source ) {
			source.setAttribute( 'srcset', swapSet( source.getAttribute( 'srcset' ) ) );
		} );

		Array.prototype.forEach.call( document.querySelectorAll( '[style*="url("]' ), function ( node ) {
			node.setAttribute( 'style', swapCss( node.getAttribute( 'style' ) ) );
		} );

		// Page builders often put the banner of a section in a style block
		// instead of a style attribute.
		Array.prototype.forEach.call( document.querySelectorAll( 'style' ), function ( node ) {
			var css = node.textContent || '';
			var next = swapCss( css );

			if ( next !== css ) {
				node.textContent = next;
			}
		} );
	}

	/**
	 * First value of a meta tag, empty when the page has none.
	 *
	 * @param {string} attr name or property.
	 * @param {string} key  Tag name.
	 * @return {string}
	 */
	function metaContent( attr, key ) {
		var node = document.head ? document.head.querySelector( 'meta[' + attr + '="' + key + '"]' ) : null;

		return node ? ( node.getAttribute( 'content' ) || '' ) : '';
	}

	/**
	 * Write one meta tag, adding it when the page did not have it yet.
	 *
	 * Tags the page did not have are marked, so switching back removes them
	 * again instead of leaving an empty description behind.
	 *
	 * @param {string} attr  name or property.
	 * @param {string} key   Tag name.
	 * @param {string} value Content, empty to drop the tag.
	 * @return {void}
	 */
	function setMeta( attr, key, value ) {
		var node = document.head ? document.head.querySelector( 'meta[' + attr + '="' + key + '"]' ) : null;

		if ( ! value ) {
			if ( node && '1' === node.getAttribute( 'data-fhwp-seo' ) ) {
				node.parentNode.removeChild( node );
			}

			return;
		}

		if ( ! node ) {
			node = document.createElement( 'meta' );
			node.setAttribute( attr, key );
			node.setAttribute( 'data-fhwp-seo', '1' );
			document.head.appendChild( node );
		}

		node.setAttribute( 'content', value );
	}

	/**
	 * Title, description and keywords of the language on screen.
	 *
	 * The page was sent in the original language, so what the server printed is
	 * remembered first and put back when the visitor returns to that language.
	 *
	 * @return {void}
	 */
	function applySeo() {
		var seo = config.seo || {};

		if ( ! seoBase ) {
			seoBase = {
				title: document.title,
				description: metaContent( 'name', 'description' ),
				keywords: metaContent( 'name', 'keywords' ),
				ogTitle: metaContent( 'property', 'og:title' ),
				ogDescription: metaContent( 'property', 'og:description' )
			};
		}

		var entry = seo[ language ] || {};

		document.title = entry.title || seoBase.title;

		setMeta( 'name', 'description', entry.description || seoBase.description );
		setMeta( 'name', 'keywords', entry.keywords || seoBase.keywords );

		if ( entry.title && seoBase.ogTitle ) {
			setMeta( 'property', 'og:title', entry.title );
		}

		if ( entry.description && seoBase.ogDescription ) {
			setMeta( 'property', 'og:description', entry.description );
		}
	}

	/**
	 * Language and reading direction of the language on screen.
	 *
	 * The page is still the one the server sent, so Arabic, Hebrew or Persian
	 * have to call for the right to left layout themselves: the html element and
	 * the body class both follow the language, and the switcher mirrors with it.
	 *
	 * @return {void}
	 */
	function applyDirection() {
		var dirs = config.dirs || {};
		var dir  = dirs[ language ] || config.sourceDir || 'ltr';
		var root = document.documentElement;

		root.setAttribute( 'lang', TARGETS[ language ] || language );
		root.setAttribute( 'dir', dir );

		if ( document.body && document.body.classList ) {
			document.body.classList.toggle( 'fhwp-rtl', 'rtl' === dir );
		}

		Array.prototype.forEach.call( document.querySelectorAll( '.fhwp-switcher' ), function ( node ) {
			if ( 'rtl' === dir ) {
				node.setAttribute( 'dir', 'rtl' );
				node.classList.add( 'fhwp-switcher--rtl' );
			} else {
				node.removeAttribute( 'dir' );
				node.classList.remove( 'fhwp-switcher--rtl' );
			}
		} );
	}

	if ( 'loading' === document.readyState ) {
		document.addEventListener( 'DOMContentLoaded', start );
	} else {
		start();
	}
} )();
