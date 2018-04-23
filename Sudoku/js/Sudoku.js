var Sudoku = function(domainSize) {
	var board;
	
	var sudokuCell = function(domainSize) {
		var value = null;
		var domain = {};
		var initDomain = function() {
			for(var i=0; i<domainSize; i++) {
				domain[i+1] = 0;
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
			return domain[value] == 0;
		};
		this.updateDomain = function(value, inDomain) {
			if(value) {
				domain[value] += (inDomain ? -1 : 1);
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
		toUpdate = {};
		rowStart = Math.floor(_row/3)*3;
		columnStart = Math.floor(_column/3)*3;
		for(var row=rowStart; row<(rowStart+3); row++) {
			for(var column=columnStart; column<(columnStart+3); column++) {
				if(!toUpdate[row+";"+column]) {
					toUpdate[row+";"+column] = {"row": row, "column": column};
				}
			}
		}
		for(var column=0; column<9; column++) {
			if(!toUpdate[_row+";"+column]) {
				toUpdate[_row+";"+column] = {"row": _row, "column": column};
			}
		}
		for(var row=0; row<9; row++) {
			if(!toUpdate[row+";"+_column]) {
				toUpdate[row+";"+_column] = {"row": row, "column": _column};
			}
		}
		var cells = Object.values(toUpdate);
		for(var i in cells) {
			board[cells[i].row][cells[i].column].updateDomain(value, inDomain);
			updateVisibleCellDomain(cells[i].row, cells[i].column);
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
			var previousValue = board[row][column].value();
			board[row][column].setValue(value);
			updateDomains(
				row,
				column,
				previousValue,
				true
			);
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
