/*!
 * VisualEditor DataModel SourceSurfaceFragment class.
 *
 * @copyright 2011-2016 VisualEditor Team and others; see http://ve.mit-license.org
 */

/**
 * Surface fragment for editing surfaces in source mode.
 *
 * @class
 * @extends ve.dm.SurfaceFragment
 *
 * @constructor
 * @param {ve.dm.Document} doc
 */
ve.dm.SourceSurfaceFragment = function VeDmSourceSurfaceFragment() {
	// Parent constructors
	ve.dm.SourceSurfaceFragment.super.apply( this, arguments );
};

/* Inheritance */

OO.inheritClass( ve.dm.SourceSurfaceFragment, ve.dm.SurfaceFragment );

/**
 * @inheritdoc
 */
ve.dm.SourceSurfaceFragment.prototype.annotateContent = function () {
	var tempFragment, tempSurfaceModel,
		args = arguments,
		fragment = this,
		text = this.getText( true );

	this.convertFromSource( text ).then( function ( selectionDocument ) {
		tempSurfaceModel = new ve.dm.Surface( selectionDocument );
		tempFragment = tempSurfaceModel.getLinearFragment(
			// TODO: Find content offsets
			new ve.Range( 0, selectionDocument.getInternalList().getListNode().getOuterRange().start )
		);
		tempFragment.annotateContent.apply( tempFragment, args );

		fragment.insertDocument( tempFragment.getDocument() );
	} );

	return this;
};

/**
 * @inheritdoc
 */
ve.dm.SourceSurfaceFragment.prototype.convertNodes = function () {
	var tempFragment, tempSurfaceModel,
		args = arguments,
		fragment = this,
		text = this.getText( true );

	this.convertFromSource( text ).then( function ( selectionDocument ) {
		tempSurfaceModel = new ve.dm.Surface( selectionDocument );
		tempFragment = tempSurfaceModel.getLinearFragment(
			// TODO: Find content offsets
			new ve.Range( 0, selectionDocument.getInternalList().getListNode().getOuterRange().start )
		);
		tempFragment.convertNodes.apply( tempFragment, args );

		fragment.insertDocument( tempFragment.getDocument() );
	} );

	return this;
};

/**
 * @inheritdoc
 */
ve.dm.SourceSurfaceFragment.prototype.insertContent = function ( content ) {
	var i, l, data, lines;

	if ( typeof content !== 'string' ) {
		data = new ve.dm.ElementLinearData( new ve.dm.IndexValueStore(), content );
		if ( !data.isPlainText( null, false, [ 'paragraph' ] ) ) {
			this.insertDocument( new ve.dm.Document( content.concat( [ { type: 'internalList' }, { type: '/internalList' } ] ) ) );
			return this;
		}
	} else {
		// Similar to parent method's handling of strings, but doesn't
		// remove empty lines.
		lines = content.split( /\r?\n/ );

		if ( lines.length > 1 ) {
			content = [];
			for ( i = 0, l = lines.length; i < l; i++ ) {
				content.push( { type: 'paragraph' } );
				ve.batchPush( content, lines[ i ].split( '' ) );
				content.push( { type: '/paragraph' } );
			}
		} else {
			content = content.split( '' );
		}
	}

	// Parent method
	return ve.dm.SourceSurfaceFragment.super.prototype.insertContent.call( this, content );
};

/**
 * @inheritdoc
 */
ve.dm.SourceSurfaceFragment.prototype.insertDocument = function ( doc, newDocRange ) {
	var range = this.getSelection().getCoveringRange(),
		fragment = this;

	if ( !range ) {
		return this;
	}

	newDocRange = newDocRange || new ve.Range( 0, doc.getInternalList().getListNode().getOuterRange().start );

	if ( doc.data.isPlainText( newDocRange, false, [ 'paragraph' ] ) ) {
		return ve.dm.SourceSurfaceFragment.super.prototype.insertContent.call( this, doc.data.getDataSlice( newDocRange ) );
	}

	this.convertToSource( doc )
		.done( function ( source ) {
			fragment.removeContent();

			if ( source ) {
				// Parent method
				ve.dm.SourceSurfaceFragment.super.prototype.insertContent.call( fragment, source.trim() );
			}
		} )
		.fail( function () {
			ve.error( 'Failed to convert document', arguments );
		} );

	return this;
};

/**
 * @inheritdoc
 */
ve.dm.SourceSurfaceFragment.prototype.wrapAllNodes = function ( wrapOuter, wrapEach ) {
	var i, node, nodes,
		content,
		range = this.getSelection().getCoveringRange();

	if ( !range ) {
		return this;
	}

	function getOpening( element ) {
		element.internal = {
			whitespace: [ '\n', '\n', '\n', '\n' ]
		};
		return element;
	}

	function getClosing( element ) {
		return { type: '/' + element.type };
	}

	if ( !Array.isArray( wrapOuter ) ) {
		wrapOuter = [ wrapOuter ];
	}

	wrapEach = wrapEach || [];

	if ( !Array.isArray( wrapEach ) ) {
		wrapEach = [ wrapEach ];
	}

	nodes = this.getSelectedLeafNodes();

	content = wrapOuter.map( getOpening );
	for ( i = 0; i < nodes.length; i++ ) {
		node = nodes[ i ];
		content = content
			.concat( wrapEach.map( getOpening ) )
			.concat( this.getSurface().getLinearFragment( node.getRange() ).getText().split( '' ) )
			.concat( wrapEach.reverse().map( getClosing ) );
	}
	content = content.concat( wrapOuter.reverse().map( getClosing ) );

	this.insertContent( content );

	return this;
};

/**
 * Convert model slice to source text
 *
 * The default implementation converts to HTML synchronously.
 *
 * If the conversion is asynchornous it should lock the surface
 * until complete.
 *
 * @param {ve.dm.Document} doc Document
 * @return {jQuery.Promise} Promise with resolves with source, or rejects
 */
ve.dm.SourceSurfaceFragment.prototype.convertToSource = function ( doc ) {
	if ( !doc.data.hasContent() ) {
		return $.Deferred().reject().promise();
	} else {
		return $.Deferred().resolve(
			ve.properInnerHtml(
				ve.dm.converter.getDomFromModel( doc ).body
			)
		).promise();
	}
};

/**
 * Convert source text to model slice
 *
 * The default implementation converts from HTML synchronously.
 *
 * If the conversion is asynchornous it should lock the surface
 * until complete.
 *
 * @param {string} source Source text
 * @return {jQuery.Promise} Promise with resolves with source
 */
ve.dm.SourceSurfaceFragment.prototype.convertFromSource = function ( source ) {
	var lang = this.getDocument().getLang(),
		dir = this.getDocument().getDir();

	if ( !source ) {
		return $.Deferred().resolve(
			new ve.dm.Document(
				[
					{ type: 'paragraph', internal: { generated: 'wrapper' } }, { type: '/paragraph' },
					{ type: 'internalList' }, { type: '/internalList' }
				],
				null, null, null, null,
				lang, dir
			)
		).promise();
	} else {
		return $.Deferred().resolve(
			ve.dm.converter.getModelFromDom(
				ve.createDocumentFromHtml( source, { lang: lang, dir: dir } )
			)
		).promise();
	}
};