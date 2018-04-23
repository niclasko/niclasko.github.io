var Sudoku = function(domainSize) {
	var board;
	
	var sudokuCell = function(domainSize) {
		var value = null;
		var domain = {};
		var initDomain = function() {
			for(var i=0; i<domainSize; i++) {
				domain[i+1] = true;
			}
		};
		initDomain();
		this.value = function() {
			return value;
		};
		this.setValue = function(_value) {
			if(_value && !this.inDomain(_value)) {
				throw "Not allowed!";
			}
			value = _value;
		};
		this.domain = function() {
			return domain;
		};
		this.inDomain = function(value) {
			return domain[value];
		};
		this.updateDomain = function(value, inDomain) {
			if(value) {
				domain[value] = inDomain;
			}
		};
	};
	
	var init = function() {
		board = new Array(9);
		for(var i=0; i<board.length; i++) {
			board[i] = new Array(9);
			for(var j=0; j<board[i].length; j++) {
				board[i][j] = new sudokuCell(9);
			}
		}
	};
	
	var updateDomains = function(_row, _column, value, inDomain) {
		rowStart = Math.floor(_row/3)*3;
		columnStart = Math.floor(_column/3)*3;
		for(var row=rowStart; row<(rowStart+3); row++) {
			for(var column=columnStart; column<(columnStart+3); column++) {
				board[row][column].updateDomain(value, inDomain);
				updateVisibleCellDomain(row, column);
			}
		}
		for(var column=0; column<9; column++) {
			board[_row][column].updateDomain(value, inDomain);
			updateVisibleCellDomain(_row, column);
		}
		for(var row=0; row<9; row++) {
			board[row][_column].updateDomain(value, inDomain);
			updateVisibleCellDomain(row, _column);
		}
	};
	
	init();
	
	this.getCellDomain = function(row, column) {
		return board[row][column].domain();
	};
	this.getCellValue = function(row, column) {
		return board[row][column].value();
	};
	this.setCell = function(row, column, value) {
		if(row < 0 || column < 0 || row > 8 || column > 8) {
			return;
		}
		if(value == null && board[row][column].value() != null) {
			// Add previous cell value back to domains of related cells
			updateDomains(
				row,
				column,
				board[row][column].value(),
				true
			);
			board[row][column].setValue(value);
			updateVisibleCellDomain(row, column);
		}
		if(value) {
			board[row][column].setValue(value);
			// Remove new cell value from domains of related cells
			updateDomains(
				row,
				column,
				board[row][column].value(),
				false
			);
		}
	};
};

