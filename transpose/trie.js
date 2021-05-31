/*
** Javascript classes to implement Trie/Suffix-tree
** Author: Niclas Kjall-Ohlsson (nkjalloh@cisco.com), Copyright 2013
** 
**Primary use case is autocomplete and string search
** Usage:
**	- var trie = new Trie(): instantiates Trie object
**	- trie.addString(string): adds text to the Trie
**	- trie.query(string): search for string, returns matching strings (matches substrings, anything) as array
*/

// TrieNode class
function TrieNode() {
	this.branch = new Array();
	this.entryPointers = new Array();
}

// Trie class
function Trie (_caseSensitive, _matchSubstrings) {
	
	// Members
	this.trieRootNode = new TrieNode();
	this.entries = new Array();
	this.entryIDs = new Array();
	this.entryIDSequence = 0;
	this.isCaseSensitive = _caseSensitive;
	this.matchSubstrings = _matchSubstrings;
	
	this.trieCharStarts = {};
	
	// Methods
    this.addString = function(_string, _entryIndex) {
		var __string = (this.isCaseSensitive ? _string : _string.toLowerCase());
		var substringSteps = (this.matchSubstrings ? __string.length : 1);
		loading = true;
		for(var i=0; i<substringSteps; i++) {
			this._addString(__string, __string.substring(i, __string.length), this.trieRootNode, 0, _entryIndex);
		}
		loading = false;
	};
	
	this.query = function(_string, _resultsAsLookup) {
		var __string = (this.isCaseSensitive ? _string : _string.toLowerCase());
		if(__string.length == 0) {
			return [];
		}
		var resultsAsLookup = false;
		if(_resultsAsLookup == true) {
			resultsAsLookup = true;
		} else if(_resultsAsLookup == false) {
			resultsAsLookup = false;
		}
		
		var expandedEntries = (!_resultsAsLookup ? new Array() : {});
		
		var startNodes = this.trieCharStarts[__string.charAt(0)];
		
		if(startNodes != undefined) {
			for(var i=0; i<startNodes.length; i++) {
				this._query(startNodes[i], __string.substring(1), resultsAsLookup, expandedEntries);
			}
		}
		
		return expandedEntries;
	};
	
	this._query = function(_rootNode, __string, _resultsAsLookup, expandedEntries) {
		var trieNode = _rootNode;
		var currentChar = '';
		for(var i=0; i<__string.length; i++) {
			currentChar = __string.charAt(i);
			if(currentChar in trieNode.branch) {
				trieNode = trieNode.branch[currentChar];
			} else {
				return [];
			}
		}
		var expandedEntryIDs = this.expandNode(trieNode);
		for(var entryID in expandedEntryIDs) {
			if(!_resultsAsLookup) {
				expandedEntries.push({'entryID': entryID, 'entry': this.entries[entryID]});
			} else {
				expandedEntries[this.entries[entryID]] = expandedEntryIDs[entryID];
			}
		}
	}
	
	this.expandNode = function(_trieNode) {
		var entryList = new Array();
		this._expandNode(_trieNode, entryList);
		return entryList;
	}
	
	this._expandNode = function(_trieNode, _entryList) {
		if(_trieNode.entryPointers.length > 0) {
			for(var i=0; i<_trieNode.entryPointers.length; i++) {
				for(var j=0; j<_trieNode.entryPointers[i].length; j++) {
					if(!(_trieNode.entryPointers[i][j] in _entryList)) {
						_entryList[_trieNode.entryPointers[i][j]] = 1;
					} else {
						_entryList[_trieNode.entryPointers[i][j]]++;
					}
				}
			}
		}
		for(var currentChar in _trieNode.branch) {
			this._expandNode(_trieNode.branch[currentChar], _entryList);
		}
	}
	
	this._addString = function(_baseString, _string, _trieNode, _index, _entryIndex) {
		var currentChar = _string.charAt(_index);
		if(_index < _string.length) {
			if(!(currentChar in _trieNode.branch)) {
				_trieNode.branch[currentChar] = new TrieNode();
				
				if(this.trieCharStarts[currentChar] == undefined) {
					this.trieCharStarts[currentChar] = new Array();
				}
				
				this.trieCharStarts[currentChar].push(_trieNode.branch[currentChar]);
				
			}
			this._addString(_baseString, _string, _trieNode.branch[currentChar], _index+1, _entryIndex);
		} else if(_index == _string.length) {
			
			if(!(_baseString in this.entryIDs)) {
				this.entryIDs[_baseString] = [];
			}
			
			this.entryIDs[_baseString].push(
				(_entryIndex != undefined ? _entryIndex : this.entryIDSequence++)
			);
			this.entries.push(_baseString);
			
			_trieNode.entryPointers.push(this.entryIDs[_baseString]);
		}
	};
	
}