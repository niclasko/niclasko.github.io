/*
** Create pivot table transpose from tabular data
** Niclas Kjäll-Ohlsson, Copyright 2013
*/

var MAX_INT = 9007199254740992; // Maximum integer value

function Pivot() {
	
	this.pivotID = Math.floor((Math.random()*2000)+1); // Unique identifier of pivot table
	
	this._self = this; // Self reference to pivot object
	
	this.tabularData; // Tabular data without headers
	this.tabularDataHeader; // Tabular headers
	this.tabularDataHeaderIndexes; // Header name to tabular column index
	
	this.pivotRows; // Tabular column indexes for pivot rows
	this.pivotColumns; // Tabular column indexes for pivot columns
	this.pivotMeasures; // Tabular column indexes for pivot measures
	
	this.dummyMeasureAdded; // Flag to specify whether a dummy measure has been added internally
	
	this.pivotMeasureFormattingOptions; // Measure value formatting options
	this.pivotMeasuresDisplayNamesSortOrder; // Defines the sort order of pivotMeasureDisplayNames
	
	this.pivotRowsDisplayNames; // Field names for pivot rows
	this.pivotColumnsDisplayNames; // Field names for pivot columns
	this.pivotMeasuresDisplayNames; // Field names for pivot measures
	
	this.pivotRowsDisplayNamesIndexes; // Field name for pivot rows to row index
	this.pivotColumnsDisplayNamesIndexes; // Field name for pivot columns to column index
	this.pivotMeasuresDisplayNamesIndexes; // Field name for pivot columns to column index
	
	this.pivotRowTotals; // Row total specifiers
	this.pivotColumnTotals; // Row total specifiers
	
	this.pivotRowDisplayNamesToRowTotalIndexes; // Row display name to row total index
	this.pivotColumnDisplayNamesToColumnTotalIndexes; // Column display name to column total index
	
	this.pivotRowTotalAncestors; // Row to row total pointers
	this.pivotColumnTotalAncestors; // Column to column total pointers
	
	this.rowTotalIndexes; // Hash of pivot matrix indexes that point to row totals
	this.columnTotalIndexes; // Hash of pivot matrix indexes that point to column totals 

	this.ROW_BELOW = 1; // Indicate measure header position at the end (far right) of pivot rows
	this.COLUMN_BELOW = 2; // Indicate measure header position at the end (far right) of pivot columns
	this.ROW_ABOVE = 3; // Indicate measure header position at the beginning (far left) of pivot rows
	this.COLUMN_ABOVE = 4; // Indicate measure header position at the beginning (far left) of pivot columns
	
	this.measureHeaderPlacement = this.COLUMN_BELOW; // Indicates measure header position relative to either pivot rows or columns
	
	this.pivotMatrix; // Transposed matrix of tabular data
	this.pivotMatrixMetadata; // Meta data information about pivotMatrix, e.g. formatting options, whether cell is part of row or column total, etc
	
	this.pivotHiddenRows; // Indexes of pivot matrix rows that are hidden
	this.pivotHiddenColumns; // Indexes of pivot matrix columns that are hidden
	
	this.initialRowIdx; // Pivot matrix row offset for measure value cells
	this.initialColumnIdx; // Pivot matrix column offset for measure value cells
	
	this.rowHash; // Contains transpose of pivot row values and metadata about these
	this.columnHash; // Contains transpose of pivot column values and metadata about these
	this.pivotHash; // Pivot hash - indexed by row key and column key
	
	this.rowHashKeys; // Array of row hash keys
	this.columnHashKeys; // Array of column hash keys
	
	// Number of row hash key groups. Total row hash key count divided by measure count
	// when measure header placement is ROW_ABOVE. Otherwise 1
	this.rowHashGroupCount = 1;
	// Number of column hash key groups. Total column hash key count divided by measure count
	// when measure header placement is COLUMN_ABOVE. Otherwise 1
	this.columnHashGroupCount = 1;
	
	this.HTML = ''; // HTML representation of pivot matrix
	
	this.totalIndicator = 'øøøøøøøøøøøøøøø'; // Total indicator. Also used to sort totals correctly;
	
	// These values indicate display options for measure values
	this.REGULAR = 1; // Display actual measure value
	this.PERCENTAGE_OF_ROW_TOTAL = 2; // Display measure value as percentage of first ancestor row total
	this.PERCENTAGE_OF_COLUMN_TOTAL = 3; // Display measure value as percentage of first ancestor column total
	this.PERCENTAGE_OF_PANE_TOTAL = 4; // Display measure value as percentage of first combined row and column ancestor total
	
	// Specify heatmap calculation - row, column or pane
	this.HEATMAP_ROW = 1;
	this.HEATMAP_COLUMN = 2;
	this.HEATMAP_PANE = 3;
	
	// Used for flagging that a measure header index is an expression and hence not pointing to any header/field index, but -1
	this.MEASURE_INDEX_EXPRESSION_INDICATOR = -1;
	
	this.expressions; // Array of expression functions to be evaluated during pivot matrix rendering (toHTML())
	this.expressionVariables; // Hash table of expression function variables to be set during pivot rendering
	
	this.measureCaption = 'Measure'; // Header name for measure rows
	
	// Default measure value formatting options
	this.defaultFormattingOptions = {
		decimals: 2, // Number of decimals
		factor: 1, // Show measure values in factor units, i.e. [measure value] / this.factor
		displayAs: this.REGULAR, // Set default measure value display option (see above for information about allowed options)
		isExpression: false, // Flags whether this is an arithmetic expression or not. An expression can include calculations involving other fields
		expression: '' // If isExpression is true then this contains the actual arithmetic expression. 
	};
	
	this.timer = new Timer();
	
	this.sortedRowIndexes; // Used for sorting rows
	
	this.globalSelfReferenceVariableName = '___pivot' + this.pivotID; // Used to reference self from dynamically generated code
	this.isGlobalSelfReferenceSet = false; // Has globalSelfReferenceVariableName been set? Only set once
	this.isHeaderFrozen = false; // Flags whether header has been fixed
	this.setHeaderWidthsFunctionName = 'setHeaderWidths' + this.pivotID; // Function name to call to freeze headers (+ pivotID)
	
	this.pivotContainerID; // DOM object ID of pivot table html placeholder
	
	this.isCSSset = false;
	
	this.headerTopPixelOffset = 0; // Pivot header offset from top in pixels
	
	/*
	** Set DOM object ID for pivot table HTML placeholder
	*/
	this.setPivotPlaceHolder = function(placeHolderID) {
		this.pivotContainerID = placeHolderID;
	};
	
	/*
	** Set tabular data, tabular header and initialize supporting pivot data structures
	*/
	this.setupTabularData = function(_tabularData) {
		var tabData = _tabularData.slice();
		this.tabularDataHeader = tabData[0]; // The data headers, a.k.a. field names
		this.tabularData = tabData.splice(1); // The data in tabular form
		
		this.tabularDataHeaderIndexes = new Array();
		
		for(var i=0; i<this.tabularDataHeader.length; i++) {
			this.tabularDataHeaderIndexes[this.tabularDataHeader[i]] = i;
		}
		
		this.initPivot();
	};
	
	/*
	** Set tabular data header only
	** When pivot is used as a query generator
	*/
	this.setTabularDataHeaderOnly = function(_tabularDataHeader, _init) {
		this.tabularDataHeader = _tabularDataHeader.slice(0);
		
		this.tabularDataHeaderIndexes = new Array();
		
		for(var i=0; i<this.tabularDataHeader.length; i++) {
			this.tabularDataHeaderIndexes[this.tabularDataHeader[i]] = i;
		}
		
		if(_init) {
			this.initPivot();
		}
	};
	
	/*
	** Add field to header
	** When pivot is used as a query generator
	*/
	this.addTabularDataHeaderField = function(_field) {
		this.tabularDataHeader.push(_field);
		this.tabularDataHeaderIndexes[_field] = this.tabularDataHeader.length-1;
	};
	
	/*
	** Set tabular data projection
	** When pivot is used as a query generator
	*/
	this.setTabularDataProjection = function(_tabularDataProjection) {
		var data = _tabularDataProjection.slice();
		var dataProjectionHeader = data[0];
		var dataProjectionData = data.splice(1);
		this.tabularData = new Array();
		var tabularData = this.tabularData;
		var row;
		var tabularDataHeaderLength = this.tabularDataHeader.length;
		var tabularDataHeaderIndexes = this.tabularDataHeaderIndexes;
		
		for(var i=0; i<dataProjectionData.length; i++) {
			row = new Array(tabularDataHeaderLength);
			tabularData.push(row);
			for(var j=0; j<dataProjectionHeader.length; j++) {
				row[tabularDataHeaderIndexes[dataProjectionHeader[j]]] = dataProjectionData[i][j];
			}
		}
	};
	
	this.setMeasureHeaderPlacement = function(_placement) {
		this.measureHeaderPlacement = _placement;
	};
	
	/*
	** Initialize supporting pivot data structures
	** Call this prior to any rearrangement of the pivot layout
	*/
	this.initPivot = function() {
		this.pivotRows = new Array();
		this.pivotColumns = new Array();
		this.pivotMeasures = new Array();
		
		this.dummyMeasureAdded = false;
		
		this.pivotMeasureFormattingOptions = new Array();
		
		this.pivotRowsDisplayNames = new Array();
		this.pivotColumnsDisplayNames = new Array();
		this.pivotMeasuresDisplayNames = new Array();
		
		this.pivotMeasuresDisplayNamesSortOrder = new Array();
		
		this.pivotRowsDisplayNamesIndexes = new Array();
		this.pivotColumnsDisplayNamesIndexes = new Array();
		this.pivotMeasuresDisplayNamesIndexes = new Array();
		
		this.pivotRowTotals = new Array();
		this.pivotColumnTotals = new Array();
		
		this.pivotRowDisplayNamesToRowTotalIndexes = new Array();
		this.pivotColumnDisplayNamesToColumnTotalIndexes = new Array();
		
		this.rowTotalIndexes = new Array();
		this.columnTotalIndexes = new Array();
		
		this.pivotRowTotalAncestors = undefined;
		this.pivotColumnTotalAncestors = undefined;
		
		this.expressions = new Array();
		this.expressionVariables = new Array();
	};
	
	this.addRow = function(_headerName, _displayName) {
		this.pivotRows.push(this.tabularDataHeaderIndexes[_headerName]);
		this.pivotRowsDisplayNames.push(_displayName);
		this.pivotRowsDisplayNamesIndexes[_displayName] = this.pivotRows.length-1;
		
		this.setTotalIndicators(this.pivotRows, this.pivotRowTotals, this.pivotRowsDisplayNamesIndexes, 'row');
	};
	
	this.removeRow = function(_displayName) {
		var idx = this.pivotRowsDisplayNamesIndexes[_displayName];
		
		for(var i=idx+1; i<this.pivotRowsDisplayNames.length; i++) {
			this.pivotRowsDisplayNamesIndexes[this.pivotRowsDisplayNames[i]]--;
		}
		
		delete this.pivotRowsDisplayNamesIndexes[_displayName];
		this.pivotRows.splice(idx, 1);
		this.pivotRowsDisplayNames.splice(idx, 1);
		
		this.removeRowSubTotal(_displayName);
		if(this.pivotRows.length == 0) {
			this.removeRowTotal();
		}
		
		this.setTotalIndicators(this.pivotRows, this.pivotRowTotals, this.pivotRowsDisplayNamesIndexes, 'row');
	};
	
	this.rowCount = function() {
		return this.pivotRows.length;
	};
	
	this.sortTotals = function(_totals) {
		_totals.sort(function(a, b) {
			if(a.totalIndicatorCount < b.totalIndicatorCount) {
				return -1;
			}
			if(a.totalIndicatorCount > b.totalIndicatorCount) {
				return 1;
			}
			if(a.totalIndicatorCount == b.totalIndicatorCount) {
				return 0;
			}
		});
	};
	
	this.setTotalIndicators = function(_pivotFields, _pivotTotals, _pivotDisplayNamesIndexes, _rowOrColumn) {
		var idx;
		var entry;
		var totalIndicatorCount;
		for(var i=0; i<_pivotTotals.length; i++) {
			entry = _pivotTotals[i];
			idx = (entry.isGrandTotal ? 0 : _pivotDisplayNamesIndexes[entry.displayName]);
			totalIndicatorCount = 0;
			entry.values = _pivotFields.slice(0);
			for(var j=idx+1; j<_pivotTotals.length; j++) {
				entry.values[j] = this.totalIndicator;
				totalIndicatorCount++;
			}
			if(totalIndicatorCount <= 1) {
				if(_rowOrColumn == 'row') {
					this.removeRowSubTotal(entry.displayName);
				} else if(_rowOrColumn == 'column') {
					this.removeColumnSubTotal(entry.displayName);
				}
			}
			entry.totalIndicatorCount = totalIndicatorCount;
		}
	};
	
	this.addRowSubTotal = function(_displayName) {
		if(this.pivotRowsDisplayNamesIndexes[_displayName] == undefined) {
			return;
		}
		
		var rowIdx = this.pivotRowsDisplayNamesIndexes[_displayName];
		var totalIndicatorCount = 0;
		
		if(rowIdx == this.pivotRows.length-1) { // No point in creating total for most detailed level, assuming most detailed level is last
			return;
		}
		
		// Copy pivot rows to header indexes
		this.pivotRowTotals.push({
			displayName: _displayName,
			values: this.pivotRows.slice(0),
			totalElementCount: (this.pivotRows.length - rowIdx+1),
			isGrandTotal: false
		});
		
		// Set row indexes for subtotal header pointers to total indicator for lower level details than _displayName level
		for(i = rowIdx+1; i<this.pivotRows.length; i++) {
			this.pivotRowTotals[this.pivotRowTotals.length-1].values[i] = this.totalIndicator;
			totalIndicatorCount++;
		}
		
		this.pivotRowTotals[this.pivotRowTotals.length-1].totalIndicatorCount = totalIndicatorCount;
		this.sortTotals(this.pivotRowTotals);
	};
	
	this.removeRowSubTotal = function(_displayName) {
		for(var i=0; i<this.pivotRowTotals.length; i++) {
			if(this.pivotRowTotals[i].displayName == _displayName) {
				this.pivotRowTotals.splice(i,1);
				break;
			}
		}
		this.sortTotals(this.pivotRowTotals);
	};
	
	this.addRowTotal = function() {
		// If there are no pivot rows then don't do this
		if(this.pivotRows.length == 0) {
			return;
		}
		
		var totalIndicatorCount = 0;
		
		// Copy pivot rows to header indexes
		this.pivotRowTotals.push({
			displayName: this.totalIndicator,
			values: this.pivotRows.slice(0),
			totalElementCount: this.pivotRows.length,
			isGrandTotal: true
		});
		
		// Set row indexes for subtotal header pointers to total indicator
		for(i = 0; i<this.pivotRows.length; i++) {
			this.pivotRowTotals[this.pivotRowTotals.length-1].values[i] = this.totalIndicator;
			totalIndicatorCount++;
		}
		this.pivotRowTotals[this.pivotRowTotals.length-1].totalIndicatorCount = totalIndicatorCount;
		this.sortTotals(this.pivotRowTotals);
	};
	
	this.removeRowTotal = function() {
		this.removeRowSubTotal(this.totalIndicator);
	};
	
	this.addColumn = function(_headerName, _displayName) {
		this.pivotColumns.push(this.tabularDataHeaderIndexes[_headerName]);
		this.pivotColumnsDisplayNames.push(_displayName);
		this.pivotColumnsDisplayNamesIndexes[_displayName] = this.pivotColumns.length-1;
		
		this.setTotalIndicators(this.pivotColumns, this.pivotColumnTotals, this.pivotColumnsDisplayNamesIndexes, 'column');
	};
	
	this.removeColumn = function(_displayName) {
		var idx = this.pivotColumnsDisplayNamesIndexes[_displayName];
		
		for(var i=idx+1; i<this.pivotColumnsDisplayNames.length; i++) {
			this.pivotColumnsDisplayNamesIndexes[this.pivotColumnsDisplayNames[i]]--;
		}
		
		delete this.pivotColumnsDisplayNamesIndexes[_displayName];
		this.pivotColumns.splice(idx, 1);
		this.pivotColumnsDisplayNames.splice(idx, 1);
		
		this.removeColumnSubTotal(_displayName);
		if(this.pivotColumns.length == 0) {
			this.removeColumnTotal();
		}
		
		this.setTotalIndicators(this.pivotColumns, this.pivotColumnTotals, this.pivotColumnsDisplayNamesIndexes, 'column');
	};
	
	this.columnCount = function() {
		return this.pivotColumns.length;
	};
	
	this.addColumnSubTotal = function(_displayName) {
		if(this.pivotColumnsDisplayNamesIndexes[_displayName] == undefined) {
			return;
		}
		
		var columnIdx = this.pivotColumnsDisplayNamesIndexes[_displayName];
		var totalIndicatorCount = 0;
		
		if(columnIdx == this.pivotColumns.length-1) { // No point in creating total for most detailed level, assuming most detailed level is last
			return;
		}
		
		// Copy pivot columns to header indexes
		this.pivotColumnTotals.push({
			displayName: _displayName,
			values: this.pivotColumns.slice(0),
			isGrandTotal: false
		});
		
		// Set column indexes for subtotal header pointers to total indicator for lower level details than _displayName level
		for(i = columnIdx+1; i<this.pivotColumns.length; i++) {
			this.pivotColumnTotals[this.pivotColumnTotals.length-1].values[i] = this.totalIndicator;
			totalIndicatorCount++;
		}
		
		this.pivotColumnTotals[this.pivotColumnTotals.length-1].totalIndicatorCount = totalIndicatorCount;
		this.sortTotals(this.pivotColumnTotals);
	};
	
	this.removeColumnSubTotal = function(_displayName) {
		for(var i=0; i<this.pivotColumnTotals.length; i++) {
			if(this.pivotColumnTotals[i].displayName == _displayName) {
				this.pivotColumnTotals.splice(i,1);
				break;
			}
		}
		this.sortTotals(this.pivotColumnTotals);
	};
	
	this.addColumnTotal = function() {
		// If there are no pivot rows then don't do this
		if(this.pivotColumns.length == 0) {
			return;
		}
		
		var totalIndicatorCount = 0;
		
		// Copy pivot rows to header indexes
		this.pivotColumnTotals.push({
			displayName: this.totalIndicator,
			values: this.pivotColumns.slice(0),
			totalElementCount: this.pivotColumns.length,
			isGrandTotal: true
		});
		
		// Set column indexes for subtotal header pointers to total indicator
		for(i = 0; i<this.pivotColumns.length; i++) {
			this.pivotColumnTotals[this.pivotColumnTotals.length-1].values[i] = this.totalIndicator;
			totalIndicatorCount++;
		}
		this.pivotColumnTotals[this.pivotColumnTotals.length-1].totalIndicatorCount = totalIndicatorCount;
		this.sortTotals(this.pivotColumnTotals);
	};
	
	this.removeColumnTotal = function() {
		this.removeColumnSubTotal(this.totalIndicator);
	};
	
	/*
	** Add a pivot measure from the tabular data by specifying a tabular data header/field name or an
	** arithmetic expression involving other measures, and also a display name for the measure.
	** To use other measures in an expression reference them by their display name, e.g. ((Sales-Cost)/Sales)*100.
	** If a display name contains spaces then refer to it within double quotes, e.g. "Sales 123".
	** The display name is also used as a unique identifier which is useful if a measure is playing several roles,
	** e.g. displayed in two different ways.
	** _formattingOptions is a hash table of formatting options and expects the following format:
	** _formattingOptions
	** = {decimals: integer, factor: integer, displayAs: [regular | percentageOfRowTotal | percentageOfColumnTotal], isExpression: true|false}.
	** _formattingOptions can also be left blank in which case the global default
	** formatting options are used.
	*/
	this.addMeasure = function(_headerNameOrExpression, _displayName, _formattingOptions) {
		// If no formatting options are given then use default options
		if(_formattingOptions == undefined) {
			_formattingOptions = clone(this.defaultFormattingOptions);
		}
		// If the _headerNameOrExpression contains an arithmetic expression,
		// as indicated by isExpression, then flag the header measure index accordingly
		// and add the expression to the _formattingOptions hash table to be used in
		// later computations
		if(_formattingOptions.isExpression) {
			this.pivotMeasures.push(this.MEASURE_INDEX_EXPRESSION_INDICATOR);
			_formattingOptions['expression'] = _headerNameOrExpression;
		} else { // Regular measure tabular header reference
			this.pivotMeasures.push(this.tabularDataHeaderIndexes[_headerNameOrExpression]);
		}
		// Keep a reference of measure display names
		this.pivotMeasuresDisplayNames.push(_displayName);
		// Keep a reference of display name indexes in pivotMeasureDisplayNames array
		this.pivotMeasuresDisplayNamesIndexes[_displayName] = this.pivotMeasures.length-1;
		
		// Keep a reference of measure formatting options
		this.pivotMeasureFormattingOptions.push(_formattingOptions);
	};
	
	this.removeMeasure = function(_displayName) {
		var idx = this.pivotMeasuresDisplayNamesIndexes[_displayName];
		
		for(var i=idx+1; i<this.pivotMeasuresDisplayNames.length; i++) {
			this.pivotMeasuresDisplayNamesIndexes[this.pivotMeasuresDisplayNames[i]]--;
		}
		
		this.pivotMeasures.splice(idx, 1);
		this.pivotMeasuresDisplayNames.splice(idx, 1);
		delete this.pivotMeasuresDisplayNamesIndexes[_displayName];
		this.pivotMeasureFormattingOptions.splice(idx, 1);
	};
	
	this.setMeasureFormattingOptions = function(_displayName, _formattingOptionKey, _formattingOptionValue) {
		var idx = this.pivotMeasuresDisplayNamesIndexes[_displayName];
		var formattingOptions = this.pivotMeasureFormattingOptions[idx];
		
		formattingOptions[_formattingOptionKey] = _formattingOptionValue;
	};
	
	this.removeMeasureFormattingOption = function(_displayName, _formattingOptionKey) {
		var idx = this.pivotMeasuresDisplayNamesIndexes[_displayName];
		var formattingOptions = this.pivotMeasureFormattingOptions[idx];
		
		delete formattingOptions[_formattingOptionKey];
	}
	
	this.setMeasurePercentageOfRowTotal = function(_displayName) {
		this.setMeasureFormattingOptions(_displayName, 'displayAs', this.PERCENTAGE_OF_ROW_TOTAL);
	};
	
	this.setMeasurePercentageOfColumnTotal = function(_displayName) {
		this.setMeasureFormattingOptions(_displayName, 'displayAs', this.PERCENTAGE_OF_COLUMN_TOTAL);
	};
	
	this.setMeasurePercentageOfPaneTotal = function(_displayName) {
		this.setMeasureFormattingOptions(_displayName, 'displayAs', this.PERCENTAGE_OF_PANE_TOTAL);
	};
	
	this.measurePercentageClear = function(_displayName) {
		this.setMeasureFormattingOptions(_displayName, 'displayAs', this.REGULAR);
	}
	
	this.setMeasureHeatmapRow = function(_displayName) {
		this.setMeasureFormattingOptions(_displayName, 'HeatMapType', this.HEATMAP_ROW);
	};
	
	this.setMeasureHeatmapColumn = function(_displayName) {
		this.setMeasureFormattingOptions(_displayName, 'HeatMapType', this.HEATMAP_COLUMN);
	};
	
	this.setMeasureHeatmapPane = function(_displayName) {
		this.setMeasureFormattingOptions(_displayName, 'HeatMapType', this.HEATMAP_PANE);
	};
	
	this.clearMeasureHeatmap = function(_displayName) {
		this.removeMeasureFormattingOption(_displayName, 'HeatMapType');
	};
	
	/*
	** If there are no measures then add an empty one just
	** so that rows or columns can be rendered
	*/
	this.addDummyMeasureIfNecessary = function() {
		if(this.pivotMeasures.length == 0) {
			this.addMeasure('','');
			this.dummyMeasureAdded = true;
		}
	};
	
	/*
	** If a real measure has been added and a dummy measure
	** was added in the previous call to transpose then
	** remove the dummy measure
	*/
	this.removeDummyMeasureIfNecessary = function() {
		if(this.dummyMeasureAdded && (
			this.pivotMeasures.length > 1 ||
			(this.pivotRows.length + this.pivotColumns.length == 0 && this.pivotMeasures.length == 1)
			)) {
			for(var i=1; i<this.pivotMeasuresDisplayNames.length; i++) {
				this.pivotMeasuresDisplayNamesIndexes[this.pivotMeasuresDisplayNames[i]]--;
			}
				
			this.pivotMeasures.splice(0,1);
			this.pivotMeasuresDisplayNames.splice(0,1);
			delete this.pivotMeasuresDisplayNamesIndexes[''];
			this.pivotMeasureFormattingOptions.splice(0,1);
			this.dummyMeasureAdded = false;
		}
	};
	
	/*
	** Parse and compile measure expressions into javascript functions and add to expressions array
	*/
	this.parseMeasureExpressions = function() {
		var e;
		var regex;
		var expressionVariableOffsets = new Array();
		var expressionVariableIndexes = new Array();
		for(var i=0; i<this.pivotMeasureFormattingOptions.length; i++) {
			if(this.pivotMeasureFormattingOptions[i].isExpression) {
				e = this.pivotMeasureFormattingOptions[i].expression;
				for(var j=0; j<this.pivotMeasuresDisplayNames.length; j++) {
					if(!this.pivotMeasureFormattingOptions[j].isExpression) {
						regex = new RegExp(this.pivotMeasuresDisplayNames[j], "g");
						if(regex.test(e)) { // Check whether measure expression contains measure display name in question
							
							expressionVariableOffsets.push(
								/*this.pivotMeasuresDisplayNamesIndexes[this.pivotMeasuresDisplayNames[j]]*/j - i
							);
							
							e = e.replace(
								regex,
								'v[' + this.expressionVariables.length + ']'
							);
							
							this.expressionVariables.push(this.expressionVariables.length);
							
							expressionVariableIndexes.push(
								this.expressionVariables.length - 1
							);
						}
					}
				}
				this.expressions.push([
					eval('(function(v) { return ' + e + '; })'),
					// A list of pivot matrix measure value offsets relative to the current measure expression cell
					expressionVariableOffsets,
					expressionVariableIndexes
				]);
				this.pivotMeasureFormattingOptions[i]['expressionIndex'] = this.expressions.length - 1;
			}
		}
	};
	
	/*
	** Construct a list of sub arrays
	*/
	this.subArrayList = function(_array, _list, _listValueKey) {
		var subArrays = new Array();
		for(var i=0; i<_list.length; i++) {
			subArrays.push(this.subArray(_array, (_listValueKey != undefined ? _list[i][_listValueKey] : _list[i])));
		}
		return subArrays;
	};
	
	/*
	** Build a new sub array from _array using indexes from _elements
	*/
	this.subArray = function(_array, _elements) {
		var r = new Array();
		var idx;
		for(var i=0; i<_elements.length; i++) {
			idx = _elements[i];
			if(_array[idx] != undefined) {
				r.push(_array[idx]);
			} else {
				r.push(idx);
			}
		}
		return r;
	};
	
	/*
	** Creates a _rows*_columns matrix
	*/
	this.matrix = function(_rows, _columns) {
		var m = new Array(_rows);
		for(var i=0; i<_rows; i++) {
			m[i] = new Array(_columns);
		}
		return m;
	};
	
	/*
	** n is a number? True or false
	*/
	this.isNumber = function(n) {
	  return !isNaN(parseFloat(n)) && isFinite(n);
	};
	
	/*
	** _row and _column indexes are within measure value cell range? True or false
	*/
	this.isMeasureValueCell = function(_row, _column) {
		return (_row >= this.initialRowIdx && _column >= this.initialColumnIdx);
	};
	
	/*
	** Return HTML represtantion of pivot matrix
	*/
	this.getHTML = function() {
		return this.HTML;
	};
	
	/*
	** Adds a global reference, i.e. Javascript variable, to the document
	** so that dynamically generated code such as sorting can refer to the
	** pivot table object in question
	*/
	this.addGlobalSelfReference = function() {
		if(this.isGlobalSelfReferenceSet) {
			return;
		}
		
		var script = document.createElement('script');
		var src;
	
		src = 'var ' + this.globalSelfReferenceVariableName + ';';
		src += 'function setGSR' + this.pivotID + '(pivotObject) {';
		src += '	' + this.globalSelfReferenceVariableName + ' = pivotObject;';
		src += '}';
		
		script.type = 'text/javascript';
		script.innerHTML = src;
		
		document.getElementsByTagName("head")[0].appendChild(script);
		
		window['setGSR' + this.pivotID].call(this, this._self);
		
		this.isGlobalSelfReferenceSet = true;
	};
	
	/*
	** Adds CSS classes to the document
	** These are used for styling the HTML representation
	** of pivot matrix
	*/
	this.setCSS = function() {
		if(this.isCSSset) {
			return;
		}
		
		var css = document.createElement('style');
		css.type = 'text/css';
		
		var styles = '.bt { font-weight: bold; }';
		styles += ' .tr { text-align: right; }';
		styles += ' .brv { border-top: thin solid; border-bottom: thin solid; border-color: black; }';
		styles += ' .brt { border-bottom: thin solid; border-color: black; }';
		styles += ' .ts { font-family:"Verdana", Verdana, Sans-serif; font-size:x-small; border-spacing:0; border-collapse:collapse; table-layout:fixed; white-space: nowrap; }';
		styles += ' .alt { background-color: #F0F0F0; }';
		styles += ' .fx { position: fixed; background-color: white; box-shadow: 0 4px 3px -3px gray; top: ' + this.headerTopPixelOffset + 'px; }';
		styles += ' img { border-style: none; }';
		
		if (css.styleSheet) css.styleSheet.cssText = styles;
		else css.appendChild(document.createTextNode(styles));
		
		document.getElementsByTagName("head")[0].appendChild(css);
		
		this.isCSSset = true;
	};
	
	this.setHeaderTopPixelOffset = function(_headerTopPixelOffset) {
		this.headerTopPixelOffset = _headerTopPixelOffset;
	};
	
	/*
	** Creates HTML table representation of pivotMatrix
	*/
	this.toHTML = function() {
		
		this.HTML = '';
		
		if((this.pivotRows.length
			+ this.pivotColumns.length
			+ this.pivotMeasures.length) == 0) {
			return;
		}
		
		var id = this.pivotID;
		
		var sort_img_counter = 0, sort_img_id;
		
		//@var timer = this.timer;
		
		this.setCSS();
		this.addGlobalSelfReference();
		
		var html = '<!--div style="overflow-y: auto; height: 100%;"-->';
		html += '<table class="ts" id="___pivotHeader' + id + '"></table>';
		html += '<table class="ts" id="___pivot' + id + '">';
		
		var cellValue, TDspec, TDclass, TDstyle, printedCellValue, transformedCellValue;
		
		var decimals, factor, displayAs;
		
		var cellMetaData, rowAncestor, columnAncestor, paneAncestor, formattingOptions;
		
		var heatMapType;
		
		var isExpression;
		
		var expression;
		
		var alt_counter = 0;
		
		var isRowTotal, isColumnTotal, isTotal;
		
		var rowHashkey, columnHashKey, pivotHashPoint;
		
		var min_value, max_value;
		
		var denominator;
		
		var sri = this.sortedRowIndexes;
		
		var i;
		
		var gsr = this.globalSelfReferenceVariableName; // Used for calling pivot object from dynamically generated code such as sorting
		
		var pivotHash = this.pivotHash;
		var rowHashKey, columnHashKey;
		
		//@timer.begin('Create HTML');
		
		for(var _i=0; _i<this.pivotMatrix.length; _i++) {
			
			// If an alternate sort has been provided for pivot matrix rows by way of a certain column
			if(sri != undefined) {
				i = sri[_i];
			} else {
				i = _i;
			}
			
			if(this.pivotHiddenRows[i]) {
				continue;
			}
			
			if(i == 0) {
				html += '<thead id="___pivotRegularHeader' + id + '">';
			}
			
			if(_i == this.initialRowIdx) {
				html += '<tbody>';
			}
			
			html += '<tr>';
			
			if(isRowTotal) {
				alt_counter = 0;
			} else if(_i > this.initialRowIdx) {
				alt_counter++;
			}
			
			for(var j=0; j<this.pivotMatrix[i].length; j++) {
				
				if(this.pivotHiddenColumns[j]) {
					continue;
				}
				
				TDclass = '';
				
				TDstyle = '';
				
				cellValue = this.pivotMatrix[i][j];
				
				cellMetaData = this.pivotMatrixMetaData[i][j];
				
				isRowTotal = this.rowTotalIndexes[i + '_'];
				
				isColumnTotal = this.columnTotalIndexes[j + '_'];
				
				isTotal = (isRowTotal || isColumnTotal);
				
				if(cellValue == null && cellMetaData == undefined) { // "Dead" pivot matrix cell space
				
					printedCellValue = '&nbsp;';
					
				} else if(cellValue == null && cellMetaData != undefined) {
					
					printedCellValue = '&nbsp;';
					
				} else if(this.isMeasureValueCell(i, j)) { // A measure value matrix cell
					
					formattingOptions = (cellMetaData.formattingOptions != undefined ? cellMetaData.formattingOptions : null);
					
					rowAncestor = cellMetaData.rowTotalAncestor;
					columnAncestor = cellMetaData.columnTotalAncestor;
					paneAncestor = cellMetaData.paneTotalAncestor;
					
					rowHashKey = cellMetaData.rowHashKey;
					columnHashKey = cellMetaData.columnHashKey;
					
					TDclass += ' tr';
					
					decimals = formattingOptions.decimals;
					factor = formattingOptions.factor;
					displayAs = formattingOptions.displayAs;
					
					if(this.isNumber(cellValue)) {
						if (displayAs == this.REGULAR) {
							
							printedCellValue = (cellValue / factor).toFixed(decimals);
							
							transformedCellValue = printedCellValue;
							
						} else if(displayAs == this.PERCENTAGE_OF_ROW_TOTAL) {
							
							denominator = (rowAncestor != null ? rowAncestor.cellValue : cellValue);
							
							if(denominator != 0) {
								
								transformedCellValue = (cellValue / denominator * 100.0).toFixed(decimals);

								printedCellValue = transformedCellValue + '%';
								
							} else {
								
								printedCellValue = '&nbsp;';
								
							}
							
						} else if(displayAs == this.PERCENTAGE_OF_COLUMN_TOTAL) {
							
							denominator = (columnAncestor != null ? columnAncestor.cellValue : cellValue);
							
							if(denominator != 0) {
								
								transformedCellValue = (cellValue / denominator * 100.0).toFixed(decimals);

								printedCellValue = transformedCellValue + '%';
								
							} else {
								
								printedCellValue = '&nbsp;';
								
							}
							
						} else if(displayAs == this.PERCENTAGE_OF_PANE_TOTAL) {
							
							if(paneAncestor != null) {
								
								denominator = paneAncestor.cellValue;
								
							} else if(paneAncestor == null) {
								
								if(isRowTotal && columnAncestor != null) {
									
									denominator = columnAncestor.cellValue;
									
								} else if(isColumnTotal && rowAncestor != null) {
									
									denominator = rowAncestor.cellValue;
									
								} else {
									
									denominator = cellValue;
									
								}
								
							}
							
							if(denominator != 0) {
								
								transformedCellValue = (cellValue / denominator * 100.0).toFixed(decimals);

								printedCellValue = transformedCellValue + '%';
								
							} else {
								
								printedCellValue = '&nbsp;';
								
							}
							
						}
					} else {
						printedCellValue = '&nbsp;';
						
						transformedCellValue = null;
					}
					
					pivotHash[rowHashKey][columnHashKey].transformedCellValue = parseFloat(transformedCellValue);
					
					// Heatmap
					heatMapType = formattingOptions.HeatMapType;
					if(!isTotal && heatMapType != undefined) {
						
						if(heatMapType == this.HEATMAP_ROW && rowAncestor != null) {
							min_value = rowAncestor.min;
							max_value = rowAncestor.max;
						} else if(heatMapType == this.HEATMAP_COLUMN && columnAncestor != null) {
							min_value = columnAncestor.min;
							max_value = columnAncestor.max;
						} else if(heatMapType == this.HEATMAP_PANE && paneAncestor != null) {
							min_value = paneAncestor.min;
							max_value = paneAncestor.max;
						}

						TDstyle = 'background-color: ' + getHeatMapColor(cellValue, min_value, max_value);
						
					}
					
				} else { // A regular pivot row or column header
					
					if(cellValue.replace) {
						printedCellValue = cellValue.replace(this.totalIndicator, 'Total');
						printedCellValue = printedCellValue.replace(/\{\d+\}/g, '');
					} else {
						printedCellValue = '&nbsp;';
					}
					
					if(i == (this.initialRowIdx - 1) && j >= this.initialColumnIdx && !this.dummyMeasureAdded) {
						
						sort_img_id = id + '_' + (sort_img_counter++);
						
						printedCellValue = '<a href="javascript:void(0)"><img id="' + sort_img_id + '" src="sort.png" onclick="GUIsort' +
							this.pivotID + '(this, \'' + this.columnHashKeys[j - this.initialColumnIdx] + '\');"><a/>&nbsp;' + printedCellValue;
					}
					
				}
				
				TDclass += (i < this.initialRowIdx && j >= this.initialColumnIdx ? ' tr' : '');
				
				TDclass += (isTotal ? ' bt' : '');
				
				TDclass += (isRowTotal ? ' brv' : '');
				
				TDclass += (i == (this.initialRowIdx - 1) ? ' brt' : '');
				
				if(i >= this.initialRowIdx && !isRowTotal && (alt_counter % 2) != 0) {
					TDclass += ' alt';
				}
				
				if(TDclass != '') {
					TDspec = '<td class="' + TDclass + '"';
				} else {
					TDspec = '<td';
				}
				
				if(TDstyle != '') {
					TDspec += ' style="' + TDstyle + '"';
				}
				
				if(i <= this.initialRowIdx) {
					TDspec += ' id="c' + i + '_' + j + '">';
				} else {
					TDspec += '>';
				}
				
				html += TDspec + printedCellValue + '</td>';
				
			}
			
			html += '</tr>';
			
			if(_i == this.initialRowIdx) {
				html += '</thead>';
			}
			
		}
		
		html += '</tbody></table><!--/div-->';
		
		if(!this.isHeaderFrozen) {
			html += '<script type="text/javascript">';
			html += '	var frozenHeader' + this.pivotID + ' = undefined;';
			html += '	var sortedColumnImgElementID' + this.pivotID + ';';
			html += '	var pivotTableWidth' + this.pivotID + ';';
			html += '	function ' + this.setHeaderWidthsFunctionName + '() {';
			html += '		var e, d = document;';
			html += '		var widths = new Array(' + this.pivotMatrix[0].length + ');';
			html += '		var rowIdx = ' + this.initialRowIdx + ';';
			html += '		for(var i=0; i<' + this.pivotMatrix[0].length + '; i++) {';
			html += '			e = d.getElementById(\'c\' + rowIdx + \'_\' + i + \'\');';
			html += '			widths[i] = (e != null ? e.offsetWidth : -1);';
			html += '		}';
			html += '		for(var i=0; i<' + this.initialRowIdx + '; i++) {';
			html += '			for(var j=0; j<' + this.pivotMatrix[0].length + ';j++) {';
			html += '				e = d.getElementById(\'c\' + i + \'_\' + j + \'\');';
			html += '				if(e != null) e.style.width = widths[j] + \'px\';';
			html += '			}';
			html += '		}';
			html += '		if(frozenHeader' + this.pivotID + ' != undefined) {';
			html += '			frozenHeader' + this.pivotID + '.innerHTML = frozenHeaderHTML' + this.pivotID + ';';
			html += '			d.getElementById(\'___pivotHeader' + this.pivotID + '\').appendChild(frozenHeader' + this.pivotID + ');';
			html += '		} else {';
			html += '			var header = document.getElementById(\'___pivotRegularHeader' + this.pivotID + '\').cloneNode(true);';
			html += '			header.setAttribute(\'id\', \'___pivotFrozenHeader' + this.pivotID + '\');';
			html += '			header.setAttribute(\'class\', \'fx\');';
			html += '			header.setAttribute(\'className\', \'fx\');';
			html += '			d.getElementById(\'___pivotHeader' + this.pivotID + '\').appendChild(header);';
			html += '			frozenHeader' + this.pivotID + ' = header;';
			html += '			frozenHeaderHTML' + this.pivotID + ' = header.innerHTML;';
			html += '		}';
			html += '	}';
			html += '	' + this.setHeaderWidthsFunctionName + '();';
			
			html += '	function GUIsort' + this.pivotID + '(img, column) {';
			html += '		var sortImg;'
			html += '		if(img.src.indexOf(\'sort.png\') > -1) {';
			html +=	'			img.src = \'sort_desc.png\';';
			html += '			' + gsr + '.sortByColumn(column, 1);';
			html += '		} else if(img.src.indexOf(\'sort_desc.png\') > -1) {';
			html +=	'			img.src = \'sort_asc.png\';';
			html += '			' + gsr + '.sortByColumn(column, -1);';
			html += '		} else {';
			html += '			img.src = \'sort.png\';';
			html += '			' + gsr + '.clearSort();';
			html += '		}';
			html += '		frozenHeaderHTML' + this.pivotID + ' = frozenHeader' + this.pivotID + '.innerHTML;';
			html += '		' + gsr + '.toHTML();';
			html += '		document.getElementById(\'' + this.pivotContainerID + '\').innerHTML = ' + gsr + '.getHTML();';
			html += '		' + this.setHeaderWidthsFunctionName + '();';
			html += '		sortImg = document.getElementById(sortedColumnImgElementID' + this.pivotID + ');';
			html += '		if(sortImg != null && sortImg.id != img.id) {';
			html += '			sortImg.src = \'sort.png\';';
			html += '		}';
			html += '		sortedColumnImgElementID' + this.pivotID + ' = img.id;';
			html += '	}';
			html += '</script>';
			
			this.isHeaderFrozen = true;
		}
		
		//@timer.end('Create HTML');
		
		this.HTML = html;
	};
	
	/*
	** Retrieve all hash keys from _hashTable as array
	*/
	this.getKeys = function(_hashTable) {
		var keys = new Array();
		for(var key in _hashTable) {
			keys.push(key);
		}
		return keys;
	};
	
	/*
	** Sort tree by row value and keep track of sorted row indexes
	*/
	this.sortTree = function(node, sortedRowIndexes, less_than, greater_than) {
		node.sort(
			function(a, b) {
				if(a.value < b.value) return less_than;
				if(a.value > b.value) return greater_than;
				if(a.value == b.value) return 0;
			}
		);
		
		for(var i=0; i<node.length; i++) {
			sortedRowIndexes.unshift(node[i].index);
			this.sortTree(node[i].branch, sortedRowIndexes, less_than, greater_than);
		}
	};
	
	/*
	** Build tree of row values hierarchically organized by root > grandtotal > subtotal1 > value
	*/
	this.buildRowSortTree = function(_columnKey) {
		var rowKeys = this.getKeys(this.rowHash);
		var treeLayers = new Array(this.pivotRowTotals.length + 2);
		var rowKey, ancestorKey, treeNode;
		var ancestors = this.pivotRowTotalAncestors;
		var layer;
		var cellValue, _index;
		var sortStack = new Array();
		
		for(var i=0; i<treeLayers.length; i++) {
			treeLayers[i] = new Array();
		}
		
		treeLayers[0]['root'] = new Array();
		
		for(var i=0; i<rowKeys.length; i++) {
			rowKey = rowKeys[i];
			treeNode = ancestors[rowKey];
			
			cellValue = null;
			
			if(this.pivotHash[rowKey][_columnKey] != undefined) {
				cellValue = this.pivotHash[rowKey][_columnKey].transformedCellValue;
			}
			
			_index = this.rowHash[rowKey].index;
			
			if(treeNode == undefined) {
				layer = 1;
				ancestorKey = 'root';
			} else {
				layer = treeNode.layer + 1;
				ancestorKey = treeNode.ancestorList[0];
			}
			
			if(treeLayers[layer][rowKey] == undefined) {
				treeLayers[layer][rowKey] = new Array();
			}
			
			if(treeLayers[layer-1][ancestorKey] == undefined) {
				treeLayers[layer-1][ancestorKey] = new Array();
			}
			
			if(ancestorKey == rowKey) {
				ancestorKey = 'root';
			}
			
			treeLayers[layer-1][ancestorKey].push({key: rowKey, value: cellValue, index: _index, branch: treeLayers[layer][rowKey]});
		}
		
		return treeLayers[0]['root'];
	};
	
	/*
	** Clear sorting indexes
	*/
	this.clearSort = function() {
		this.sortedRowIndexes = undefined;
	};
	
	/*
	** Sort pivotMatrix by row values in column _columnKey
	** Actually this method provides an overlay sort for
	** pivotMatrix by creating an alternative index mapping
	** Asc = -1, Desc = 1
	*/
	this.sortByColumn = function(_columnKey, _Asc_or_Desc) {
		if(this.columnHash[_columnKey] == undefined) {
			return;
		}
		
		var asc_or_desc = (_Asc_or_Desc != undefined ? _Asc_or_Desc : 1);
		var less_than, greater_than;
		
		if(asc_or_desc == 1) {
			less_than = -1;
			greater_than = 1;
		} else if(asc_or_desc == -1) {
			less_than = 1;
			greater_than = -1;
		} else {
			less_than = -1;
			greater_than = 1;
		}
		
		this.sortedRowIndexes = new Array();
		
		this.sortTree(
			this.buildRowSortTree(_columnKey),
			this.sortedRowIndexes,
			less_than,
			greater_than
		);
		
		for(var i=0; i<this.initialRowIdx; i++) {
			this.sortedRowIndexes.unshift(i);
		}
	};
	
	/*
	** Creates a transpose of the given tabular data and stores in the following way:
	**
	** This is stored in class member this.pivotMatrix which is created by the method below
	**
	** |___|___|_C_|_E_|
	** |___|___|_D_|_F_|
	** | A | B | 1 | 2 |
	** | G | H | 0 | 6 |
	** 
	*/
	this.transpose = function() {
		// Parse and compile measure expressions to functions
		this.parseMeasureExpressions();
		
		// Reset pivot header
		this.isHeaderFrozen = false;
		
		// Clear pivot sort
		this.clearSort();
		
		//@var timer = this.timer;
		
		// Used for hashing pivot row and column indexes and pivot row and column total indexes
		var rowKey, columnKey, rowTotalKey, columnTotalKey, rowTotalKey2, columnTotalKey2;
		var rowValues, columnValues; // Current values for pivot rows and columns
		
		var rowTotals, columnTotals; // Lists of current values for pivot rows and columns with total indicators
		
		var isRowTotal, isColumnTotal; // Temp variables to specify whether row/column denotes a total of some kind
		
		var rowValueList, columnValueList; // Contains lists of current pivot row and column values and sub-totals and totals (if any)
		
		// These indicate the initial offset from pivot rows and columns,
		// i.e. where actual measure cell values commence on the X- and Y-axis of pivot matrix
		// Upon completion of pivot row and column cross product within this method (see below)
		// these will indicate the final size of this.pivotMatrix as number of rows * number of columns
		// respectively
		var rowIdx = this.pivotColumns.length + (this.measureHeaderPlacement == this.COLUMN_BELOW || this.measureHeaderPlacement == this.COLUMN_ABOVE ? 1 : 0),
			columnIdx = this.pivotRows.length + (this.measureHeaderPlacement == this.ROW_BELOW || this.measureHeaderPlacement == this.ROW_ABOVE ? 1 : 0);
		
		var measureTabularIndex; // Used to reference the tabular column index of a measure value
		
		// Keep a reference of initial row and column pivot index offsets. Used for pivot sorting
		this.initialRowIdx = rowIdx;
		this.initialColumnIdx = columnIdx;
		
		this.rowHash = new Array(); // Reference of pivot row keys to pivot matrix indexes and actual transposed row values
		this.columnHash = new Array(); // Reference of pivot column keys to pivot matrix indexes and actual transposed column values
		
		var rowHashKeys, columnHashKeys; // List of row and column hash keys. Used for pivot sorting
		
		this.pivotHash = new Array(); // Pivot hash - indexed by row key and column key. Precursor and driver for pivot matrix contents
		
		var pivotHashPoint; // Used as temporary storage for a pivot hash entry
		
		var _cellValue, currentCellValue; // Used as temporary storage for pivot matrix cell measure value
		
		var rowInfo, columnInfo; // Used to record current this.rowHash and this.columnHash keys when iterating
		
		// Keep track of pivot matrix indexes for expressions
		// that are calculated after "raw" measures have been processed
		var postProcessCells = new Array();
		
		// Keep track of, for a row or column, which row or column total row is an ancestor, i.e. that the row or column rolls up to
		this.pivotRowTotalAncestors = new Array();
		this.pivotColumnTotalAncestors = new Array();
		
		// Reset row and column total indexes used to indicate which pivot matrix rows and columns are totals
		this.rowTotalIndexes = new Array();
		this.columnTotalIndexes = new Array();
		
		var currentRow; // Current row from tabular data
		
		//@timer.begin('Aggregate tabular data to pivot hash');
		
		this.addDummyMeasureIfNecessary();
		this.removeDummyMeasureIfNecessary();
		
		// Iterate through tabular data and
		// aggregate values in pivot hash. See below
		// for detailed descriptions of operations
		for(var i=0; i<this.tabularData.length; i++) {
			
			currentRow = this.tabularData[i];
			
			for(var j=0; j<this.pivotMeasures.length; j++) {
				
				//timer.begin('&nbsp;&nbsp;Ingest data');
				
				rowValueList = new Array();
				columnValueList = new Array();
				
				// These are the transpose combination of rows and values as pointed to by tabular header indexes
				// Here we get the actual values from the current tabular row that we are transposing
				rowValues = this.subArray(currentRow, this.pivotRows);
				columnValues = this.subArray(currentRow, this.pivotColumns);
				
				// These are the transpose combination of rows and values as pointed to by tabular header indexes
				// for sub totals
				// Therefore, here we get the actual values from the current tabular row that we are transposing
				// in addition to total indicators (-1)
				if(this.pivotRowTotals.length > 0) {
					rowTotals = this.subArrayList(currentRow, this.pivotRowTotals, 'values');
				}
				if(this.pivotColumnTotals.length > 0) {
					columnTotals = this.subArrayList(currentRow, this.pivotColumnTotals, 'values');
				}
				
				// Check whether measure headers are part of column values or
				// row values and add to value lists correspondingly
				if(this.measureHeaderPlacement == this.COLUMN_BELOW) {
					
					// Add measure header to the end (far right) of column values
					columnValues.push('{' + j + '}' + this.pivotMeasuresDisplayNames[j]);
					
					// If we have column totals
					if(columnTotals != undefined) {
						for(var k=0; k<columnTotals.length; k++) {
							// Add measure header to the end (far right) of column totals
							columnTotals[k].push('{' + j + '}' + this.pivotMeasuresDisplayNames[j]);
						}
					}
				} else if(this.measureHeaderPlacement == this.COLUMN_ABOVE) {
					
					// Add measure header to beginning (far left) of column values
					columnValues.unshift('{' + j + '}' + this.pivotMeasuresDisplayNames[j]);
					
					// If we have column totals
					if(columnTotals != undefined) {
						for(var k=0; k<columnTotals.length; k++) {
							// Add measure header to beginning (far left) of column totals
							columnTotals[k].unshift('{' + j + '}' + this.pivotMeasuresDisplayNames[j]);
						}
					}
				} else if(this.measureHeaderPlacement == this.ROW_BELOW) {
					
					// Add measure header to beginning (far right) of row values
					rowValues.push('{' + j + '}' + this.pivotMeasuresDisplayNames[j]);
					
					// If we have row totals
					if(rowTotals != undefined) {
						for(var k=0; k<rowTotals.length; k++) {
							// Add measure header to beginning (far right) of row totals
							rowTotals[k].push('{' + j + '}' + this.pivotMeasuresDisplayNames[j]);
						}
					}
				} else if(this.measureHeaderPlacement == this.ROW_ABOVE) {
					
					// Add measure header to beginning (far left) of row values
					rowValues.unshift('{' + j + '}' + this.pivotMeasuresDisplayNames[j]);
					
					// If we have row totals
					if(rowTotals != undefined) {
						for(var k=0; k<rowTotals.length; k++) {
							// Add measure header to beginning (far left) of row totals
							rowTotals[k].unshift('{' + j + '}' + this.pivotMeasuresDisplayNames[j]);
						}
					}
				}
				
				// Add row and column values to list of row and column values
				// to be cross multiplied into pivot hash (see below)
				rowValueList.push({isTotal: false, values: rowValues});
				columnValueList.push({isTotal: false, values: columnValues});
				
				// Add row total values to list of row values
				// to be cross multiplied against all column values and totals
				// into pivot hash (see below)
				if(rowTotals != undefined) {
					for(var k=0; k<rowTotals.length; k++) {
						rowValueList.push({isTotal: true, values: rowTotals[k]});
						
						// Add pointer from row value key to row total ancestor key
						rowKey = rowValues.join();
						if(this.pivotRowTotalAncestors[rowKey] == undefined) {
							this.pivotRowTotalAncestors[rowKey] = {
								ancestorList: new Array(),
								ancestorKeyLookup: new Array(),
								layer: ((rowTotals.length-1) - k + 1)
							};
						}
						rowTotalKey = rowTotals[k].join();
						if(this.pivotRowTotalAncestors[rowKey].ancestorKeyLookup[rowTotalKey] == undefined) {
							this.pivotRowTotalAncestors[rowKey].ancestorKeyLookup[rowTotalKey] =
								this.pivotRowTotalAncestors[rowKey].ancestorList.push(rowTotalKey) - 1;
						}
						
						// Add pointer from row total value key to row total ancestor key or self
						for(var l=k; l<rowTotals.length; l++) {
							rowTotalKey2 = rowTotals[l].join();
							// Only last row total ancestor key should have pointer to self
							if(l < (rowTotals.length-1) && rowTotalKey == rowTotalKey2 && rowTotals.length > 1) {
								continue;
							}
							// If this is the first time we encounter rowTotalKey then add an array of ancestor row keys
							// and a key to array index lookup
							if(this.pivotRowTotalAncestors[rowTotalKey] == undefined) {
								this.pivotRowTotalAncestors[rowTotalKey] = {
									ancestorList: new Array(),
									ancestorKeyLookup: new Array(),
									layer: ((rowTotals.length-1) - k)
								};
							}
							if(this.pivotRowTotalAncestors[rowTotalKey].ancestorKeyLookup[rowTotalKey2] == undefined) {
								this.pivotRowTotalAncestors[rowTotalKey].ancestorKeyLookup[rowTotalKey2] =
									this.pivotRowTotalAncestors[rowTotalKey].ancestorList.push(rowTotalKey2) - 1;
							}
						}
					}
				}
				
				// Add column total values to list of row values
				// to be cross multiplied against all row values and totals
				// into pivot hash (see below)
				if(columnTotals != undefined) {
					for(var k=0; k<columnTotals.length; k++) {
						columnValueList.push({isTotal: true, values: columnTotals[k]});
						
						// Add pointer from column value key to column total ancestor key
						columnKey = columnValues.join();
						if(this.pivotColumnTotalAncestors[columnKey] == undefined) {
							this.pivotColumnTotalAncestors[columnKey] = {
								ancestorList: new Array(),
								ancestorKeyLookup: new Array(),
								layer: ((columnTotals.length-1) - k + 1)
							};
						}
						columnTotalKey = columnTotals[k].join();
						if(this.pivotColumnTotalAncestors[columnKey].ancestorKeyLookup[columnTotalKey] == undefined) {
							this.pivotColumnTotalAncestors[columnKey].ancestorKeyLookup[columnTotalKey] =
								this.pivotColumnTotalAncestors[columnKey].ancestorList.push(columnTotalKey) - 1;
						}
						
						// Add pointer from column total value key to column total ancestor key or self
						for(var l=k; l<columnTotals.length; l++) {
							columnTotalKey2 = columnTotals[l].join();
							// Only last column total ancestor key should have pointer to self
							if(l < (columnTotals.length-1) && columnTotalKey == columnTotalKey2 && columnTotals.length > 1) {
								continue;
							}
							// If this is the first time we encounter columnTotalKey then add an array of ancestor column keys
							// and a key to array index lookup
							if(this.pivotColumnTotalAncestors[columnTotalKey] == undefined) {
								this.pivotColumnTotalAncestors[columnTotalKey] = {
									ancestorList: new Array(),
									ancestorKeyLookup: new Array(),
									layer: ((columnTotals.length-1) - k)
								};
							}
							if(this.pivotColumnTotalAncestors[columnTotalKey].ancestorKeyLookup[columnTotalKey2] == undefined) {
								this.pivotColumnTotalAncestors[columnTotalKey].ancestorKeyLookup[columnTotalKey2] =
									this.pivotColumnTotalAncestors[columnTotalKey].ancestorList.push(columnTotalKey2) - 1;
							}
						}
					}
				}
				
				//@timer.end('&nbsp;&nbsp;Ingest data');
				
				//@timer.begin('&nbsp;&nbsp;Pivot Hashing');
				
				// Calculate cross product of combination of
				// pivot row values and totals against pivot column values and totals
				// and hash to pivot hash
				for(var k=0; k<rowValueList.length; k++) {
					for(var l=0; l<columnValueList.length; l++) {
						
						//@timer.begin('&nbsp;&nbsp;&nbsp;&nbsp;Build keys');
						
						rowKey = rowValueList[k].values.join(); // Build row key string
						columnKey = columnValueList[l].values.join(); // Build column key string
						
						isRowTotal = rowValueList[k].isTotal;
						isColumnTotal = columnValueList[l].isTotal;
						
						if(!(rowKey in this.rowHash)) {
							// Keep a reference to row index in pivot matrix and
							// the actual tabular values to finally be transposed as rows in pivot matrix
							this.rowHash[rowKey] = {index: rowIdx++, values: rowValueList[k].values, isTotal: isRowTotal};
						}
						if(!(columnKey in this.columnHash)) {
							// Keep a reference to column index in pivot matrix and
							// the actual tabular values to finally be transposed as columns in pivot matrix
							this.columnHash[columnKey] = {index: columnIdx++, values: columnValueList[l].values, isTotal: isColumnTotal};
						}
						
						// If we have not seen this row key before then
						// create new hash table (indexed by column key) in pivotHash[rowKey]
						// for column indexes and column values
						if(!(rowKey in this.pivotHash)) {
							this.pivotHash[rowKey] = new Array();
						}
						
						//@timer.end('&nbsp;&nbsp;&nbsp;&nbsp;Build keys');
						
						//@timer.begin('&nbsp;&nbsp;&nbsp;&nbsp;Map reduce');
						
						measureTabularIndex = this.pivotMeasures[j];
						
						if(!(columnKey in this.pivotHash[rowKey])) {
							
							_cellValue = (measureTabularIndex != this.MEASURE_INDEX_EXPRESSION_INDICATOR ?
								parseFloat(this.tabularData[i][measureTabularIndex]) :
								null);
								
							_cellValue = (isNaN(_cellValue) ? null : _cellValue);
							
							// Store actual cell measure value initially (first encounter of combination of rowKey and columnKey)
							if(measureTabularIndex != this.MEASURE_INDEX_EXPRESSION_INDICATOR && !(isRowTotal || isColumnTotal)) {
								this.pivotHash[rowKey][columnKey] = {
									cellValue: _cellValue,
									count: 1,
									min: _cellValue,
									max: _cellValue,
									formattingOptions: this.pivotMeasureFormattingOptions[j],
									isRowTotal: isRowTotal,
									isColumnTotal: isColumnTotal
								};
							} else {
								this.pivotHash[rowKey][columnKey] = {
									cellValue: _cellValue,
									count: 0,
									min: MAX_INT,
									max: (-1*MAX_INT),
									formattingOptions: this.pivotMeasureFormattingOptions[j],
									isRowTotal: isRowTotal,
									isColumnTotal: isColumnTotal
								};
							}
							
						} else {
							// If we have seen this combination of rowKey and columnKey then add cell measure value
							if(measureTabularIndex != this.MEASURE_INDEX_EXPRESSION_INDICATOR) {
								
								_cellValue = parseFloat(this.tabularData[i][measureTabularIndex]);
								
								_cellValue = (isNaN(_cellValue) ? null : _cellValue);
								
								pivotHashPoint = this.pivotHash[rowKey][columnKey];
								
								if(pivotHashPoint.cellValue == null && _cellValue == null) {
									pivotHashPoint.cellValue = _cellValue;
								} else if(pivotHashPoint.cellValue != null || _cellValue != null) {
									pivotHashPoint.cellValue += _cellValue;
								}
								
								/*if(!(isRowTotal || isColumnTotal)) {
									pivotHashPoint.count++;
									if(_cellValue < pivotHashPoint.min) {
										pivotHashPoint.min = _cellValue;
									}
									if(_cellValue > pivotHashPoint.max) {
										pivotHashPoint.max = _cellValue;
									}
								}*/
							}
						}
						
						//@timer.end('&nbsp;&nbsp;&nbsp;&nbsp;Map reduce');
						
					}
				}
				
				//@timer.end('&nbsp;&nbsp;Pivot Hashing');
				
			}
		}
		
		//@timer.end('Aggregate tabular data to pivot hash');
		
		//@timer.begin('Sort and rearrange pivot hash keys');
		
		rowHashKeys = this.getKeys(this.rowHash).sort();
		columnHashKeys = this.getKeys(this.columnHash).sort();
		
		this.rowHashKeys = rowHashKeys;
		this.columnHashKeys = columnHashKeys;
		
		// Rearrange row hash keys to pivot matrix row indexes according to sort
		for(var i=0; i<rowHashKeys.length; i++) {
			this.rowHash[rowHashKeys[i]].index = (i + this.initialRowIdx);
			
			// Keep reference of which pivot matrix row indexes point to row totals
			if(this.rowHash[rowHashKeys[i]].isTotal) {
				this.rowTotalIndexes[this.rowHash[rowHashKeys[i]].index + '_'] = true;
			}
		}
		
		// Rearrange row hash keys to pivot matrix column indexes according to sort
		for(var i=0; i<columnHashKeys.length; i++) {
			this.columnHash[columnHashKeys[i]].index = (i + this.initialColumnIdx);
			
			// Keep reference of which pivot matrix row indexes point to row totals
			if(this.columnHash[columnHashKeys[i]].isTotal) {
				this.columnTotalIndexes[this.columnHash[columnHashKeys[i]].index + '_'] = true;
			}
		}
		
		// Create actual pivot matrix where transpose result will be stored
		this.pivotMatrix = this.matrix(rowIdx, columnIdx);
		// Create pivot meta data matrix where keys to this.rowHash and this.columnHash are stored for each pivot matrix cell
		// This enables lookup of metadata information from this.rowHash and this.columnHash
		this.pivotMatrixMetaData = this.matrix(rowIdx, columnIdx);
		
		// Set null for upper left corner "dead" space in pivot matrix
		for(var i=0; i<rowIdx; i++) {
			for(var j=0; j<columnIdx; j++) {
				this.pivotMatrix[i][j] = null;
			}
		}
		
		// Set row headers
		var offset = 0;
		if(this.measureHeaderPlacement == this.ROW_ABOVE) {
			if(this.pivotMatrix[this.initialRowIdx-1] != undefined) {
				this.pivotMatrix[this.initialRowIdx-1][0] = this.measureCaption;
				offset = 1;
			}
		} else if(this.measureHeaderPlacement == this.ROW_BELOW) {
			if(this.pivotMatrix[this.initialRowIdx-1] != undefined) {
				this.pivotMatrix[this.initialRowIdx-1][this.initialColumnIdx-1] = this.measureCaption;
			}
		}
		
		if(this.pivotMatrix[this.initialRowIdx-1] != undefined) {
			for(var i=0; i<this.pivotRowsDisplayNames.length; i++) {
				this.pivotMatrix[this.initialRowIdx-1][i+offset] = this.pivotRowsDisplayNames[i];
			}
		}
		
		// Arrays to keep track of hidden row and column indexes
		this.pivotHiddenRows = new Array(rowIdx);
		this.pivotHiddenColumns = new Array(columnIdx);
		
		//@timer.end('Sort and rearrange pivot hash keys');
		
		//@timer.begin('Setup pivot matrix');
		
		// Hash cartesian combination of pivot row keys and pivot column keys
		// into pivot matrix
		for(rowKey in this.rowHash) {
			rowInfo = this.rowHash[rowKey]; // Retrieve row index for pivot matrix and actual row values
			
			// Remove measure header sorting helpers
			if(this.measureHeaderPlacement == this.ROW_BELOW) {
				rowInfo.values[rowInfo.values.length-1] =
					rowInfo.values[rowInfo.values.length-1].replace(/\{\d+\}/g, '');
			}
			if(this.measureHeaderPlacement == this.ROW_ABOVE) {
				rowInfo.values[0] = rowInfo.values[0].replace(/\{\d+\}/g, '');
			}
			
			// Transpose actual row values onto pivot matrix as specified by row index (rowInfo.index)
			for(var i=0; i<rowInfo.values.length; i++) {
				this.pivotMatrix[rowInfo.index][i] = rowInfo.values[i];
			}
			
			for(columnKey in this.columnHash) {
				columnInfo = this.columnHash[columnKey]; // Retrieve column index for pivot matrix and actual column values
				
				// Remove measure header sorting helpers
				if(this.measureHeaderPlacement == this.COLUMN_BELOW) {
					columnInfo.values[columnInfo.values.length-1] =
						columnInfo.values[columnInfo.values.length-1].replace(/\{\d+\}/g, '');
				}
				if(this.measureHeaderPlacement == this.COLUMN_ABOVE) {
					columnInfo.values[0] = columnInfo.values[0].replace(/\{\d+\}/g, '');
				}
				
				// Transpose actual column values onto pivot matrix as specified by column index (columnInfo.index)
				for(var i=0; i<columnInfo.values.length; i++) {
					this.pivotMatrix[i][columnInfo.index] = columnInfo.values[i];
				}
				
				pivotHashPoint = this.pivotHash[rowKey][columnKey];
				
				// Set measure cell values in pivot matrix and cell metadata in pivot matrix metadata
				// according to row and column indexes (rowTuple.index and columnTuple.index)
				if(pivotHashPoint != undefined) {
					if(this.isNumber(pivotHashPoint.cellValue) || pivotHashPoint.formattingOptions.isExpression) {
						this.pivotMatrix[rowInfo.index][columnInfo.index] = pivotHashPoint.cellValue;
						this.pivotMatrixMetaData[rowInfo.index][columnInfo.index] = {
							formattingOptions: pivotHashPoint.formattingOptions,
							rowHashKey: rowKey,
							columnHashKey: columnKey,
							isTotal: rowInfo.isTotal || columnInfo.isTotal,
							isRowTotal: rowInfo.isTotal,
							isColumnTotal: columnInfo.isTotal,
							rowTotalAncestor: null,
							columnTotalAncestor: null,
							paneTotalAncestor: null,
							isBlank: false
							};
						if(pivotHashPoint.formattingOptions.hidden) {
							if(this.measureHeaderPlacement == this.ROW_BELOW ||
								this.measureHeaderPlacement == this.ROW_ABOVE) {
								this.pivotHiddenRows[rowInfo.index] = true;
							}
							if(this.measureHeaderPlacement == this.COLUMN_BELOW ||
								this.measureHeaderPlacement == this.COLUMN_ABOVE) {
								this.pivotHiddenColumns[columnInfo.index] = true;
							}
						}
						
						// Add to post processing list
						if(pivotHashPoint.formattingOptions.isExpression) {
							
							postProcessCells.push([
								true, // Is Expression
								pivotHashPoint.formattingOptions.expressionIndex, // Expression id
								rowInfo.index, // Pivot Matrix row index
								columnInfo.index, // Pivot Matrix column index
								rowKey, // Pivot Hash row key
								columnKey, // Pivot Hash column
								this.pivotRowTotalAncestors[rowKey], // Pivot Hash row ancestor key
								this.pivotColumnTotalAncestors[columnKey], // Pivot Hash column ancestor key
								false // isBlank
							]);
							
						}
						
						// Add pivot measure value to list of cells to be processed after first step data aggregation
						// This is necessary if only a subset of the data fields are aggregated in which case a
						// a direct first step stats calculation would yield wrong relationship between measure values
						// and totals
						if(this.pivotRowTotalAncestors[rowKey] != undefined ||
							this.pivotColumnTotalAncestors[columnKey] != undefined) {
								
							postProcessCells.push([
								false, // Is Expression
								-1, // Expression id
								rowInfo.index, // Pivot Matrix row index
								columnInfo.index, // Pivot Matrix column index
								rowKey, // Pivot Hash row key
								columnKey, // Pivot Hash column
								this.pivotRowTotalAncestors[rowKey], // Pivot Hash row ancestor key
								this.pivotColumnTotalAncestors[columnKey], // Pivot Hash column ancestor key
								false // isBlank
							]);
							
						}
						
					}
				} else {
					
					this.pivotMatrix[rowInfo.index][columnInfo.index] = null;
					
					this.pivotMatrixMetaData[rowInfo.index][columnInfo.index] = {
						formattingOptions: null,
						rowHashKey: rowKey,
						columnHashKey: columnKey,
						isTotal: rowInfo.isTotal || columnInfo.isTotal,
						isRowTotal: rowInfo.isTotal,
						isColumnTotal: columnInfo.isTotal,
						rowTotalAncestor: null,
						columnTotalAncestor: null,
						paneTotalAncestor: null,
						isBlank: true
					};
					
					postProcessCells.push([
						false, // Is Expression
						-1, // Expression id
						rowInfo.index, // Pivot Matrix row index
						columnInfo.index, // Pivot Matrix column index
						rowKey, // Pivot Hash row key
						columnKey, // Pivot Hash column
						this.pivotRowTotalAncestors[rowKey], // Pivot Hash row ancestor key
						this.pivotColumnTotalAncestors[columnKey], // Pivot Hash column ancestor key
						true // isBlank
					]);
					
				}
				
			}
		}
		
		// Total row hash key count divided by measure count
		// Used for correctly offsetting expression variable pointers in pivot matrix
		if(this.measureHeaderPlacement == this.ROW_ABOVE) {
			this.rowHashGroupCount = this.getKeys(this.rowHash).length / this.pivotMeasures.length;
		}
		
		// Total column hash key count divided by measure count
		// Used for correctly offsetting expression variable pointers in pivot matrix
		if(this.measureHeaderPlacement == this.COLUMN_ABOVE) {
			this.columnHashGroupCount = this.getKeys(this.columnHash).length / this.pivotMeasures.length;
		}
		
		// Process expressions
		var _c; // Current process cell
		// Process cell item lookup indexes
		var IS_EXPRESSION = 0,
			EXPRESSION_IDX = 1,
			ROW_IDX = 2,
			COLUMN_IDX = 3,
			ROW_KEY = 4,
			COLUMN_KEY = 5,
			ROW_ANCESTOR_KEY = 6,
			COLUMN_ANCESTOR_KEY = 7,
			IS_BLANK = 8;
		// Expression item component lookup indexes
		var COMPILED_EXPRESSION = 0,
			VARIABLE_OFFSETS = 1,
			VARIABLE_INDEXES = 2;
		var calculatedValue; // Result of expression calculation
		var ancestorPivotPoint; // Temporary variable for row/column ancestor total pivot hash point
		var pivotMatrixMetaDataEntry;
		for(var i=0; i<postProcessCells.length; i++) {
			_c = postProcessCells[i];
			
			if(_c[IS_EXPRESSION]) {
				expression = this.expressions[_c[EXPRESSION_IDX]];

				for(var k=0; k<expression[VARIABLE_INDEXES].length; k++) {
					// Set expression variables
					if(this.measureHeaderPlacement == this.ROW_ABOVE || this.measureHeaderPlacement == this.ROW_BELOW) {
						this.expressionVariables[expression[VARIABLE_INDEXES][k]] =
							this.pivotMatrix[_c[ROW_IDX] + (expression[VARIABLE_OFFSETS][k] * this.rowHashGroupCount)][_c[COLUMN_IDX]];
					}

					// Set expression variables
					if(this.measureHeaderPlacement == this.COLUMN_ABOVE || this.measureHeaderPlacement == this.COLUMN_BELOW) {
						this.expressionVariables[expression[VARIABLE_INDEXES][k]] =
							this.pivotMatrix[_c[ROW_IDX]][_c[COLUMN_IDX] + (expression[VARIABLE_OFFSETS][k] * this.columnHashGroupCount)];
					}

				}

				// Calculate expression with set variables
				calculatedValue = expression[COMPILED_EXPRESSION](this.expressionVariables);
				this.pivotMatrix[_c[ROW_IDX]][_c[COLUMN_IDX]] = calculatedValue;
				this.pivotHash[_c[ROW_KEY]][_c[COLUMN_KEY]].cellValue = calculatedValue;
			}
			
			_cellValue = this.pivotMatrix[_c[ROW_IDX]][_c[COLUMN_IDX]];
			pivotMatrixMetaDataEntry = this.pivotMatrixMetaData[_c[ROW_IDX]][_c[COLUMN_IDX]];
			
			// Set row and column total statistics (max, min, count, etc)
			// Set stats for row total ancestor
			if(_c[ROW_ANCESTOR_KEY] != undefined) {
				if(_c[ROW_ANCESTOR_KEY].ancestorList.length > 0) {
					
					rowTotalKey = _c[ROW_ANCESTOR_KEY].ancestorList[0];
					
					if(rowTotalKey != _c[ROW_KEY]) {
						ancestorPivotPoint = this.pivotHash[rowTotalKey][_c[COLUMN_KEY]];
						
						if(!_c[IS_BLANK] && !(ancestorPivotPoint.isRowTotal && ancestorPivotPoint.isColumnTotal)) {
							ancestorPivotPoint.count++;

							if(_cellValue > ancestorPivotPoint.max) {
								ancestorPivotPoint.max = _cellValue;
							}

							if(_cellValue < ancestorPivotPoint.min) {
								ancestorPivotPoint.min = _cellValue;
							}
						}
						
						// Keep a reference of row total stats for each regular cell
						if(pivotMatrixMetaDataEntry.rowTotalAncestor == null) {
							pivotMatrixMetaDataEntry.rowTotalAncestor = ancestorPivotPoint;
						}
						
					}
				}
			}
			
			// Set stats for column total ancestor
			if(_c[COLUMN_ANCESTOR_KEY] != undefined) {
				if(_c[COLUMN_ANCESTOR_KEY].ancestorList.length > 0) {
					
					columnTotalKey = _c[COLUMN_ANCESTOR_KEY].ancestorList[0];
					
					if(columnTotalKey != _c[COLUMN_KEY]) {
						ancestorPivotPoint = this.pivotHash[_c[ROW_KEY]][_c[COLUMN_ANCESTOR_KEY].ancestorList[0]];
						
						if(!_c[IS_BLANK] && !(ancestorPivotPoint.isRowTotal && ancestorPivotPoint.isColumnTotal)) {
							ancestorPivotPoint.count++;

							if(_cellValue > ancestorPivotPoint.max) {
								ancestorPivotPoint.max = _cellValue;
							}

							if(_cellValue < ancestorPivotPoint.min) {
								ancestorPivotPoint.min = _cellValue;
							}
						}
						
						// Keep a reference of column total stats for each regular cell
						if(pivotMatrixMetaDataEntry.columnTotalAncestor == null) {
							pivotMatrixMetaDataEntry.columnTotalAncestor = ancestorPivotPoint;
						}
					}
				}
			}
			
			// Set stats for pane total ancestor
			if(_c[ROW_ANCESTOR_KEY] != undefined && _c[COLUMN_ANCESTOR_KEY] != undefined) {
				if(_c[ROW_ANCESTOR_KEY].ancestorList.length > 0 && _c[COLUMN_ANCESTOR_KEY].ancestorList.length > 0) {
					
					rowTotalKey = _c[ROW_ANCESTOR_KEY].ancestorList[0];
					columnTotalKey = _c[COLUMN_ANCESTOR_KEY].ancestorList[0];
					
					if(rowTotalKey != _c[ROW_KEY] && columnTotalKey != _c[COLUMN_KEY]) {
						ancestorPivotPoint = this.pivotHash[_c[ROW_ANCESTOR_KEY].ancestorList[0]][_c[COLUMN_ANCESTOR_KEY].ancestorList[0]];
						
						if(!_c[IS_BLANK]) {
							ancestorPivotPoint.count++;

							if(_cellValue > ancestorPivotPoint.max) {
								ancestorPivotPoint.max = _cellValue;
							}

							if(_cellValue < ancestorPivotPoint.min) {
								ancestorPivotPoint.min = _cellValue;
							}
						}
						
						// Keep a reference of pane total stats for each regular cell
						if(pivotMatrixMetaDataEntry.paneTotalAncestor == null) {
							pivotMatrixMetaDataEntry.paneTotalAncestor = ancestorPivotPoint;
						}
					}
				}
			}
			
		}
		
		//@timer.end('Setup pivot matrix');
		
	};
}


// Heatmap functionality below

var scale = ['#f1f2f0', '#eff1ed', '#edf0ea', '#ecefe8', '#eaefe5', '#e8eee3', '#e7ede0', '#e5edde', '#e4ecdb', '#e2ebd9', '#e0ead6', '#dfead4', '#dde9d1', '#dbe8cf', '#dae8cc', '#d8e7ca', '#d6e6c8', '#d5e5c5', '#d3e5c3', '#d1e4c0', '#d0e3be', '#cee3bc', '#cce2b9', '#cbe1b7', '#c9e0b5', '#c7e0b2', '#c6dfb0', '#c4deae', '#c2deab', '#c1dda9', '#bfdca7', '#bddba5', '#bcdba2', '#badaa0', '#b8d99e', '#b7d99c', '#b5d89a', '#b3d797', '#b2d695', '#b0d693', '#aed591', '#add48f', '#abd48d', '#a9d38a', '#a8d288', '#a6d186', '#a5d184', '#a3d082', '#a1cf80', '#a0cf7e'];

function getHeatMapColor(value, min_value, max_value) {
	if(value == 0) {
		return '#FFFFFF';
	}
	var span = (max_value - min_value);
	var middle = 0.5;
	var p = (value - min_value)/span;
	
	var idx = Math.round(Math.abs(p)*(scale.length-1));
	
	return scale[idx];
}

// Clone associative array
function clone(obj) {
    if (null == obj || "object" != typeof obj) return obj;
    var copy = obj.constructor();
    for (var attr in obj) {
        if (obj.hasOwnProperty(attr)) copy[attr] = obj[attr];
    }
    return copy;
}