/*
** Javascript implementation of Minesweeper
** Niclas Kjäll-Ohlsson, copyright 2017
*/
function MineSweeper(rows, columns, num_mines) {
	var rows = (!rows ? 10 : rows);	// Number of cells horizontally
	var columns = (!columns ? 10 : columns);	// Number of cells vertically

	var ml_tab = null; // Mine locations
	var cc_tab = null;	// Cell visibility
	
	var uc = 0; // Number of uncovered cells
	var um = 0; // Number of uncovered mines
	
	var num_mines = (!num_mines ? 18 : num_mines); // Number of mines
	
	var EAST = 1;
	var NORTHEAST = 2;
	var NORTH = 3;
	var NORTHWEST = 4;
	var WEST = 5;
	var SOUTHWEST = 6;
	var SOUTH = 7;
	var SOUTHEAST = 8;

	this.getRows = function() {
		return rows;
	};
	this.getColumns = function() {
		return columns;
	};
	this.getNumMines = function() {
		return num_mines;
	};
	var getNumUncoveredCells = function() {
		return uc;
	};
	this.getNumUncoveredMines = function() {
		return um;
	};
	this.setNumMines = function(num_mines) {
		num_mines = num_mines;
	};
	this.gameOver = function() {
		return (this.getNumUncoveredMines() == this.getNumMines());
	};
	this.cellContents = function(x, y) {
		return ml_tab[x][y];
	};
	this.covered = function(x, y) {
		return cc_tab[x][y];
	};
	this.initialize = function() {
		var randX = 0, randY = 0;
		var mine = true;
		
		ml_tab = new Array(rows+2);
		for(var i=0; i<ml_tab.length; i++) {
			ml_tab[i] = new Array(columns);
		}
		cc_tab = new Array(rows+2);
		for(var i=0; i<ml_tab.length; i++) {
			cc_tab[i] = new Array(columns);
		}

		uc = 0;
		um = 0;

		// Place mines at num_mines random locations
		for(var i=0; i<num_mines; i++) {
			do { // until empty cell is found
				randX = Math.round(Math.random()*(rows-1));
				randY = Math.round(Math.random()*(columns-1));
				if(ml_tab[randX][randY] == -1) { mine = true; }
				else {ml_tab[randX][randY] = -1; mine = false; } // Placing mine here
			} while(mine);
		}
		
		for(var i=0; i<rows; i++) {
			for (var j=0; j<columns; j++) {
				cc_tab[i][j] = true; // Set cell covering to true
				if(ml_tab[i][j] != -1) {
					ml_tab[i][j] = 0;
					if(adjacentValue(i,j,EAST) == -1) ml_tab[i][j]++;
					if(adjacentValue(i,j,NORTHEAST) == -1) ml_tab[i][j]++;
					if(adjacentValue(i,j,NORTH) == -1) ml_tab[i][j]++;
					if(adjacentValue(i,j,NORTHWEST) == -1) ml_tab[i][j]++;
					if(adjacentValue(i,j,WEST) == -1) ml_tab[i][j]++;
					if(adjacentValue(i,j,SOUTHWEST) == -1) ml_tab[i][j]++;
					if(adjacentValue(i,j,SOUTH) == -1) ml_tab[i][j]++;
					if(adjacentValue(i,j,SOUTHEAST) == -1) ml_tab[i][j]++;
				}
			}
		}
	};
	var coveredAdjacentCells = function(x, y) {
		var coveredAdjacentCells = 0;
		if(coveredAdjacentValue(x,y,EAST)) { coveredAdjacentCells++; }
		if(coveredAdjacentValue(x,y,NORTHEAST)) { coveredAdjacentCells++; }
		if(coveredAdjacentValue(x,y,NORTH)) { coveredAdjacentCells++; }
		if(coveredAdjacentValue(x,y,NORTHWEST)) { coveredAdjacentCells++; }
		if(coveredAdjacentValue(x,y,WEST)) { coveredAdjacentCells++; }
		if(coveredAdjacentValue(x,y,SOUTHWEST)) { coveredAdjacentCells++; }
		if(coveredAdjacentValue(x,y,SOUTH)) { coveredAdjacentCells++; }
		if(coveredAdjacentValue(x,y,SOUTHEAST)) { coveredAdjacentCells++; }
		return coveredAdjacentCells;
	};
	var uncoveredMines = function(x, y) {
		var uncoveredMines = 0;
		if(adjacentValue(x,y,EAST) == -1 && !coveredAdjacentValue(x,y,EAST)) { uncoveredMines++; }
		if(adjacentValue(x,y,NORTHEAST) == -1 && !coveredAdjacentValue(x,y,NORTHEAST)) { uncoveredMines++; }
		if(adjacentValue(x,y,NORTH) == -1 && !coveredAdjacentValue(x,y,NORTH)) { uncoveredMines++; }
		if(adjacentValue(x,y,NORTHWEST) == -1 && !coveredAdjacentValue(x,y,NORTHWEST)) { uncoveredMines++; }
		if(adjacentValue(x,y,WEST) == -1 && !coveredAdjacentValue(x,y,WEST)) { uncoveredMines++; }
		if(adjacentValue(x,y,SOUTHWEST) == -1 && !coveredAdjacentValue(x,y,SOUTHWEST)) { uncoveredMines++; }
		if(adjacentValue(x,y,SOUTH) == -1 && !coveredAdjacentValue(x,y,SOUTH)) { uncoveredMines++; }
		if(adjacentValue(x,y,SOUTHEAST) == -1 && !coveredAdjacentValue(x,y,SOUTHEAST)) { uncoveredMines++; }
		return uncoveredMines;
	};
	this.probeCell = function(x, y) {
		if(this.gameOver()) return 0.0;
		if (!cc_tab[x][y]) { return 0.0; }
		uc++;
		if(ml_tab[x][y] == -1) { um++; cc_tab[x][y] = false; return 1.0; }
		if(ml_tab[x][y] > 0) { cc_tab[x][y] = false; return -1.0; }
		if(ml_tab[x][y] == 0) { // check all adjacent cells recursively
			cc_tab[x][y] = false; // Uncover cell	
    		if(coveredAdjacentValue(x,y,EAST)) this.probeCell(x+1,y); // EAST
			if(coveredAdjacentValue(x,y,NORTHEAST)) this.probeCell(x+1,y-1); // NORTHEAST
			if(coveredAdjacentValue(x,y,NORTH)) this.probeCell(x,y-1); // NORTH
			if(coveredAdjacentValue(x,y,NORTHWEST)) this.probeCell(x-1,y-1); // NORTHWEST
			if(coveredAdjacentValue(x,y,WEST)) this.probeCell(x-1,y); // WEST
			if(coveredAdjacentValue(x,y,SOUTHWEST)) this.probeCell(x-1,y+1); // SOUTHWEST
			if(coveredAdjacentValue(x,y,SOUTH)) this.probeCell(x,y+1); // SOUTH
			if(coveredAdjacentValue(x,y,SOUTHEAST)) this.probeCell(x+1,y+1); // SOUTHEAST	
		}
		return 0.0;
	}
	var adjacentValue = function(x, y, dir) {
		try {
			switch(dir) {
				case EAST:
					return ml_tab[x+1][y];
				case NORTHEAST:
					return ml_tab[x+1][y-1];
				case NORTH:
					return ml_tab[x][y-1];
				case NORTHWEST:
					return ml_tab[x-1][y-1];
				case WEST:
					return ml_tab[x-1][y];
				case SOUTHWEST:
					return ml_tab[x-1][y+1];
				case SOUTH:
					return ml_tab[x][y+1];
				case SOUTHEAST:
					return ml_tab[x+1][y+1];
			}
		} catch(e) {
			return -2;
		}
		return -2;
	};
	var coveredAdjacentValue = function(x, y, dir) {
		try {
			switch(dir) {
				case EAST:
					return cc_tab[x+1][y];
				case NORTHEAST:
					return cc_tab[x+1][y-1];
				case NORTH:
					return cc_tab[x][y-1];
				case NORTHWEST:
					return cc_tab[x-1][y-1];
				case WEST:
					return cc_tab[x-1][y];
				case SOUTHWEST:
					return cc_tab[x-1][y+1];
				case SOUTH:
					return cc_tab[x][y+1];
				case SOUTHEAST:
					return cc_tab[x+1][y+1];
			}
			return false;
		} catch(e) {
			return false;
		}
	};
}