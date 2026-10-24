/**
 * Language switcher behaviour.
 *
 * Links already point at the right URL, so this only remembers the visitor's
 * choice and lets the dropdown variant navigate on change.
 */
( function () {
	'use strict';

	var COOKIE = 'fhwp_language';

	/**
	 * Whether a menu link belongs to the page the visitor is on.
	 *
	 * The active entry is usually painted with the theme accent, and copying
	 * that would leave the switcher highlighted all the time.
	 *
	 * @param {Element} link Menu link.
	 * @return {boolean} Whether the link is the current one.
	 */
	function is_current_link( link ) {
		var node = link;

		while ( node && node.tagName && 'li' !== node.tagName.toLowerCase() ) {
			node = node.parentNode;
		}

		if ( node && node.className && /(^|\s)(current[-_a-z]*|elementor-item-active)(\s|$)/i.test( node.className ) ) {
			return true;
		}

		return 'true' === link.getAttribute( 'aria-current' );
	}

	/**
	 * Copy the theme's menu styling onto the switcher.
	 *
	 * Every theme styles its own menu links with selectors this plugin cannot
	 * know in advance, which leaves the switcher looking foreign next to real
	 * menu entries. Instead of asking each site for custom CSS, the styling is
	 * read from a real menu link in the same list and applied to the switcher,
	 * so it matches whatever theme or page builder rendered the menu.
	 */
	function inherit_menu_style() {
		var items = document.querySelectorAll( 'li.fhwp-menu-item' );
		var text_props = [
			'fontFamily',
			'fontSize',
			'fontWeight',
			'fontStyle',
			'fontVariant',
			'letterSpacing',
			'wordSpacing',
			'textTransform',
			'lineHeight',
			'color'
		];
		var box_props = [ 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft' ];

		if ( ! items.length ) {
			return;
		}

		Array.prototype.forEach.call( items, function ( li ) {
			var list = li.parentNode;

			if ( ! list || ! list.getElementsByTagName ) {
				return;
			}

			var links = list.getElementsByTagName( 'a' );
			var reference = null;
			var fallback = null;
			var i;

			for ( i = 0; i < links.length; i++ ) {
				if ( li.contains( links[ i ] ) ) {
					continue;
				}

				// Skip the entry for the current page: its accent colour is not
				// what a normal menu item looks like.
				if ( is_current_link( links[ i ] ) ) {
					continue;
				}

				if ( null === fallback ) {
					fallback = links[ i ];
				}

				// Prefer a link that is actually visible: hidden clones live in
				// the same list on some page builders.
				if ( links[ i ].offsetWidth || links[ i ].offsetHeight ) {
					reference = links[ i ];
					break;
				}
			}

			reference = reference || fallback;

			if ( ! reference ) {
				return;
			}

			var style = window.getComputedStyle( reference );

			if ( ! style ) {
				return;
			}

			function apply( element, with_box ) {
				if ( ! element ) {
					return;
				}

				var k;

				for ( k = 0; k < text_props.length; k++ ) {
					element.style[ text_props[ k ] ] = style[ text_props[ k ] ];
				}

				if ( with_box ) {
					for ( k = 0; k < box_props.length; k++ ) {
						element.style[ box_props[ k ] ] = style[ box_props[ k ] ];
					}
				}
			}

			apply( li.querySelector( '.fhwp-switcher__toggle' ), true );

			Array.prototype.forEach.call( li.querySelectorAll( '.fhwp-switcher__link' ), function ( link ) {
				apply( link, false );
			} );
		} );
	}

	function boot() {
		inherit_menu_style();

		// Page builders and cache plugins often inject the header after the
		// load event, so look once more shortly after.
		window.setTimeout( inherit_menu_style, 600 );
	}

	if ( 'loading' === document.readyState ) {
		document.addEventListener( 'DOMContentLoaded', boot );
	} else {
		boot();
	}

	window.addEventListener( 'load', inherit_menu_style );

	function remember( lang ) {
		if ( ! lang ) {
			return;
		}

		document.cookie = COOKIE + '=' + encodeURIComponent( lang ) + ';path=/;max-age=31536000;SameSite=Lax';
	}

	document.addEventListener( 'change', function ( event ) {
		var select = event.target;

		if ( ! select || ! select.classList || ! select.classList.contains( 'fhwp-switcher__select' ) ) {
			return;
		}

		var option = select.options[ select.selectedIndex ];

		remember( option ? option.getAttribute( 'data-lang' ) : '' );

		if ( select.value ) {
			window.location.href = select.value;
		}
	} );

	document.addEventListener( 'click', function ( event ) {
		var node = event.target;

		while ( node && node !== document ) {
			if ( node.classList && node.classList.contains( 'fhwp-switcher__link' ) ) {
				remember( node.getAttribute( 'data-fhwp-lang' ) );

				return;
			}

			node = node.parentNode;
		}
	} );
} )();
