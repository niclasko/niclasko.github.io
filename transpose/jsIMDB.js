/*
**
*	Javascript In-memory analytics engine
*		- Aggregate multi-dimensional datasets fast
*		- Generate decision trees based on the ID3 algorithm
*
*	All code and desigh by Niclas Kjäll-Ohlsson*
*	Copyright 2013
*
*	*except for:
*		function getWeekNumber
*
**/

importScripts(
	'moment.min.js',
	'timer.js'
);

var chars = 'abcdefghijklmnopqrstuvwxyzæøå';
var charPositions = {};

for(var i=0; i<chars.length; i++) {
	charPositions[chars.charAt(i)] = i;
}

var MAX_INT = 9007199254740992;
var MIN_INT = -9007199254740992;

var LF = '\n',
	CR = '\r',
	CRLF = '\r\n';
	
var _LF = 0,
	_CR = 1,
	_CRLF = 2;

var jsimdb = new jsIMDB();

onmessage = function(event) {
	if(event.data.action == 'sample') {
		var f = jsimdb.sample(event.data.file);
		postMessage({
			"reply": "sample",
			"fileSample": jsimdb.fileSample,
			"lineSeparator": jsimdb.lineSeparator,
			"fieldSeparatorSuggestion": jsimdb.fieldSeparatorSuggestion,
			"file": f
		});
	} else if(event.data.action == 'compress') {
		jsimdb.initialize(event.data.fieldSeparator, event.data.dimensionOrFactSpec, event.data.file);
		jsimdb.compress(event.data.file);
		postMessage({
			"reply": "done_compressing",
			"jsimdb":
				{
					"header": jsimdb.header,
					"recordCount": jsimdb.recordCount,
					"fieldSpec": jsimdb.fieldSpec,
					"DIM": jsimdb.DIM,
					"FACT": jsimdb.FACT,
					"DATE": jsimdb.DATE,
					"dateInfoFields": jsimdb.dateInfoFields(),
					"reversedDictionary": jsimdb.datesReversedDictionary,
					"datesReversedDictionary": jsimdb.datesReversedDictionary,
					"reversedDictionaryToDatesReversedDictionaryLookup": jsimdb.reversedDictionaryToDatesReversedDictionaryLookup,
					"dateInfoReversedDictionary": jsimdb.dateInfoReversedDictionary,
					"dictionary": jsimdb.dictionary
				}
		});
	} else if(event.data.action == 'query') {
		var output = jsimdb.query(event.data.fields, event.data.filters, event.data.outputType);
		postMessage({"reply": "query_done", "query_results": output.resultSet, "resultSetRowCount": output.resultSetRowCount, "outputType": event.data.outputType});
	} else if(event.data.action == 'listAllData') {
		var output = jsimdb.listAllData();
		postMessage({"reply": "listAllDataDone", "output": output});
	} else if(event.data.action == 'getDictionary') {
		postMessage(
			{
				"reply": "dictionaryListing",
				"fieldName": event.data.fieldName,
				"isDateInfoField": false,
				"dictionary": jsimdb.reversedDictionary[event.data.fieldName]
			}
		);
	} else if(event.data.action == 'getDateInfoDictionary') {
		postMessage(
			{
				"reply": "dictionaryListing",
				"fieldName": event.data.fieldName,
				"isDateInfoField": true,
				"dateInfoFieldName": event.data.dateInfoFieldName,
				"dictionary": jsimdb.getDateInfoDictionary(event.data.fieldName, event.data.dateInfoFieldName)
			}
		);
		
	} else if(event.data.action == 'binValue') {
		postMessage(
			{
				"reply": "binValue",
				"fieldName": 
					(event.data.binType == 'percentile' ? 
						jsimdb.binValue(event.data.field, event.data.binCount) :
						(event.data.binType == 'equi-width' ?
							jsimdb.equiWidthBinValue(event.data.field, event.data.binCount) :
							'')
					),
				"header": jsimdb.header,
				"fieldSpec": jsimdb.fieldSpec
			}
		);
	} else if(event.data.action == 'getValueStat') {
		postMessage(
			{
				"reply": "valueStat",
				"valueStat": jsimdb.getValueStat(event.data.fieldName),
				"fieldName": event.data.fieldName
			}
		);
	} else if(event.data.action == 'getSplitPoints') {
		postMessage(
			{
				"reply": "splitPoints",
				"splitPoints": jsimdb.getSplitPoints(event.data.fieldName, event.data.targetFieldName, event.data.filters),
				"fieldName": event.data.fieldName,
				"targetFieldName": event.data.targetFieldName
			}
		);
	} else if(event.data.action == 'ID3') {
		postMessage(
			{
				"reply": "ID3",
				"decisionTreeRoot": jsimdb.ID3(event.data.targetFieldName, event.data.attributes, event.data.filters, 1),
				"targetFieldName": event.data.targetFieldName
			}
		);
	} else if(event.data.action == 'scoreData') {
		jsimdb.debug("scoreData message received at worker.");
		jsimdb.scoreData(event.data.decisionTreeRoot, event.data.newFieldName);
		postMessage(
			{
				"reply": "scoreData",
				"header": jsimdb.header,
				"fieldSpec": jsimdb.fieldSpec
			}
		);
	} else if(event.data.action == 'extractRules') {
		var ruleList = new Array();
		var conditionStack = new Array();
		jsimdb.extractRules(event.data.decisionTreeRoot, conditionStack, ruleList);
		
		ruleList.sort(function(a,b) { if(a.support < b.support) return 1; else if(a.support > b.support) return -1; else return 0; } );
		
		postMessage(
			{
				"reply": "extractRules",
				"ruleList": ruleList,
				"targetFieldName": event.data.targetFieldName
			}
		);
	} else if(event.data.action == 'getDecisionTreeAccuracy') {
		var accuracyInfo = jsimdb.getDecisionTreeAccuracy(
			event.data.decisionTreeRoot,
			event.data.targetFieldName
		);
		
		postMessage(
			{
				"reply": "decisionTreeAccuracy",
				"accuracyInfo": accuracyInfo,
				"targetFieldName": event.data.targetFieldName
			}
		);
	} else if(event.data.action == 'getPercentilesByTarget') {
		postMessage(
			{
				"reply": "percentilesByTarget",
				"payload": jsimdb.getPercentilesByTarget(event.data.valueFieldName, event.data.targetFieldName, event.data.filters, event.data.bins)
			}
		);
	} else if(event.data.action == 'addDimension') {
		
		var dimCount = jsimdb.addDimension(event.data.fieldName);
		if(dimCount >= 0) {
			jsimdb.addDimensionValue(event.data.fieldName, event.data.blankValue);
		}
		
		postMessage(
			{
				"reply": "addDimension",
				"fieldName": event.data.fieldName,
				"header": jsimdb.header,
				"fieldSpec": jsimdb.fieldSpec,
				"status": (dimCount >= 0 ? 'OK' : 'Dimension field name already exists.')
			}
		);
	} else if(event.data.action == 'setFieldValue') {
		
		var isNew = jsimdb.setValueForDimension(event.data.fieldName, event.data.fieldValue, event.data.filters);
		
		postMessage(
			{
				"reply": "setFieldValue",
				"fieldName": event.data.fieldName,
				"fieldValue": event.data.fieldValue,
				"isNew": isNew
			}
		);
	} else if(event.data.action == 'wordBagFilter') {
		var wordBagFilter = jsimdb.addWordBagDictionary(event.data.fieldName);
		
		postMessage(
			{
				"reply": "dictionaryListing",
				"fieldName": event.data.fieldName + ' (bag of words)',
				"dictionary": wordBagFilter
			}
		);
	}
};

function jsIMDB() {
	
	this.timer = new Timer();
	
	this.recordCount = 0;
	
	// Dictionary-compressed data
	this.keyCodes;
	this.values;
	
	// Value statistics
	this.valueStats;
	
	this.compressedDataToRawDataIndexes;
	this.dimensionIndexToHeader;
	this.measureIndexToHeader;
	
	this.header;
	
	this.headerNameToHeaderIndex;
	
	this._DimensionOrFactSpec;
	
	this.fieldSpec;
	
	// Column value to identifier lookup per column. Associative arrays
	this.dictionary;
	this.reversedDictionary;
	this.dictionaryLengths;
	this.datesReversedDictionary;
	this.reversedDictionaryToDatesReversedDictionaryLookup;
	this.dateInfoReversedDictionary; // Contains meta information about dates, e.g. year, quarter, month, hour
	this.dateInfoHash;
	
	this.secondaryDictionary;
	
	this.missing = 'Missing';
	
	var DATE_INFO_OBJECT_COUNT = 14;
	
	var DATE_INFO_YEAR = 0,
		DATE_INFO_QUARTER_NUM = 1,
		DATE_INFO_QUARTER = 2,
		DATE_INFO_QUARTER_YEAR = 3,
		DATE_INFO_MONTH_NUM = 4,
		DATE_INFO_MONTH = 5,
		DATE_INFO_MONTH_YEAR = 6,
		DATE_INFO_ISO_WEEK_NUM = 7,
		DATE_INFO_ISO_WEEK = 8,
		DATE_INFO_ISO_WEEK_YEAR = 9,
		DATE_INFO_DAYNUM_OF_WEEK = 10,
		DATE_INFO_DAYNAME_OF_WEEK = 11,
		DATE_INFO_DATE = 12,
		DATE_INFO_HOUR = 13;
		
	this.dateInfoFields = function() {
		return {
			'Year': DATE_INFO_YEAR,
			'Quarter Number': DATE_INFO_QUARTER_NUM,
			'Quarter Name': DATE_INFO_QUARTER,
			'Quarter of Year': DATE_INFO_QUARTER_YEAR,
			'Month Number': DATE_INFO_MONTH_NUM,
			'Month Name': DATE_INFO_MONTH,
			'Month of Year': DATE_INFO_MONTH_YEAR,
			'Week Number': DATE_INFO_ISO_WEEK_NUM,
			'Week Name': DATE_INFO_ISO_WEEK,
			'Week Of Year': DATE_INFO_ISO_WEEK_YEAR,
			'Day Number of week': DATE_INFO_DAYNUM_OF_WEEK,
			'Day Name of week': DATE_INFO_DAYNAME_OF_WEEK,
			'Date': DATE_INFO_DATE,
			'Hour of day': DATE_INFO_HOUR
		};
	};
	
	// Column value to identifier lookup per column. Regular arrays
	this._dictionary;
	this._reversedDictionary;
	
	this.FACT = 1;
	this.DIM = 2;
	this.DATE = 3;
	
	this.fieldSeparatorSuggestion;
	this.fieldSeparator;
	this.lineSeparator;
	this._lineSeparator;
	this.lastCharacterOfLineIsFieldSeparator = false;
	
	this.dimCount;
	this.factCount;
	
	this.lineSamples = 50;
	
	this.fileSample;
	
	this.resultSetKeys
	this.resultSetValues;
	
	this.RECORD_COUNT_FIELD = "# Records";
	
	this.getDateInfoDictionary = function(fieldName, dateInfoFieldName) {
		
		var keyIdx = this.fieldNameInfo(fieldName).rawDataIndex;
		var dateInfoFieldIdx = this.dateInfoFields()[dateInfoFieldName];
		
		var keyColumn = this.keyCodes[keyIdx];
		var joinColumn = this.reversedDictionaryToDatesReversedDictionaryLookup[keyIdx];
		var lookupColumn = this.datesReversedDictionary;
		var valueLookup = this.dateInfoReversedDictionary[dateInfoFieldIdx];
		
		var dictEntryMap = this._Array(valueLookup.length, false), dict = new Array();
		
		var currentKey;
		var dictIdx;
		
		for(var rowIdx=0; rowIdx<keyColumn.length; rowIdx++) {
			currentKey = keyColumn[rowIdx];
			
			dictIdx = lookupColumn[joinColumn[currentKey]].info[dateInfoFieldIdx];
			
			if(!dictEntryMap[dictIdx]) {
				dictEntryMap[dictIdx] = true;
				dict.push({'value': valueLookup[dictIdx], 'index': dictIdx});
			}
		}
		
		dict.sort(
			function(a, b) {
				if(a.value < b.value)
					return -1;
				if(a.value > b.value)
					return 1;
				return 0; 
			}
		);
		
		for(var i=0; i<dict.length; i++) {
			dict[i].value = dict[i].value.replace(/\{\d+\}/g, '');
		}
		
		return {"dict": dict, "entryMap": dictEntryMap};
	}
	
	this.getNetworkFile = function(_file) {
		
		postMessage({"reply": "feedback", "activity": "Downloading file..."});
		
		var p;
		
		var xhr = new XMLHttpRequest();
		xhr.onprogress = function(evt) {
			p = evt.loaded/1024;
			postMessage({"reply": "feedback", "activity": "Downloading file... Kb's loaded: " + p.toFixed(2)});
		};
		//xhr.open("GET", 'f.php?f=' + encodeURIComponent(_file.name), false);
		xhr.open("GET", _file.name, false);
		xhr.send(null);
		
		if(xhr.status === 200) {
			_file.fileData = xhr.responseText;
			_file.size = _file.fileData.length;
			
			postMessage({"reply": "feedback", "activity": "Done downloading file." + (p != undefined ? "Kb's total: " + p.toFixed(2) : "")});
			
		}
	}
	
	this.sample = function(_file) {
		
		if(_file.isNetworkFile) {
			this.getNetworkFile(_file);
		}
		
		var file = _file;
		var byteChunk = 4000;
		var start = 0, stop = (byteChunk < file.size ? byteChunk : file.size);
		var blob;
		var reader = new FileReaderSync();
		var dataChunk;
		var charIdx;
		var c, pc, lastCharacterOfHeaderLine;
		var lineCount = 0;
		var fileSample = '';
		var lineSeparator, _lineSeparator, lineSeparatorSet = false;
		
		var probableFieldSeparators = {',': 0, ';': 0, '|': 0, '\t': 0};
		var characterCountFirstLine = {};
		
		// Fetch file header and count records
		try {
			while(stop <= file.size && lineCount < this.lineSamples) {
				if(file.slice == undefined && file.isNetworkFile == undefined) { // Safari
					blob = file.webkitSlice(start, stop + 1);
					dataChunk = reader.readAsText(blob);
				} else if(file.slice != undefined && file.isNetworkFile == undefined) { // IE10, Firefox, Chrome
					blob = file.slice(start, stop + 1);
					dataChunk = reader.readAsText(blob);
				} else if(file.isNetworkFile) {
					blob = file.fileData.substring(start, stop + 1);
					dataChunk = blob;
				}
				
				for(charIdx = 0; charIdx<dataChunk.length; charIdx++) {
					pc = c;
					c = dataChunk.charAt(charIdx);
					
					if(lineCount == 0) {
						if(!lineSeparatorSet) {
							if(c == LF && pc != CR) {
								lineSeparator = LF;
								_lineSeparator = _LF;
								lineSeparatorSet = true;
								
								lastCharacterOfHeaderLine = pc;
								
							} else if(c == CR) {
								lineSeparator = CR;
								_lineSeparator = _CR;
								lineSeparatorSet = true;

								if(charIdx<dataChunk.length-1 && dataChunk.charAt(charIdx+1) == LF) {
									lineSeparator = CRLF;
									_lineSeparator = _CRLF;
								}
								
								lastCharacterOfHeaderLine = pc;
								
							}
						}
						
						if(probableFieldSeparators[c] != undefined) {
							probableFieldSeparators[c]++;
						}
						
						if(characterCountFirstLine[c] == undefined) {
							characterCountFirstLine[c] = 1;
						} else {
							characterCountFirstLine[c]++;
						}
						
					}
					
					if(lineSeparatorSet) {
						if(_lineSeparator == _LF && c == LF) {
							lineCount++;
						} else if(_lineSeparator == _CR && c == CR) {
							lineCount++;
						} else if(_lineSeparator == _CRLF && c == LF && pc == CR) {
							lineCount++;
						}
					}
					
					if(lineCount == this.lineSamples) {
						break;
					}
					
					fileSample += c;
					
				}
				
				if(lineCount == this.lineSamples) {
					break;
				}
				
				start = stop + 1;
				stop += (stop < file.size ? byteChunk : file.size);
			}
		} catch(err) {
			postMessage({"reply": "error", "message": err.message});
		}
		this.fileSample = fileSample;
		this.lineSeparator = lineSeparator;
		this._lineSeparator = _lineSeparator;
		
		
		var mostOccuringCharacter = {'character': null, 'occurences': 0};
		
		for(var c in probableFieldSeparators) {
			if(probableFieldSeparators[c] > mostOccuringCharacter['occurences']) {
				mostOccuringCharacter['character'] = c;
				mostOccuringCharacter['occurences'] = probableFieldSeparators[c];
			}
		}
		
		if(mostOccuringCharacter['occurences'] == 0) {
			mostOccuringCharacter = {'character': null, 'occurences': 0};
			
			for(var c in characterCountFirstLine) {
				if(characterCountFirstLine[c] > mostOccuringCharacter['occurences']) {
					mostOccuringCharacter['character'] = c;
					mostOccuringCharacter['occurences'] = characterCountFirstLine[c];
				}
			}	
		}
		
		this.fieldSeparatorSuggestion = mostOccuringCharacter['character'];
		
		if(lastCharacterOfHeaderLine == this.fieldSeparatorSuggestion) {
			this.lastCharacterOfLineIsFieldSeparator = true;
		}
		
		return _file;
	};
	
	this.initialize = function(fieldSeparator, dimensionOrFactSpec, _file) {
		
		this.fieldSeparator = fieldSeparator;
		this._DimensionOrFactSpec = dimensionOrFactSpec;
		
		var _DimensionOrFactSpec = dimensionOrFactSpec;
		
		var file = _file;
		var byteChunk = 4000;
		var start = 0, stop = (byteChunk < file.size ? byteChunk : file.size);
		var blob;
		var reader = new FileReaderSync();
		var dataChunk;
		var charIdx;
		var c = null, pc;
		var lineCount = 0, newLine = false;
		var header = new Array();
		var field = '';
		var inQuote = false;
		var fieldSep = this.fieldSeparator;
		var lineSeparator = this.lineSeparator;
		var _lineSeparator = this._lineSeparator;
		var newLine = false;
		var lastCharacterOfLineIsFieldSeparator = this.lastCharacterOfLineIsFieldSeparator;
		
		// Fetch file header and count records
		try {
			while(1) {
				
				postMessage({"reply": "progress", "activity": "Initializing", "message": ((start/file.size)*100).toFixed(1)});
				
				if(file.slice == undefined && file.isNetworkFile == undefined) { // Safari
					blob = file.webkitSlice(start, stop + 1);
					dataChunk = reader.readAsText(blob);
				} else if(file.slice != undefined && file.isNetworkFile == undefined) { // IE10, Firefox, Chrome
					blob = file.slice(start, stop + 1);
					dataChunk = reader.readAsText(blob);
				} else if(file.isNetworkFile) {
					blob = file.fileData.substring(start, stop + 1);
					dataChunk = blob;
				}
				
				for(charIdx = 0; charIdx<dataChunk.length; charIdx++) {
					pc = c;
					c = dataChunk.charAt(charIdx);
					
					newLine = false;
					
					if(_lineSeparator == _LF && c == LF) {
						newLine = true;
					} else if(_lineSeparator == _CR && c == CR) {
						newLine = true;
					} else if(_lineSeparator == _CRLF && c == LF && pc == CR) {
						newLine = true;
					} else if(_lineSeparator == _CRLF && c == CR) { // Continue to next for loop iteration in anticipation of a line feed
						continue;
					}
					
					if(lineCount == 0) {
						if(c == '"' && pc != '\\' && !inQuote) {
							inQuote = true;
						} else if(c == '"' && pc != '\\' && inQuote) {
							inQuote = false;
						} else if(newLine) {
							if(!lastCharacterOfLineIsFieldSeparator) {
								header.push(field);
							}
						} else if(c == fieldSep && !inQuote) {
							header.push(field);
							field = '';
						} else {
							field += c;
						}
					}
					
					if(newLine) {
						lineCount++;
					}
				}

				start = stop + 1;
				if(stop == file.size) {
					break;
				} else if(stop + byteChunk < file.size) {
					stop += byteChunk;
				} else if(stop + byteChunk >= file.size) {
					stop = file.size;
				}
			}
		} catch(err) {
			postMessage({"reply": "error", "message": err.message});
		}
		
		if(c == CR || c == LF) { // If last character read was a new line
			lineCount--;
		}
		
		this.header = header;
		this.recordCount = lineCount;
		
		this.fieldSpec = {};//new Array();
		this.headerNameToHeaderIndex = {};//new Array();
		
		var dimCount = 0;
		var factCount = 0;
		
		this.compressedDataToRawDataIndexes = new Array(_DimensionOrFactSpec.length);
		this.dimensionIndexToHeader = new Array();
		this.measureIndexToHeader = new Array();
		
		for(var i=0; i<_DimensionOrFactSpec.length; i++) {
			if(_DimensionOrFactSpec[i] == this.DIM || _DimensionOrFactSpec[i] == this.DATE) {
				this.dimensionIndexToHeader[dimCount] = header[i];
				this.compressedDataToRawDataIndexes[i] = dimCount++;
			} else if(_DimensionOrFactSpec[i] == this.FACT) {
				this.measureIndexToHeader[factCount] = header[i];
				this.compressedDataToRawDataIndexes[i] = factCount++;
			}
			this.fieldSpec[this.header[i]] = _DimensionOrFactSpec[i];
			this.headerNameToHeaderIndex[this.header[i]] = i;
		}
		
		this.dimCount = dimCount;
		this.factCount = factCount;
		
		this.keyCodes = this.matrix(this.recordCount, dimCount, "Int32Array");
		this.values = this.matrix(this.recordCount, factCount, "Float32Array");
		this.valueStats = new Array(factCount);
		this.dictionary = {};//new Array();
		this.reversedDictionary = {};//new Array();
		this.dictionaryLengths = {};//new Array();
		
		this.datesReversedDictionary = new Array();
		this.reversedDictionaryToDatesReversedDictionaryLookup = new Array();
		
		this._dictionary = new Array();
		this._reversedDictionary = new Array();
		
		this.secondaryDictionary = {};
		
		for(var i=0; i<this.header.length; i++) {
			if(_DimensionOrFactSpec[i] == this.DIM || _DimensionOrFactSpec[i] == this.DATE) {
				this.dictionary[this.header[i]] = {};//new Array();
				this.reversedDictionary[this.header[i]] = new Array();
				this.dictionaryLengths[this.header[i]] = 0;
				
				this.reversedDictionaryToDatesReversedDictionaryLookup.push(new Array());
				
				this._dictionary.push(this.dictionary[this.header[i]]);
				this._reversedDictionary.push(this.reversedDictionary[this.header[i]]);
				
			} else {
				this.dictionary[this.header[i]] = this.FACT;
				this.reversedDictionary[this.header[i]] = this.FACT;
				
				this.reversedDictionaryToDatesReversedDictionaryLookup[this.header[i]] = this.FACT;
				
				this._dictionary.push(this.dictionary[this.header[i]]);
				this._reversedDictionary.push(this.reversedDictionary[this.header[i]]);
			}
		}
		
		for(var i=0; i<this.valueStats.length; i++) {
			this.valueStats[i] = {'max': MIN_INT, 'min': MAX_INT, 'mean': 0};
		}
		
	};
	
	this.lpad = function(s, len, pad) {
		var rs = s;
		
		while(rs.length < len) {
			rs = pad + rs;
		}
		
		return rs;
	};
	
	this.extractDateMetaInformation = function() {
		var datesReversedDictionary = this.datesReversedDictionary;
		
		if(datesReversedDictionary.length == 0) {
			return;
		}
		
		this.dateInfoReversedDictionary = new Array(DATE_INFO_OBJECT_COUNT);
		for(var i=0; i<DATE_INFO_OBJECT_COUNT; i++) {
			this.dateInfoReversedDictionary[i] = new Array();
		}
		var dateInfoReversedDictionary = this.dateInfoReversedDictionary;
		
		this.dateInfoHash = new Array(DATE_INFO_OBJECT_COUNT);
		for(var i=0; i<DATE_INFO_OBJECT_COUNT; i++) {
			this.dateInfoHash[i] = {};
		}
		var dateInfoHash = this.dateInfoHash;
		
		var dayIndex = [
			6, 0, 1, 2, 3, 4, 5
		];
		
		var daynames = [
			'Mo','Tu','We','Th','Fr','Sa','Su'
		];
		
		var monthnames = [
			'Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'
		];
		
		var datesRDictEntry,
			theDate,
			m,
			year,
			quarter_num,
			quarter,
			quarter_year,
			month_num,
			month,
			month_year,
			iso_week_num,
			iso_week,
			iso_week_year,
			daynum_of_week,
			dayname_of_week,
			hour,
			hours;
		
		var dateInfoObjects = new Array(DATE_INFO_OBJECT_COUNT);
		
		for(var dateIdx=0; dateIdx<datesReversedDictionary.length; dateIdx++) {
			
			postMessage({"reply": "progress", "activity": "Extracting date information", "message": ((dateIdx/datesReversedDictionary.length)*100).toFixed(1)});
			
			datesRDictEntry = datesReversedDictionary[dateIdx];
			//theDate = new Date(datesRDictEntry.date);
			m = moment(datesRDictEntry.date);
			
			if(m != null) {
				if(!m.isValid()) { // Try another format
					m = moment(datesRDictEntry.date, ['DD-MMM-YYYY','DD-MMM-YYYY HH:mm:ss']);
				}

				theDate = m.toDate();
			}
			
			if(m != null && m.isValid()) {
				year = '' + theDate.getFullYear();
				dateInfoObjects[DATE_INFO_YEAR] = year.substring(2);
				dateInfoObjects[DATE_INFO_QUARTER_NUM] = '' + Math.floor((theDate.getMonth() + 3) / 3);
				dateInfoObjects[DATE_INFO_QUARTER] = 'Q' + dateInfoObjects[DATE_INFO_QUARTER_NUM];
				dateInfoObjects[DATE_INFO_QUARTER_YEAR] = '{' + dateInfoObjects[DATE_INFO_YEAR] +
					this.lpad('' + dateInfoObjects[DATE_INFO_QUARTER_NUM], 2, '0') + '}' +
					dateInfoObjects[DATE_INFO_QUARTER] + ' ' + dateInfoObjects[DATE_INFO_YEAR];
				dateInfoObjects[DATE_INFO_MONTH_NUM] = this.lpad(''+(theDate.getMonth()+1), 2, '0');
				dateInfoObjects[DATE_INFO_MONTH]  = '{' + dateInfoObjects[DATE_INFO_MONTH_NUM]
					+ '}' + monthnames[theDate.getMonth()];
				dateInfoObjects[DATE_INFO_MONTH_YEAR] = '{' + dateInfoObjects[DATE_INFO_YEAR] +
					dateInfoObjects[DATE_INFO_MONTH_NUM] + '}' +
					monthnames[theDate.getMonth()] + ' ' + dateInfoObjects[DATE_INFO_YEAR];
				iso_week_num = this.lpad('' + this.getWeekNumber(theDate), 2, '0');
				dateInfoObjects[DATE_INFO_ISO_WEEK_NUM] = iso_week_num;
				dateInfoObjects[DATE_INFO_ISO_WEEK] = 'Wk' + this.lpad(''+iso_week_num, 2, '0');
				dateInfoObjects[DATE_INFO_ISO_WEEK_YEAR] = '{' + dateInfoObjects[DATE_INFO_YEAR] +
					this.lpad(''+dateInfoObjects[DATE_INFO_ISO_WEEK_NUM], 2, '0') + '}' + dateInfoObjects[DATE_INFO_ISO_WEEK] + ' ' +
					dateInfoObjects[DATE_INFO_YEAR];
				dateInfoObjects[DATE_INFO_DAYNUM_OF_WEEK] = dayIndex[theDate.getDay()];
				dateInfoObjects[DATE_INFO_DAYNUM_OF_WEEK] = ''+(dateInfoObjects[DATE_INFO_DAYNUM_OF_WEEK] == 0 ? 1 : dateInfoObjects[DATE_INFO_DAYNUM_OF_WEEK] + 1);
				dateInfoObjects[DATE_INFO_DAYNAME_OF_WEEK] = '{' + dateInfoObjects[DATE_INFO_DAYNUM_OF_WEEK] + '}' + daynames[dateInfoObjects[DATE_INFO_DAYNUM_OF_WEEK]-1];
				hours = '' + theDate.getHours();
				dateInfoObjects[DATE_INFO_DATE] = this.lpad(''+theDate.getUTCDate(), 2, '0') + '-' + monthnames[theDate.getMonth()] + '-' + theDate.getFullYear();
				dateInfoObjects[DATE_INFO_HOUR] = (hours.length == 1 ? '0' + hours : hours);
			} else if(m == null || !m.isValid()) {
				for(var i=0; i<dateInfoObjects.length; i++) {
					dateInfoObjects[i] = '{999999}Missing';
				}
			}
			
			for(var dateinfoObjectIdx=0; dateinfoObjectIdx<dateInfoObjects.length; dateinfoObjectIdx++) {
				if(dateInfoHash[dateinfoObjectIdx][dateInfoObjects[dateinfoObjectIdx]] == undefined) {
					dateInfoReversedDictionary[dateinfoObjectIdx].push(dateInfoObjects[dateinfoObjectIdx]);
					datesRDictEntry.info[dateinfoObjectIdx] = dateInfoReversedDictionary[dateinfoObjectIdx].length-1;
					dateInfoHash[dateinfoObjectIdx][dateInfoObjects[dateinfoObjectIdx]] = dateInfoReversedDictionary[dateinfoObjectIdx].length-1;
				} else {
					datesRDictEntry.info[dateinfoObjectIdx] = dateInfoHash[dateinfoObjectIdx][dateInfoObjects[dateinfoObjectIdx]];
				}
			}
		}
	};
	
	/* For a given date, get the ISO week number
	*
	* Based on information at:
	*
	*    http://www.merlyn.demon.co.uk/weekcalc.htm#WNR
	*
	* Algorithm is to find nearest thursday, it's year
	* is the year of the week number. Then get weeks
	* between that date and the first day of that year.
	*
	* Note that dates in one year can be weeks of previous
	* or next year, overlap is up to 3 days.
	*
	* e.g. 2014/12/29 is Monday in week  1 of 2015
	*      2012/1/1   is Sunday in week 52 of 2011
	*/
	this.getWeekNumber = function(d) {
		// Copy date so don't modify original
		d = new Date(d);
		d.setHours(0,0,0);
		// Set to nearest Thursday: current date + 4 - current day number
		// Make Sunday's day number 7
		d.setDate(d.getDate() + 4 - (d.getDay()||7));
		// Get first day of year
		var yearStart = new Date(d.getFullYear(),0,1);
		// Calculate full weeks to nearest Thursday
		var weekNo = Math.ceil(( ( (d - yearStart) / 86400000) + 1)/7)
		// Return array of year and week number
		return weekNo;
	}
	
	this.compress = function(_file) {
		// Read file contents and compress
		var file = _file;
		var byteChunk = 30000;
		var start = 0, stop = (byteChunk < file.size ? byteChunk : file.size);
		var blob;
		var reader = new FileReaderSync();
		var dataChunk;
		var charIdx;
		var c = null, pc, trieKey;
		var inQuote = false;
		var fieldSep = this.fieldSeparator;
		var lineSeparator = this.lineSeparator;
		var rowIdx = -1, fieldIdx = 0;
		var fieldValue = '';
		var _DimensionOrFactSpec = this._DimensionOrFactSpec;
		
		var _header = this.header;
		var dict = this.dictionary;
		var rdict = this.reversedDictionary;
		var datesrdict = this.datesReversedDictionary;
		var dictLengths = this.dictionaryLengths;
		var _dict = this._dictionary;
		var _rdict = this._reversedDictionary;
		var value;
		var keys;
		
		var missing = this.missing;
		
		var compressedDataToRawDataIndexes = this.compressedDataToRawDataIndexes;
		
		var recordCount = this.recordCount;
		
		var rdicttodatesrdict = this.reversedDictionaryToDatesReversedDictionaryLookup;
		var rdicttodatesrdictentry;
		
		var codes = new Int32Array(this.keyCodes.length);
		
		for(var i=0; i<codes.length; i++) {
			codes[i] = 0;
		}
		
		var codeIdx = 0;
		var hdr,
			dictEntry,
			rdictEntry,
			dictEntryValue,
			colIdx;
		
		var lastCharacterOfLineIsFieldSeparator =
			this.lastCharacterOfLineIsFieldSeparator;
		
		var _values = this.values,
			_keyCodes = this.keyCodes,
			_valueStats = this.valueStats;
			
		var previousDimValues = new Array(this.dimCount),
			previousDimCodes = new Array(this.dimCount);
		
		for(var i=0; i<previousDimCodes.length; i++) {
			previousDimValues[i] = '';
			previousDimCodes[i] = -1;
		}
		
		var charTrieRootNode = new Array();
		var currentCharTrieNode = charTrieRootNode;
		var tmpNode;
		var includeInTrie = (_DimensionOrFactSpec[fieldIdx] == this.DIM ? true : false);
		var trieCodesEntry, tmpTrieCodesEntry;
		
		var fieldValueId = 0;
		
		var num;
		
		var _fieldValue, _valueStat;
		
		var isFieldSepAndNotInQuote,
			isLineSeparator;
			
		var _lineSeparator = this._lineSeparator,
			newLine = false;
		
		try {
			while(1) {
				
				postMessage({"reply": "progress", "activity": "Loading file", "message": ((start/file.size)*100).toFixed(1)});
				
				if(file.slice == undefined && file.isNetworkFile == undefined) { // Safari
					blob = file.webkitSlice(start, stop + 1);
					dataChunk = reader.readAsText(blob);
				} else if(file.slice != undefined && file.isNetworkFile == undefined) { // IE10, Firefox, Chrome
					blob = file.slice(start, stop + 1);
					dataChunk = reader.readAsText(blob);
				} else if(file.isNetworkFile) {
					blob = file.fileData.substring(start, stop + 1);
					dataChunk = blob;
				}
				
				for(charIdx = 0; charIdx<dataChunk.length; charIdx++) {
					pc = c;
					c = dataChunk.charAt(charIdx);
					
					newLine = false;
					
					if(_lineSeparator == _LF && c == LF) {
						newLine = true;
					} else if(_lineSeparator == _CR && c == CR) {
						newLine = true;
					} else if(_lineSeparator == _CRLF && c == LF && pc == CR) {
						newLine = true;
					} else if(_lineSeparator == _CRLF && c == CR) { // Continue to next for loop iteration in anticipation of a line feed
						continue;
					}
					
					if(rowIdx > -1) {
						
						isFieldSepAndNotInQuote = (c == fieldSep && !inQuote);
						
						if(isFieldSepAndNotInQuote || newLine) {
							if(!(lastCharacterOfLineIsFieldSeparator && newLine)) {
								dictEntry = _dict[fieldIdx];
								rdictEntry = _rdict[fieldIdx];

								colIdx = compressedDataToRawDataIndexes[fieldIdx];

								if(dictEntry == this.FACT) {
									
									if(fieldValue != '') {
										
										_fieldValue = parseFloat(fieldValue);

										_values[colIdx][rowIdx] = _fieldValue;

										_valueStat = _valueStats[colIdx];

										if(_fieldValue < _valueStat.min) {
											_valueStat.min = _fieldValue;
										}

										if(_fieldValue > _valueStat.max) {
											_valueStat.max = _fieldValue;
										}

										_valueStat.mean += _fieldValue;
										
									}

								} else { // Dimension

									trieCodesEntry = currentCharTrieNode['cd'];

									if(trieCodesEntry == undefined) {
										currentCharTrieNode['cd'] = new Array();
										trieCodesEntry = currentCharTrieNode['cd'];

										if(_DimensionOrFactSpec[fieldIdx] == this.DATE) {
											rdicttodatesrdictentry = rdicttodatesrdict[fieldIdx];
											datesrdict.push({'date': fieldValue, 'info': new Array(DATE_INFO_OBJECT_COUNT)});
											trieCodesEntry['date'] = datesrdict.length-1;
										}

									}

									if(trieCodesEntry[colIdx] == undefined) {
										rdictEntry.push((fieldValue != '' ? fieldValue : missing));
										trieCodesEntry[colIdx] = rdictEntry.length-1;

										if(_DimensionOrFactSpec[fieldIdx] == this.DATE) {
											
											if(trieCodesEntry['date'] == undefined) {
												datesrdict.push({'date': fieldValue, 'info': new Array(DATE_INFO_OBJECT_COUNT)});
												trieCodesEntry['date'] = datesrdict.length-1;
											}
											
											rdicttodatesrdict[colIdx].push(trieCodesEntry['date']);
										}
									}

									_keyCodes[colIdx][rowIdx] = trieCodesEntry[colIdx];

									/*if(fieldValue != previousDimValues[codeIdx]) { // If something has changed

										dictEntryValue = dictEntry[fieldValue];

										if(dictEntryValue == undefined) {
											dictEntry[fieldValue] = codes[codeIdx];
											dictEntryValue = codes[codeIdx];
											rdictEntry.push(fieldValue);
											codes[codeIdx]++;
										}

										previousDimCodes[codeIdx] = dictEntryValue;
										previousDimValues[codeIdx] = fieldValue;

										_keyCodes[colIdx][rowIdx] = dictEntryValue;
									} else {
										_keyCodes[colIdx][rowIdx] = previousDimCodes[codeIdx];
									}*/

									codeIdx++;

								}
							}
							
							fieldIdx++;
							fieldValue = '';

							if(newLine) {
								rowIdx++;
								fieldIdx = 0;
								codeIdx = 0;
							}

							includeInTrie = (_DimensionOrFactSpec[fieldIdx] == this.DIM || _DimensionOrFactSpec[fieldIdx] == this.DATE ? true : false);
							currentCharTrieNode = charTrieRootNode;
							
						} else if(c == '"' && pc != '\\' && !inQuote) {
							inQuote = true;
						} else if(c == '"' && pc != '\\' && inQuote) {
							inQuote = false;
						} else {
							fieldValue += c;
							
							if(includeInTrie) {
								trieKey = c;
								
								if(currentCharTrieNode[trieKey] == undefined) {
									tmpNode = new Array();
									currentCharTrieNode[trieKey] = tmpNode;
									currentCharTrieNode = tmpNode;
								} else {
									currentCharTrieNode = currentCharTrieNode[trieKey];
								}
							}
							
						}
						
					} else if(rowIdx == -1) {
						if(newLine) {
							rowIdx++;
						}
					}
				}

				start = stop + 1;
				if(stop == file.size) {
					break;
				} else if(stop + byteChunk < file.size) {
					stop += byteChunk;
				} else if(stop + byteChunk >= file.size) {
					stop = file.size;
				}
			}
		} catch(err) {
			postMessage({"reply": "error", "message": err.message});
		}
		
		if(fieldValue != '') { // Handle last field of last record
			colIdx = compressedDataToRawDataIndexes[fieldIdx];
			
			dictEntry = _dict[fieldIdx];
			rdictEntry = _rdict[fieldIdx];
			
			if(dictEntry == this.FACT) {

				_values[colIdx][rowIdx] = parseFloat(fieldValue);

			} else { // Dimension
				
				trieCodesEntry = currentCharTrieNode['cd'];
				
				if(trieCodesEntry == undefined) {
					currentCharTrieNode['cd'] = new Array();
					trieCodesEntry = currentCharTrieNode['cd'];
					
					if(_DimensionOrFactSpec[fieldIdx] == this.DATE) {
						rdicttodatesrdictentry = rdicttodatesrdict[fieldIdx];
						datesrdict.push({'date': fieldValue, 'info': new Array(DATE_INFO_OBJECT_COUNT)});
						trieCodesEntry['date'] = datesrdict.length-1;
					}
					
				}
				
				if(trieCodesEntry[colIdx] == undefined) {
					rdictEntry.push(fieldValue);
					trieCodesEntry[colIdx] = rdictEntry.length-1;
					
					if(_DimensionOrFactSpec[fieldIdx] == this.DATE) {
						
						if(trieCodesEntry['date'] == undefined) {
							datesrdict.push({'date': fieldValue, 'info': new Array(DATE_INFO_OBJECT_COUNT)});
							trieCodesEntry['date'] = datesrdict.length-1;
						}
						
						rdicttodatesrdict[colIdx].push(trieCodesEntry['date']);
					}
				}
				
				_keyCodes[colIdx][rowIdx] = trieCodesEntry[colIdx];
				
			}
			
		}
		
		codeIdx = 0;
		for(var i=0; i<_header.length; i++) {
			if(this._DimensionOrFactSpec[i] == this.DIM || this._DimensionOrFactSpec[i] == this.DATE) {
				dictLengths[_header[i]] = rdict[_header[i]].length;
			}
		}
		
		for(var i=0; i<_valueStats.length; i++) {
			_valueStats[i].mean /= this.recordCount;
		}
		
		this.extractDateMetaInformation();
		this.setupDictionaries();
		
		this.initDB();
	};
	
	this.setupDictionaries = function() {
		var dict, rdict;
		
		for(var i=0; i<this.header.length; i++) {
			if(this._DimensionOrFactSpec[i] == this.DIM || this._DimensionOrFactSpec[i] == this.DATE) {
				dict = this.dictionary[this.header[i]];
				rdict = this.reversedDictionary[this.header[i]];
				
				for(var j=0; j<rdict.length; j++) {
					if(dict[rdict[j]] == undefined) {
						dict[rdict[j]] = j;
					}
				}
			}
		}
		this.dictionary[this.header[i]] = {};//new Array();
		this.reversedDictionary[this.header[i]] = new Array();
	}
	
	this.addWordBagDictionary = function(fieldName) {
		var dict = jsimdb.reversedDictionary[fieldName];
		var entry;
		var c, words, word, globalWords = {};
		
		var secondaryDictionaryName = fieldName + ' (bag of words)';
		
		var wordBagDictionary = new Array();
		var wordBagPointers = new Array();
		
		var diff = 0;
		
		for(var i=0; i<dict.length; i++) {
			entry = dict[i].toLowerCase();
			
			words = new Array();
			word = '';
			
			for(var j=0; j<entry.length; j++) {
				c = entry.charAt(j);
				if(charPositions[c] != undefined) {
					word += c;
				} else if(c == ' ' && word != '') {
					if(globalWords[word] == undefined) {
						globalWords[word] = {'count': 1, 'entries': [i], 'entryHash': {}};
					} else {
						globalWords[word].count++;
						if(globalWords[word].entryHash[i] == undefined) {
							globalWords[word].entryHash[i] = globalWords[word].entries.push(i);
						}
					}
					words.push(word);
					word = '';
				}
			}
			
			if(word != '') {
				words.push(word);
				
				if(globalWords[word] == undefined) {
					globalWords[word] = {'count': 1, 'entries': [i], 'entryHash': {}};
				} else {
					globalWords[word].count++;
					if(globalWords[word].entryHash[i] == undefined) {
						globalWords[word].entryHash[i] = globalWords[word].entries.push(i);
					}
				}
			}
		}
		
		for(var word in globalWords) {
			wordBagDictionary.push(word);
		}
		
		wordBagDictionary.sort();
		
		for(var i=0; i<wordBagDictionary.length; i++) {
			wordBagPointers.push(globalWords[wordBagDictionary[i]].entries);
		}
		
		this.secondaryDictionary[secondaryDictionaryName] = {
			'referencedDictionaryName': fieldName,
			'wordBagDictionary': wordBagDictionary,
			'wordBagPointers': wordBagPointers
		};
		
		return this.secondaryDictionary[secondaryDictionaryName].wordBagDictionary;
	};
	
	this.entropyCalc = function(prob, base) {
		if(prob == 0) {
			return 0;
		} else {
			return -1*prob*this._log(prob, base);
		}
	};
	
	this.prob = function(numerator, denominator) {
		if(denominator != 0) {
			return numerator/denominator;
		} else if(denominator == 0) {
			return 0;
		}
	};
	
	this.getBestSplit = function(priorEntropy, fieldName, targetFieldName, filters, returnType) {
		var values = this.values;
		var keyCodes = this.keyCodes;
		
		var recordCount = this.recordCount;
		
		var targetFieldIdx = this.fieldNameToRawDataIndex(targetFieldName);
		var valueIdx = this.fieldNameToRawDataIndex(fieldName);
		
		var rowIndexes = this.query([{'fieldName': fieldName}, {'fieldName': targetFieldName}], filters, 'row_indexes');
		
		var valueVector = new Array(rowIndexes.length);
		
		var rowIdx;
		
		var min = MAX_INT, max = MIN_INT;
		
		var value;
		
		var targetFieldNameValueCount = this.dictionaryLengths[targetFieldName];
		
		var totalTargetFieldValueDistribution = this._Array(targetFieldNameValueCount, 0),
			totalObservations = rowIndexes.length;
		
		var _returnType;
		
		if(returnType == undefined) {
			_returnType = 'regular';
		} else if(returnType != undefined) {
			_returnType = returnType;
		}
		
		for(var i=0; i<rowIndexes.length; i++) {
			rowIdx = rowIndexes[i];
			value = values[valueIdx][rowIdx];
			valueVector[i] = {'index': rowIdx, 'value': value, 'targetValue': keyCodes[targetFieldIdx][rowIdx]};
			totalTargetFieldValueDistribution[keyCodes[targetFieldIdx][rowIdx]]++;
			if(value < min) {
				min = value;
			}
			if(value > max) {
				max = value;
			}
		}
		
		var sortedValueVector = valueVector.slice(0).sort(function(a,b) { return a.value - b.value; });
		
		var targetValueDistribution = this._Array(targetFieldNameValueCount, 0);
		var lowerBoundObservations = 0,
			upperBoundObservations,
			lowerBoundEntropy,
			upperBoundEntropy,
			prob,
			informationGain,
			maxInformationGain = MIN_INT,
			splitWithMaxInformationGain,
			lowerBoundSupport,
			upperBoundSupport,
			lowerBoundConfidence,
			upperBoundConfidence;
		
		var splits = 0;
		
		for(var i=1; i<sortedValueVector.length; i++) {
			targetValueDistribution[sortedValueVector[i-1].targetValue]++;
			lowerBoundObservations++;
			if(sortedValueVector[i-1].targetValue != sortedValueVector[i].targetValue) {
				upperBoundObservations = totalObservations - lowerBoundObservations;
				
				lowerBoundEntropy = 0;
				upperBoundEntropy = 0;
				weightedAttributeEntropy = 0;
				
				splits++;
				
				for(var j=0; j<targetFieldNameValueCount; j++) {
					// Probability and entropy of current target value for below split point
					prob = this.prob(targetValueDistribution[j], lowerBoundObservations);
					lowerBoundEntropy += this.entropyCalc(prob, 2);
					
					// Probability and entropy of current target value for above split point	
					prob = this.prob((totalTargetFieldValueDistribution[j] - targetValueDistribution[j]), upperBoundObservations);
					upperBoundEntropy += this.entropyCalc(prob, 2);
				}
				
				informationGain =
					priorEntropy - (
						(this.prob(lowerBoundObservations, totalObservations)*lowerBoundEntropy) +
						(this.prob(upperBoundObservations, totalObservations)*upperBoundEntropy)
					);
				
				if(informationGain > maxInformationGain) {
					maxInformationGain = informationGain;
					splitWithMaxInformationGain = (sortedValueVector[i-1].value+sortedValueVector[i].value)/2;
					lowerBoundSupport = this.prob(lowerBoundObservations, recordCount);
					upperBoundSupport = this.prob(upperBoundObservations, recordCount);
					lowerBoundConfidence = this.prob(lowerBoundObservations, totalObservations);
					upperBoundConfidence = this.prob(upperBoundObservations, totalObservations);
				}
			}
		}
		
		if(_returnType == 'regular') {
			return {
				'splitpoint': splitWithMaxInformationGain,
				'min': min,
				'max': max,
				'observations': totalObservations,
				'informationGain': maxInformationGain,
				'splitsConsidered': splits,
				'lowerBoundSupport': lowerBoundSupport,
				'upperBoundSupport': upperBoundSupport,
				'lowerBoundConfidence': lowerBoundConfidence,
				'upperBoundConfidence': upperBoundConfidence
			};
		} else if(_returnType == 'row_indexes') {
			return {
				'splitpoint': splitWithMaxInformationGain,
				'min': min,
				'max': max,
				'observations': totalObservations,
				'informationGain': maxInformationGain,
				'rowIndexes': rowIndexes
			};
		}
	};
	
	this.entropy = function(targetFieldName, filters) {
		var resultSetInfo = this.query([{'fieldName': targetFieldName}, {'fieldName': this.RECORD_COUNT_FIELD}], filters, 'json_hash');
		var prob, entropy = 0, observations = 0;
		
		observations = this.getObservations(resultSetInfo);
		
		for(var i=0; i<resultSetInfo.resultSetRowCount; i++) {
			prob = this.prob(resultSetInfo.resultSet[i][this.RECORD_COUNT_FIELD], observations);
			entropy += this.entropyCalc(prob, 2);
		}
		
		return {'entropy': entropy, 'observations': observations};
	};
	
	this._log = function(n, base) {
		return Math.log(n)/(base ? Math.log(base) : 1);
	};
	
	// For discrete independent variables
	this.conditionalEntropy = function(fieldName, targetFieldName, filters) {
		var resultSetInfo = this.query([{'fieldName': fieldName}, {'fieldName': targetFieldName}, {'fieldName': this.RECORD_COUNT_FIELD}], filters, 'json_hash');
		var prob, entropy = 0, conditionalEntropy = {}, fieldNameValueObservations = {}, observations = 0;
		var branches = new Array(), branches_coded = new Array();
		var recordCount = this.recordCount;
		
		for(var i=0; i<resultSetInfo.resultSetRowCount; i++) {
			observations += resultSetInfo.resultSet[i][this.RECORD_COUNT_FIELD];
			
			if(conditionalEntropy[resultSetInfo.resultSet[i][fieldName]] == undefined) {
				conditionalEntropy[resultSetInfo.resultSet[i][fieldName]] = 0;
				
				branches.push({'branch': resultSetInfo.resultSet[i][fieldName], 'support': 0});
				branches_coded.push(resultSetInfo.resultSetCoded[i][fieldName]);
			}
			
			if(fieldNameValueObservations[resultSetInfo.resultSet[i][fieldName]] == undefined) {
				fieldNameValueObservations[resultSetInfo.resultSet[i][fieldName]] = {'support': 0, 'confidence': 0, 'branchIdx': branches.length-1};
			}
			
			fieldNameValueObservations[resultSetInfo.resultSet[i][fieldName]].support +=
				resultSetInfo.resultSet[i][this.RECORD_COUNT_FIELD];
		}
		
		for(var i=0; i<resultSetInfo.resultSetRowCount; i++) {
			prob = this.prob(
				resultSetInfo.resultSet[i][this.RECORD_COUNT_FIELD],
				fieldNameValueObservations[resultSetInfo.resultSet[i][fieldName]].support
			);
			
			conditionalEntropy[resultSetInfo.resultSet[i][fieldName]] += this.entropyCalc(prob, 2);
		}
		
		for(var _fieldNameValue in fieldNameValueObservations) {
			entropy += this.prob(
				fieldNameValueObservations[_fieldNameValue].support, 
				observations)
				* conditionalEntropy[_fieldNameValue];
			
			branches[fieldNameValueObservations[_fieldNameValue].branchIdx].support = 
				fieldNameValueObservations[_fieldNameValue].support/recordCount;
			branches[fieldNameValueObservations[_fieldNameValue].branchIdx].confidence = 
				fieldNameValueObservations[_fieldNameValue].support/observations;
		}
		
		return {'entropy': entropy, 'observations': observations, 'branches': branches, 'branches_coded': branches_coded};
	};
	
	this.informationGain = function(fieldName, targetFieldName, filters) {
		var values = this.values;
		var keyCodes = this.keyCodes;
		
		var targetFieldIdx = this.fieldNameToRawDataIndex(targetFieldName);
		var valueIdx = this.fieldNameToRawDataIndex(fieldName);
		
		var fieldType = this.fieldSpec[fieldName];
		
		var prob;
		
		var entropyInfo;
		
		entropyInfo = this.entropy(targetFieldName, filters);
		var priorEntropy = entropyInfo.entropy;
		
		var _bestSplitpoint;
		
		if(fieldType == this.FACT) {
			var bestSplitInfo = this.getBestSplit(priorEntropy, fieldName, targetFieldName, filters);
			
			if(bestSplitInfo.splitpoint % 1 != 0) {
				_bestSplitpoint = parseFloat(bestSplitInfo.splitpoint).toFixed(1);
			} else {
				_bestSplitpoint = bestSplitInfo.splitpoint;
			}
			
			return {
				"attribute": fieldName,
				"branches": [
					{
						"label": "<= " + _bestSplitpoint,
						"support": bestSplitInfo.lowerBoundSupport,
						"confidence": bestSplitInfo.lowerBoundConfidence,
						"filter": {'type': 'measure', 'from': bestSplitInfo.min, 'to': bestSplitInfo.splitpoint}
					},
					{
						"label": "> " + _bestSplitpoint,
						"support": bestSplitInfo.upperBoundSupport,
						"confidence": bestSplitInfo.upperBoundConfidence,
						"filter": {'type': 'measure', 'from': bestSplitInfo.splitpoint + 0.001, 'to': bestSplitInfo.max}
					}
				],
				'informationGain': bestSplitInfo.informationGain
			};
			
		} else if(fieldType == this.DIM || fieldType == this.DATE) { // Dimension or date
			
			var entropyInfo = this.conditionalEntropy(fieldName, targetFieldName, filters);
			
			var branches = new Array();
			
			for(var i=0; i<entropyInfo.branches.length; i++) {
				branches.push(
					{
						"label": entropyInfo.branches[i].branch,
						"support": entropyInfo.branches[i].support,
						"confidence": entropyInfo.branches[i].confidence,
						"filter": {'type': 'dimension', 'entry': entropyInfo.branches_coded[i], 'filterOne': true}
					}
				);
			}
			
			return {
				"attribute": fieldName,
				"branches": branches,
				"informationGain": (priorEntropy - entropyInfo.entropy)
			};
			
		}
	};
	
	this.getMostCommonTarget = function(resultSetInfo, targetFieldName) {
		var mostCommonTargetFieldNameValue, maxRecordCount = 0, distribution = {}, total = 0;
		for(var i=0; i<resultSetInfo.resultSetRowCount; i++) {
			if(resultSetInfo.resultSet[i][this.RECORD_COUNT_FIELD] > maxRecordCount) {
				maxRecordCount = resultSetInfo.resultSet[i][this.RECORD_COUNT_FIELD];
				mostCommonTargetFieldNameValue = resultSetInfo.resultSet[i][targetFieldName];
			}
			
			if(distribution[resultSetInfo.resultSet[i][targetFieldName]] == undefined) {
				distribution[resultSetInfo.resultSet[i][targetFieldName]] = 0;
			}
			total += resultSetInfo.resultSet[i][this.RECORD_COUNT_FIELD];
			distribution[resultSetInfo.resultSet[i][targetFieldName]] += resultSetInfo.resultSet[i][this.RECORD_COUNT_FIELD];
		}
		
		for(var target in distribution) {
			distribution[target] /= total;
		}
		
		return {'mostCommonTarget': mostCommonTargetFieldNameValue, 'classDistribution': distribution};
	};
	
	this.getObservations = function(resultSetInfo) {
		var observations = 0;
		for(var i=0; i<resultSetInfo.resultSetRowCount; i++) {
			observations += resultSetInfo.resultSet[i][this.RECORD_COUNT_FIELD];
		}
		return observations;
	};
	
	// Build decision tree using the ID3 algorithm
	this.ID3 = function(targetFieldName, attributes, filters, depth) {
		// Create root node
		var root = {};
		
		// Query the dataset with current filters
		var resultSetInfo = this.query([{'fieldName': targetFieldName}, {'fieldName': this.RECORD_COUNT_FIELD}], filters, 'json_hash');
		
		// If there is only one class value (target value) then return the root node with label class value
		if(resultSetInfo.resultSetRowCount == 1) {
			root.field = targetFieldName;
			root.label = this.getMostCommonTarget(resultSetInfo, targetFieldName);
			return root;
		}
		
		// If attribute-list attributes is empty then return root node with label = most common class value
		if(attributes.length == 0) {
			root.field = targetFieldName;
			root.label = this.getMostCommonTarget(resultSetInfo, targetFieldName);
			return root;
		}
		
		var maxInformationGain = MIN_INT,
			maxInfoGainData;
		
		// Select attribute with maximumn information gain
		var attribute, infoGainData, selectedAttributeIdx;
		for(var i=0; i<attributes.length; i++) {
			attribute = attributes[i];
			infoGainData = this.informationGain(attribute, targetFieldName, filters);
			
			if(infoGainData.informationGain > maxInformationGain) {
				maxInformationGain = infoGainData.informationGain;
				maxInfoGainData = infoGainData;
				selectedAttributeIdx = i;
			}
		}
		
		root.field = maxInfoGainData.attribute;
		root.branches = maxInfoGainData.branches;
		
		var _filters = this.copyObject(filters);
		var resultSetInfoBranch;
		var remainingAttributes = attributes.slice(0);
		remainingAttributes.splice(selectedAttributeIdx,1);
		
		// For each possible value of attribute (for discrete attributes), or each split region (for continious attributes)
		for(var i=0; i<maxInfoGainData.branches.length; i++) {
			_filters[root.field] = maxInfoGainData.branches[i].filter;
			resultSetInfoBranch = this.query([{'fieldName': targetFieldName}, {'fieldName': this.RECORD_COUNT_FIELD}], _filters, 'json_hash');
			
			if(this.getObservations(resultSetInfoBranch) == 0) {
				maxInfoGainData.branches[i].node = {};
				maxInfoGainData.branches[i].node.field = targetFieldName;
				maxInfoGainData.branches[i].node.label = this.getMostCommonTarget(resultSetInfo, targetFieldName);
			} else {
				maxInfoGainData.branches[i].node = this.ID3(targetFieldName, remainingAttributes, _filters, depth+1);
			}
			maxInfoGainData.branches[i].node.support = maxInfoGainData.branches[i].support;
		}
		
		return root;
	};
	
	this.extractRules = function(node, conditionStack, ruleList) {
		if(node.branches == undefined) {
			ruleList.push(
				{
					"conditions": conditionStack.slice(0),
					"consequence": node.field + " = " + node.label.mostCommonTarget,
					"support": node.support,
					"confidence": node.label.classDistribution[node.label.mostCommonTarget]
				}
			);
			
			return;
		}
		for(var branchIdx=0; branchIdx<node.branches.length; branchIdx++) {
			if(node.branches[branchIdx].filter.type == 'measure') {
				conditionStack.push(
					node.field + " " + node.branches[branchIdx].label
				);
			} else if(node.branches[branchIdx].filter.type == 'dimension') {
				conditionStack.push(
					node.field + " = " + node.branches[branchIdx].label
				);
			}
			
			this.extractRules(node.branches[branchIdx].node, conditionStack, ruleList);
			
			conditionStack.pop();
		}
	};
	
	this.getDecisionTreeAccuracy = function(decisionTreeRoot, targetFieldName) {
		var values = this.values;
		var keyCodes = this.keyCodes;
		var reversedDictionary = this.reversedDictionary;
		var recordCount = this.recordCount;
		var currentNode;
		var currentFieldInfo;
		var keyCodeLookup = {};
		var targetFieldInfo = this.fieldNameInfo(targetFieldName);
		
		if(targetFieldInfo == undefined) {
			return undefined;
		}
		
		var actualTargetValue, predictedTargetValue;
		
		var confusionMatrix = {}, accuracyCount = 0;
		
		for(var rowIdx=0; rowIdx<recordCount; rowIdx++) {
			currentNode = decisionTreeRoot;
			
			while(currentNode.branches != undefined) {
				currentFieldInfo = this.fieldNameInfo(currentNode.field);
				
				if(currentFieldInfo.type == this.DIM || currentFieldInfo.type == this.DATE) {
					for(var branchIdx = 0; branchIdx<currentNode.branches.length; branchIdx++) {
						if(currentNode.branches[branchIdx].filter.entry == keyCodes[currentFieldInfo.rawDataIndex][rowIdx]) {
							currentNode = currentNode.branches[branchIdx].node;
							break;
						}
					}
				} else if(currentFieldInfo.type == this.FACT) {
					for(var branchIdx = 0; branchIdx<currentNode.branches.length; branchIdx++) {
						if(values[currentFieldInfo.rawDataIndex][rowIdx] >= currentNode.branches[branchIdx].filter.from &&
							values[currentFieldInfo.rawDataIndex][rowIdx] <= currentNode.branches[branchIdx].filter.to) {
							currentNode = currentNode.branches[branchIdx].node;
							break;
						}
					}
				}
			}
			
			actualTargetValue = reversedDictionary[targetFieldName][keyCodes[targetFieldInfo.rawDataIndex][rowIdx]];
			predictedTargetValue = currentNode.label.mostCommonTarget;
			
			if(actualTargetValue == predictedTargetValue) {
				accuracyCount++;
			}
			
			if(confusionMatrix[actualTargetValue] == undefined) {
				confusionMatrix[actualTargetValue] = {};
			}
			
			if(confusionMatrix[actualTargetValue][predictedTargetValue] == undefined) {
				confusionMatrix[actualTargetValue][predictedTargetValue] = 0;
			}
			
			confusionMatrix[actualTargetValue][predictedTargetValue]++;
		}
		
		for(actualTargetValue in confusionMatrix) {
			for(predictedTargetValue in confusionMatrix[actualTargetValue]) {
				confusionMatrix[actualTargetValue][predictedTargetValue] /= recordCount;
			}
		}
		
		return {"accuracy": (accuracyCount/recordCount), "confusionMatrix": confusionMatrix};
	};
	
	this.scoreData = function(decisionTreeRoot, newFieldName) {
		var newFieldIdx = this.addDimension(newFieldName);
		var values = this.values;
		var keyCodes = this.keyCodes;
		var recordCount = this.recordCount;
		var currentNode;
		var currentFieldInfo;
		var keyCodeLookup = {};
		var depth = 0;
		
		for(var rowIdx=0; rowIdx<recordCount; rowIdx++) {
			currentNode = decisionTreeRoot;
			
			while(currentNode.branches != undefined) {
				currentFieldInfo = this.fieldNameInfo(currentNode.field);
				
				if(currentFieldInfo.type == this.DIM || currentFieldInfo.type == this.DATE) {
					for(var branchIdx = 0; branchIdx<currentNode.branches.length; branchIdx++) {
						if(currentNode.branches[branchIdx].filter.entry == keyCodes[currentFieldInfo.rawDataIndex][rowIdx]) {
							currentNode = currentNode.branches[branchIdx].node;
							break;
						}
					}
				} else if(currentFieldInfo.type == this.FACT) {
					for(var branchIdx = 0; branchIdx<currentNode.branches.length; branchIdx++) {
						if(values[currentFieldInfo.rawDataIndex][rowIdx] >= currentNode.branches[branchIdx].filter.from &&
							values[currentFieldInfo.rawDataIndex][rowIdx] <= currentNode.branches[branchIdx].filter.to) {
							currentNode = currentNode.branches[branchIdx].node;
							break;
						}
					}
				}
			}
			
			// Score the record
			if(keyCodeLookup[currentNode.label.mostCommonTarget] == undefined) {
				keyCodeLookup[currentNode.label.mostCommonTarget] 
					= this.addDimensionValue(newFieldName, currentNode.label.mostCommonTarget);
			}
			keyCodes[newFieldIdx][rowIdx] = keyCodeLookup[currentNode.label.mostCommonTarget];
		}
	};
	
	this.setValueForDimension = function(fieldName, value, filters) {
		var valueCodeInfo = this.addDimensionValue(fieldName, value);
		
		var fieldNameInfo = this.fieldNameInfo(fieldName);
		var keyCodeVector = this.keyCodes[fieldNameInfo.rawDataIndex];
		
		var rowIndexes = this.query([{'fieldName': this.RECORD_COUNT_FIELD}], filters, 'row_indexes');
		
		for(var i=0; i<rowIndexes.length; i++) {
			keyCodeVector[rowIndexes[i]] = valueCodeInfo.code;
		}
		
		return valueCodeInfo.isNew;
	};
	
	this.addDimensionValue = function(fieldName, value) {
		if(this.dictionary[fieldName][value] != undefined) {
			return {'isNew': false, 'code': this.dictionary[fieldName][value]};
		}
		
		this.reversedDictionary[fieldName].push(value);
		this.dictionaryLengths[fieldName] = this.reversedDictionary[fieldName].length;
		this.dictionary[fieldName][value] = this.reversedDictionary[fieldName].length-1;
		
		return {'isNew': true, 'code': this.reversedDictionary[fieldName].length-1};
	};
	
	this.addDimension = function(fieldName) {
		if(this.fieldSpec[fieldName] != undefined) {
			return -1;
		}
		
		this.header.push(fieldName);
		this._DimensionOrFactSpec.push(this.DIM);
		this.dimensionIndexToHeader[this.dimCount] = fieldName;
		this.compressedDataToRawDataIndexes.push(this.dimCount++);
		this.fieldSpec[fieldName] = this._DimensionOrFactSpec[this._DimensionOrFactSpec.length-1];
		this.headerNameToHeaderIndex[fieldName] = this.header.length-1;
		
		this.dictionary[fieldName] = {};//new Array();
		this.reversedDictionary[fieldName] = new Array();
		this.dictionaryLengths[fieldName] = 0;
		
		this.reversedDictionaryToDatesReversedDictionaryLookup.push(new Array());
		
		this._dictionary.push(this.dictionary[fieldName]);
		this._reversedDictionary.push(this.reversedDictionary[fieldName]);
		this.keyCodes.push(new Int32Array(this.recordCount));
		
		return this.dimCount-1;
	};
	
	this.equiWidthBinValue = function(field, binCount) {
		var values = this.values;
		var keyCodes = this.keyCodes;
		
		var valueIdx = this.compressedDataToRawDataIndexes[this.headerNameToHeaderIndex[field]];
		
		var recordCount = this.recordCount;
		
		var max = MIN_INT, min = MAX_INT;
		
		var histogram = new Array();
		
		var fieldName = field + ' (equi-binned)';
		var dimIdx = this.addDimension(fieldName);
		
		var binIdx;
		
		for(var i=0; i<recordCount; i++) {
			if(values[valueIdx][i] > max) {
				max = values[valueIdx][i];
			}
			if(values[valueIdx][i] < min) {
				min = values[valueIdx][i];
			}
		}
		
		var bin_size = (max - min) / binCount;
		var from = min, to = bin_size;
		
		for(var i=0; i<binCount; i++) {
			this.reversedDictionary[fieldName].push(parseFloat(from).toFixed(2) + ' - ' + parseFloat(to).toFixed(2));
			histogram.push({'lower': from, 'upper': to, 'count': 0});
			from = to;
			to += bin_size;
		}
		
		for(var i=0; i<recordCount; i++) {
			binIdx = Math.floor(values[valueIdx][i] / bin_size);
			
			if(binIdx == histogram.length) {
				binIdx--;
			}
			
			histogram[binIdx].count++;
			
			keyCodes[dimIdx][i] = binIdx;
		}
		
		return fieldName;
	};
	
	this.getPercentilesByTarget = function(valueFieldName, targetFieldName, filters, bins) {
		var valueFieldInfo = this.fieldNameInfo(valueFieldName);
		var targetFieldInfo = this.fieldNameInfo(targetFieldName);
		
		var valueFieldValues = this.values[valueFieldInfo.rawDataIndex];
		var targetKeyCodes = this.keyCodes[targetFieldInfo.rawDataIndex];
		
		var targetDictionary = this.reversedDictionary[targetFieldName];
		
		var recordCount = this.recordCount;
		
		var _valueVector = new Array(recordCount);
		
		var priorEntropyInfo = this.entropy(targetFieldName, filters);
		
		var bestSplitInfo
			= this.getBestSplit(priorEntropyInfo.entropy, valueFieldName, targetFieldName, filters, 'row_indexes');
			
		var valuesByTarget = {}, percentilesByTarget = {};
		
		var rowIdx;
		
		var valueArray;
		
		var binSizePct = 100/bins, binStep = binSizePct;
		
		for(var rowIndexesIdx=0; rowIndexesIdx<bestSplitInfo.rowIndexes.length; rowIndexesIdx++) {
			rowIdx = bestSplitInfo.rowIndexes[rowIndexesIdx];
			
			if(valuesByTarget[targetDictionary[targetKeyCodes[rowIdx]]] == undefined) {
				valuesByTarget[targetDictionary[targetKeyCodes[rowIdx]]] = new Array();
			}
			
			valuesByTarget[targetDictionary[targetKeyCodes[rowIdx]]].push(valueFieldValues[rowIdx]);
		}
		
		for(var target in valuesByTarget) {
			valuesByTarget[target].sort(function(a,b) { return a - b;});
			
			valueArray = valuesByTarget[target];
			
			percentilesByTarget[target] = new Array();
			
			for(var i=0; i<valueArray.length; i++) {
				if((i+1) / valueArray.length > (binStep/100)) {
					percentilesByTarget[target].push({'percentile': binStep, 'value': valueArray[i]});
					binStep += binSizePct;
				}
			}
			
			percentilesByTarget[target].push({'percentile': binStep, 'value': valueArray[valueArray.length-1]});
			
			binStep = binSizePct;
		}
		
		return {
			'info': 'percentilesByTarget',
			'valueFieldName': valueFieldName,
			'targetFieldName': targetFieldName,
			'percentiles': percentilesByTarget,
			'bestSplit': bestSplitInfo.splitpoint,
			'bestSplitInformationGain': bestSplitInfo.informationGain
		};
	};
	
	/*
	** n-tile binning. n = binCount
	*/
	this.binValue = function(field, binCount) {
		
		var values = this.values;
		var keyCodes = this.keyCodes;
		
		var valueIdx = this.compressedDataToRawDataIndexes[this.headerNameToHeaderIndex[field]];
		
		var recordCount = this.recordCount;
		
		var _valueVector = new Array(recordCount);
		
		for(var i=0; i<_valueVector.length; i++) {
			_valueVector[i] = {'index': i, 'value': this.values[valueIdx][i]};
		}
		
		var sortedValueVector = _valueVector.slice(0).sort(function(a,b) { return a.value - b.value;});
		
		var binSize = 100 / binCount;
		var binStep = binSize;
		var lowerBound = Math.round(sortedValueVector[0].value), upperBound = 0;
		
		var binBounds = new Array();
		
		var pct;
		
		var fieldName = field + ' (binned)';
		
		var dimIdx = this.addDimension(fieldName);
		
		var keyCode = 0;
		
		for(var i=0; i<sortedValueVector.length; i++) {
			pct = ((i+1)/recordCount)*100;
			
			keyCodes[dimIdx][sortedValueVector[i].index] = keyCode;
			
			if(pct > binStep) {
				binBounds.push({'percentile': binStep, 'value': sortedValueVector[i-1].value, 'index': sortedValueVector[i-1].index});
				binStep += binSize;
				
				upperBound = Math.round(sortedValueVector[i-1].value);
				
				keyCode = this.reversedDictionary[fieldName].push(lowerBound + ' - ' + upperBound);
				
				lowerBound = upperBound;
			}
		}
		
		upperBound = Math.round(sortedValueVector[recordCount-1].value);
		this.reversedDictionary[fieldName].push(lowerBound + ' - ' + upperBound);
		
		binBounds.push({'percentile': binStep, 'value': sortedValueVector[recordCount-1].value, 'index': sortedValueVector[recordCount-1].index});
		
		return fieldName;
	}
	
	this.initDB = function() {
		this.resultSetKeys = new Array(20);
		this.resultSetValues = new Array(10);
		
		for(var i=0; i<this.resultSetKeys.length; i++) {
			this.resultSetKeys[i] = new Int32Array(5000);
		}
		
		for(var i=0; i<this.resultSetValues.length; i++) {
			this.resultSetValues[i] = new Array(5000);
		}
	};
	
	this.getValueStat = function(fieldName) {
		return this.valueStats[this.fieldNameToRawDataIndex(fieldName)];
	};
	
	this.fieldNameToRawDataIndex = function(fieldName) {
		return this.compressedDataToRawDataIndexes[this.headerNameToHeaderIndex[fieldName]];
	};
	
	this.fieldNameInfo = function(fieldName) {
		if(this.fieldSpec[fieldName] == undefined) {
			return undefined;
		}
		if(this.fieldSpec[fieldName] == this.DIM || this.fieldSpec[fieldName] == this.DATE) {
			return {
				"type": this.fieldSpec[fieldName],
				"rawDataIndex": this.compressedDataToRawDataIndexes[this.headerNameToHeaderIndex[fieldName]],
				"cardinality": this.reversedDictionary[fieldName].length
			};
		} else {
			return {
				"type": this.fieldSpec[fieldName],
				"rawDataIndex": this.compressedDataToRawDataIndexes[this.headerNameToHeaderIndex[fieldName]]
			};
		}
	};
	
	this.query = function(fields, filters, outputType) {
		
		var keyIndexes = new Array();
		var keyLookupInfo = new Array();
		var valueIndexes = new Array();
		var dimensionFilterIndexes = new Array();
		var measureFilterIndexes = new Array();
		var aggregateTreeRoot, currentAggregateTreeNode;
		
		var keyCodes = this.keyCodes;
		var values = this.values;
		var dictionaryLengths = this.dictionaryLengths;
		var reversedDictionary = this.reversedDictionary;
		
		var dimCount = this.dimCount;
		var factCount = this.factCount;
		
		var currentKeyCode;
		var currentKeyValue;
		var currentValue;
		
		var highLevelWaterMark = 0;
		var currentResultSetIndex;
		
		var resultSetPointers = new Array();
		
		var resultSetKeys = this.resultSetKeys;
		var resultSetValues = this.resultSetValues;
		
		var filter,
			secondaryFilter,
			secondaryDictionaryEntry;
		
		var FILTER_INCLUDE_ALL = -1,
			FILTER_EXCLUDE_ALL = -2,
			FILTER_INCLUDE_ALL_EXCEPT = -3,
			FILTER_EXCLUDE_ALL_EXCEPT = -4,
			FILTER_INCLUDE_RANGE = -5,
			FILTER_ONE = -6;
			
		var _RECORD_COUNT = -1;
		
		var keyIndexesLength = 0;
		
		var includedRows = new Array();
		
		var OUTPUT_TYPE_HTML = 0,
			OUTPUT_TYPE_JSON = 1,
			OUTPUT_TYPE_ROW_INDEXES = 2,
			OUTPUT_TYPE_JSON_COLUMN = 3,
			OUTPUT_TYPE_JSON_HASH = 4;
			
		var _outputType;
		
		if(outputType == 'html') {
			_outputType = OUTPUT_TYPE_HTML;
		} else if(outputType == 'json') {
			_outputType = OUTPUT_TYPE_JSON;
		} else if(outputType == 'row_indexes') {
			_outputType = OUTPUT_TYPE_ROW_INDEXES;	
		} else if(outputType == 'json_column') {
			_outputType = OUTPUT_TYPE_JSON_COLUMN;
		} else if(outputType == 'json_hash') {
			_outputType = OUTPUT_TYPE_JSON_HASH;
		}
		
		var dateInfoFields = this.dateInfoFields();
		
		var fieldHash = {}, expressionFields = new Array(), field, newField;
		
		// Extract fieldnames that are included in query
		/*for(var i=0; i<fields.length; i++) {
			
			field = fields[i];
			
			if(!field.isExpression) {
				fieldHash[field.fieldName] = field;
			} else if(field.isExpression) {
				expressionFields.push(field);
			}
		}
		
		// Compile expressions
		for(var i=0; i<expressionFields.length; i++) {
			
			field = expressionFields[i];
			field['variables'] = new Array();
			
			for(fieldName in this.fieldSpec) {
				if(field.expression.indexOf(fieldName) > -1) {
					if(fieldHash[fieldName] == undefined) {
						newField = {'fieldName': fieldName}
						fields.push(newField);
						field.variables.push(newField);
					} else if(fieldHash[fieldName] != undefined) {
						field.variables.push(fieldHash[fieldName]);
					}
					
					field.expression =
						field.expression.replace((new RegExp(fieldName, 'g')), 'v[' + (field.variables.length-1) + ']');
				}
			}
			
			field['variableList'] = new Array(field.variables.length);
			
			field['compiledExpression'] = eval('(function(v) { return ' + field.expression + '; })');
		}*/
		
		for(var i=0; i<fields.length; i++) {
			
			var field = fields[i];
			
			if(this.fieldSpec[field.fieldName] == this.DIM || this.fieldSpec[field.fieldName] == this.DATE) {
				if(keyIndexes.length == 0) {
					// First dimension
					aggregateTreeRoot = new Array(dictionaryLengths[field.fieldName]);
					//aggregateTreeRoot = new Array();
				}
				/*field['resultSetPointer'] = */resultSetPointers.push({'type': 'key', 'keyType': 'directKey', 'index': keyIndexes.length}) - 1;
				/*field['keyIndex'] = */keyIndexes.push(this.compressedDataToRawDataIndexes[this.headerNameToHeaderIndex[field.fieldName]]) - 1;
				keyLookupInfo.push({
					'type': 'directKey',
					'keyTable': keyCodes,
					'fieldDistinctValueCount': dictionaryLengths[field.fieldName]
				});
			} else if(this.fieldSpec[field.fieldName] == this.FACT) {
				/*field['resultSetPointer'] = */resultSetPointers.push({'type': 'value', 'index': valueIndexes.length}) - 1;
				/*field['valueIndex'] = */valueIndexes.push(this.compressedDataToRawDataIndexes[this.headerNameToHeaderIndex[field.fieldName]]) - 1;
			} else if(field.fieldName == this.RECORD_COUNT_FIELD) {
				/*field['resultSetPointer'] = */resultSetPointers.push({'type': 'value', 'index': valueIndexes.length}) - 1;
				/*field['valueIndex'] = */valueIndexes.push(_RECORD_COUNT) - 1;
			} else if(field.dateInfoField == true) {
				if(keyIndexes.length == 0) {
					// First dimension
					aggregateTreeRoot = new Array(this.dateInfoReversedDictionary[dateInfoFields[field.dateInfoFieldName]].length);
					//aggregateTreeRoot = new Array();
				}
				/*field['resultSetPointer'] = */resultSetPointers.push({
					'type': 'key',
					'keyType': 'derivedKey',
					'lookupTable': this.dateInfoReversedDictionary,
					'lookupTableFieldIdx': dateInfoFields[field.dateInfoFieldName],
					'index': keyIndexes.length
				}) - 1;
				/*field['keyIndex'] = */keyIndexes.push(this.compressedDataToRawDataIndexes[this.headerNameToHeaderIndex[field.dateFieldName]]) - 1;
				keyLookupInfo.push({
					'type': 'derivedKey',
					'joinTable': this.reversedDictionaryToDatesReversedDictionaryLookup,
					'lookupTable': this.datesReversedDictionary,
					'lookupTableFieldIdx': dateInfoFields[field.dateInfoFieldName],
					'fieldDistinctValueCount': this.dateInfoReversedDictionary[dateInfoFields[field.dateInfoFieldName]].length
				});
			}else if(field.isExpression) {
				/*field['resultSetPointer'] = */resultSetPointers.push({
					'type': 'expression',
					'field': field
				}) - 1;
			}
		}
		
		/*for(var i=0; i<expressionFields.length; i++) {
			field = expressionFields[i];
			
			for(var j=0; j<field.variables.length; j++) {
				
				field.variables[j] = {
					'resultSetPointerIndex': resultSetPointers[field.variables[j].resultSetPointer].index,
					'resultSetType':  resultSetPointers[field.variables[j].resultSetPointer].type
				};
				
			}
		}*/
		
		keyIndexesLength = keyIndexes.length;
		
		if(keyIndexesLength == 0) {
			aggregateTreeRoot = new Array(1);
		}
		
		for(var secondaryDictionaryName in this.secondaryDictionary) {
			secondaryFilter = filters[secondaryDictionaryName];
			
			if(secondaryFilter != undefined) {
				
				secondaryDictionaryEntry = this.secondaryDictionary[secondaryDictionaryName];
				
				secondaryFilter.isSecondaryFilter = true;

				filter = filters[secondaryDictionaryEntry.referencedDictionaryName];

				if(filter == undefined) {
					filter = {
						'type': 'dimension',
						'entries': this._Array(dictionaryLengths[secondaryDictionaryEntry.referencedDictionaryName], false),
						'allIncluded': secondaryFilter.allIncluded,
						'filterCount': 0,
						'dimensionIndex': this.fieldNameInfo(secondaryDictionaryEntry.referencedDictionaryName).rawDataIndex
					};
					filters[secondaryDictionaryEntry.referencedDictionaryName] = filter;
				}
				
				if(secondaryFilter.filterCount > 0) {
					for(var i=0; i<secondaryFilter.entries.length; i++) {
						if(secondaryFilter.entries[i]) {
							for(var j=0; j<secondaryDictionaryEntry.wordBagPointers[i].length; j++) {
								if(!filter.entries[secondaryDictionaryEntry.wordBagPointers[i][j]]) {
									filter.entries[secondaryDictionaryEntry.wordBagPointers[i][j]] = true;
									filter.filterCount++;
								}
							}
						}
					}
				}
			}
		}
		
		var fieldInfo, rawDataIndex, newFilterObj;
		
		for(var filterEntry in filters) {
			fieldInfo = this.fieldNameInfo(filterEntry);
			
			filter = filters[filterEntry];
			
			if(filter.isSecondaryFilter != undefined) {
				continue;
			}
			
			newFilterObj = {};
			
			if(filter.type == 'dimension') {
				
				if(fieldInfo != undefined) {
					newFilterObj["dimensionIndex"] = fieldInfo.rawDataIndex;
				} else if(fieldInfo == undefined) {
					if(filter.isDateInfoFilter) {
						newFilterObj["dimensionIndex"] = this.fieldNameInfo(filter.dateFieldName).rawDataIndex;
						newFilterObj["isDerived"] = true;
						newFilterObj["joinColumn"] = this.reversedDictionaryToDatesReversedDictionaryLookup[newFilterObj["dimensionIndex"]];
						newFilterObj["lookupTable"] = this.datesReversedDictionary;
						newFilterObj["lookupTableFieldIdx"] = this.dateInfoFields()[filter.dateInfoFieldName];
					}
				}
				
				if(filter.filterCount > 0 && filter.allIncluded) {
					newFilterObj["filter"] = [FILTER_INCLUDE_ALL_EXCEPT, filter.entries, {}];
				} else if(filter.filterCount > 0 && !filter.allIncluded) {
					newFilterObj["filter"] = [FILTER_EXCLUDE_ALL_EXCEPT, filter.entries, {}];
				} else if(filter.filterCount == 0 && !filter.allIncluded) {
					newFilterObj["filter"] = [FILTER_EXCLUDE_ALL,null, {}];
				} else if(filter.filterCount == 0 && filter.allIncluded) {
					newFilterObj["filter"] = [FILTER_INCLUDE_ALL,null, {}];
				} else if(filter.filterOne) {
					newFilterObj["filter"] = [FILTER_ONE,filter.entry, {}];
				}
				
				dimensionFilterIndexes.push(newFilterObj);
				
			} else if(filter.type == 'measure') {
				
				newFilterObj["factIndex"] = fieldInfo.rawDataIndex;
				newFilterObj["filter"] = [FILTER_INCLUDE_RANGE, [filter.from, filter.to], [undefined, undefined]];
				
				measureFilterIndexes.push(newFilterObj);
				
			}
		}
		
		var rowIdx, keyIdx, valueIdx, valueIdxEntry;
		var currentKeys = new Int32Array(keyIndexes.length);
		var include = true;
		
		var FILTER_TYPE = 0,
			FILTER_ENTRIES = 1,
			FILTER_ENTRY = 1,
			FILTER_RANGE = 1,
			FILTER_INCLUDED_VALUES = 2;
		var FILTER_RANGE_FROM = 0,
			FILTER_RANGE_TO = 1,
			FILTER_INCLUDED_VALUES_MIN = 0,
			FILTER_INCLUDED_VALUES_MAX = 1;
		
		var keyLookupInfoEntry;
		var dimIdx, factIdx;
		var filterInfo;
		
		for(rowIdx=0; rowIdx<this.recordCount; rowIdx++) {
			
			include = true;
			
			// Dimension filter
			for(var dimFilterIdx=0; dimFilterIdx<dimensionFilterIndexes.length; dimFilterIdx++) {
				
				filterInfo = dimensionFilterIndexes[dimFilterIdx];
				filter = filterInfo.filter;
				dimIdx = filterInfo.dimensionIndex;
				
				/*if(keyCodes[dimIdx][rowIdx] == 0)
					this.debug(keyCodes[dimIdx][rowIdx]);*/
				
				// Filter
				if(filter[FILTER_TYPE] == FILTER_INCLUDE_ALL) {
					continue;
				} else if(filter[FILTER_TYPE] == FILTER_INCLUDE_ALL_EXCEPT) {
					
					currentKeyCode = keyCodes[dimIdx][rowIdx];
					
					if(filterInfo.isDerived) {
						currentKeyCode = filterInfo.lookupTable[ filterInfo.joinColumn[currentKeyCode] ].info[
							filterInfo.lookupTableFieldIdx
						];
					}
					
					if(filter[FILTER_ENTRIES][currentKeyCode]) {
						include = false;
						break;
					}
				} else if(filter[FILTER_TYPE] == FILTER_EXCLUDE_ALL_EXCEPT) {
					
					currentKeyCode = keyCodes[dimIdx][rowIdx];
					
					if(filterInfo.isDerived) {
						currentKeyCode = filterInfo.lookupTable[ filterInfo.joinColumn[currentKeyCode] ].info[
							filterInfo.lookupTableFieldIdx
						];
					}
					
					if(filter[FILTER_ENTRIES][currentKeyCode]) {
						include = true;
					} else {
						include = false;
						break;
					}
				} else if(filter[FILTER_TYPE] == FILTER_EXCLUDE_ALL) {
					include = false;
					break;
				} else if(filter[FILTER_TYPE] == FILTER_ONE) {
					if(filter[FILTER_ENTRY] == keyCodes[dimIdx][rowIdx]) {
						include = true;
					} else {
						include = false;
						break;
					}
				}
				
			}
			
			// Measure filter
			for(var measureIdx=0; measureIdx<measureFilterIndexes.length; measureIdx++) {
				
				filter = measureFilterIndexes[measureIdx].filter;
				factIdx = measureFilterIndexes[measureIdx].factIndex;
				
				currentValue = values[factIdx][rowIdx];
				
				if(!(currentValue >= filter[FILTER_RANGE][FILTER_RANGE_FROM] &&
					currentValue <= filter[FILTER_RANGE][FILTER_RANGE_TO])) {
					include = false;
					break;
				}
			}
			
			if(_outputType == OUTPUT_TYPE_ROW_INDEXES) {
				if(include) {
					includedRows.push(rowIdx);
				}
				continue;
			}
			
			if(include) {
				
				currentAggregateTreeNode = aggregateTreeRoot;

				for(keyIdx=0; keyIdx<(keyIndexesLength - 1); keyIdx++) {

					currentKeyCode = keyCodes[keyIndexes[keyIdx]][rowIdx];
					//currentKeyValue = reversedDictionary[keyNames[keyIdx]][currentKeyCode];
					
					// For derived keys, i.e. join
					keyLookupInfoEntry = keyLookupInfo[keyIdx];
					if(keyLookupInfoEntry.type == 'derivedKey') {
						currentKeyCode = 
							keyLookupInfoEntry.lookupTable[ keyLookupInfoEntry.joinTable[keyIndexes[keyIdx]][currentKeyCode] ].info[
								keyLookupInfoEntry.lookupTableFieldIdx
							];
					}
					
					currentKeys[keyIdx] = currentKeyCode;

					if(currentAggregateTreeNode[currentKeyCode] == undefined) {
						currentAggregateTreeNode[currentKeyCode] = new Array(keyLookupInfo[keyIdx+1].fieldDistinctValueCount);
						//currentAggregateTreeNode[currentKeyValue] = new Array();
					}

					currentAggregateTreeNode = currentAggregateTreeNode[currentKeyCode];

				}
				
				if(keyIndexesLength > 0) {
					keyIdx = (keyIndexesLength - 1);

					currentKeyCode = keyCodes[keyIndexes[keyIdx]][rowIdx];
					
					// For derived keys, i.e. join
					keyLookupInfoEntry = keyLookupInfo[keyIdx];
					if(keyLookupInfoEntry.type == 'derivedKey') {
						currentKeyCode = 
							keyLookupInfoEntry.lookupTable[ keyLookupInfoEntry.joinTable[keyIndexes[keyIdx]][currentKeyCode] ].info[
								keyLookupInfoEntry.lookupTableFieldIdx
							];
					}
					
					currentKeys[keyIdx] = currentKeyCode;
				} else {
					currentKeyCode = 0;
				}
			

				if(currentAggregateTreeNode[currentKeyCode] == undefined) {
					currentAggregateTreeNode[currentKeyCode] = highLevelWaterMark;
					currentResultSetIndex = highLevelWaterMark++;

					for(valueIdx = 0; valueIdx < valueIndexes.length; valueIdx++) {
						valueIdxEntry = valueIndexes[valueIdx];
						if(valueIdxEntry >= 0) {
							resultSetValues[valueIdx][currentResultSetIndex] = values[valueIdxEntry][rowIdx];
						} else if(valueIdxEntry == _RECORD_COUNT) {
							resultSetValues[valueIdx][currentResultSetIndex] = 1;
						}
					}

				} else {
					currentResultSetIndex = currentAggregateTreeNode[currentKeyCode];

					for(valueIdx = 0; valueIdx < valueIndexes.length; valueIdx++) {
						valueIdxEntry = valueIndexes[valueIdx];
						if(valueIdxEntry >= 0) {
							resultSetValues[valueIdx][currentResultSetIndex] += values[valueIdxEntry][rowIdx];
						} else if(valueIdxEntry == _RECORD_COUNT) {
							resultSetValues[valueIdx][currentResultSetIndex] += 1;
						}
					}
				}

				for(keyIdx = 0; keyIdx<currentKeys.length; keyIdx++) {
					resultSetKeys[keyIdx][currentResultSetIndex] = currentKeys[keyIdx];
				}
				
			}
			
		}
		
		if(_outputType == OUTPUT_TYPE_ROW_INDEXES) {
			return includedRows;
		}
		
		root = aggregateTreeRoot;
		
		// Build actual resultset
		
		
		if(outputType == 'html') {
			var html = '<table>';

			html += '<tr>';
			for(var i=0; i<fields.length; i++) {
				html += '<td>' + fields[i].fieldName + '</td>';
			}
			html += '</tr>';

			var resultSetPointer;

			rsp = resultSetPointers;
			
			/*
			
			resultSetPointers.push({
				'type': 'key',
				'keyType': 'derivedKey',
				'lookupTable': this.dateInfo,
				'lookupTableFieldIdx': dateInfoFields[fields[i].dateInfoFieldName],
				'index': keyIndexes.length
			});
			
			*/

			for(var resultSetRowIdx=0; resultSetRowIdx<highLevelWaterMark; resultSetRowIdx++) {
				html += '<tr>';
				for(var resultsetPointerIdx=0; resultsetPointerIdx<resultSetPointers.length; resultsetPointerIdx++) {
					resultSetPointer = rsp[resultsetPointerIdx];

					if(resultSetPointer.type == 'key') {
						if(resultSetPointer.keyType == 'directKey') {
							html += '<td>' + reversedDictionary[fields[resultsetPointerIdx].fieldName][resultSetKeys[resultSetPointer.index][resultSetRowIdx]] + '</td>';
						} else if(resultSetPointer.keyType == 'derivedKey') {
							html +=
								'<td>' + resultSetPointer.lookupTable[resultSetPointer.lookupTableFieldIdx][resultSetKeys[resultSetPointer.index][resultSetRowIdx]] + '</td>';
						}
					}

					if(resultSetPointer.type == 'value') {
						html += '<td>' + resultSetValues[resultSetPointer.index][resultSetRowIdx] + '</td>';
					}
				}
				html += '</tr>';
			}

			html += '</table>';

			return html;
			
		} else if(outputType == 'json') {
			var output = new Array();
			var row;

			// Header
			row = new Array();
			for(var i=0; i<fields.length; i++) {
				row.push(fields[i].fieldName);
			}
			
			output.push(row);

			var resultSetPointer;

			rsp = resultSetPointers;

			for(var resultSetRowIdx=0; resultSetRowIdx<highLevelWaterMark; resultSetRowIdx++) {
				row = new Array();
				
				/*for(var i=0; i<expressionFields.length; i++) {
					field = expressionFields[i];
					
					for(var j=0; j<field.variables.length; j++) {
						
						if(field.variables[j].resultSetType == 'value') {
							field.variableList[j] = resultSetValues[field.variables[j].resultSetPointerIndex][resultSetRowIdx];
						} else if(field.variables[j].resultSetType == 'key') {
							field.variableList[j] = resultSetKeys[field.variables[j].resultSetPointerIndex][resultSetRowIdx];
						}
					}
					
					field.result = field.compiledExpression(field.variableList);
				}*/
				
				for(var resultsetPointerIdx=0; resultsetPointerIdx<resultSetPointers.length; resultsetPointerIdx++) {
					resultSetPointer = rsp[resultsetPointerIdx];

					if(resultSetPointer.type == 'key') {
						if(resultSetPointer.keyType == 'directKey') {
							row.push(reversedDictionary[fields[resultsetPointerIdx].fieldName][resultSetKeys[resultSetPointer.index][resultSetRowIdx]]);
						} else if(resultSetPointer.keyType == 'derivedKey') {
							row.push(resultSetPointer.lookupTable[resultSetPointer.lookupTableFieldIdx][resultSetKeys[resultSetPointer.index][resultSetRowIdx]]);
						}
					} else if(resultSetPointer.type == 'value') {
						row.push(resultSetValues[resultSetPointer.index][resultSetRowIdx]);
					} else if(resultSetPointer.type == 'expression') {
						row.push(resultSetPointer.field.result);
					}
				}
				output.push(row);
			}
			
			//this.debug(output);
			
			return {"resultSet": output, "resultSetRowCount": highLevelWaterMark, "outputType": outputType};
			
		} else if(outputType == 'json_column') {
			var column_output = {};
			
			for(var i=0; i<fields.length; i++) {
				column_output[fields[i].fieldName] = new Array();
			}
			
			var resultSetPointer;

			rsp = resultSetPointers;
			
			for(var resultsetPointerIdx=0; resultsetPointerIdx<resultSetPointers.length; resultsetPointerIdx++) {
				resultSetPointer = rsp[resultsetPointerIdx];

				if(resultSetPointer.type == 'key') {
					for(var resultSetRowIdx=0; resultSetRowIdx<highLevelWaterMark; resultSetRowIdx++) {
						if(resultSetPointer.keyType == 'directKey') {
							column_output[fields[resultsetPointerIdx].fieldName].push(
								reversedDictionary[fields[resultsetPointerIdx].fieldName][resultSetKeys[resultSetPointer.index][resultSetRowIdx]]
							);
						} else if(resultSetPointer.keyType == 'derivedKey') {
							column_output[fields[resultsetPointerIdx].fieldName].push(
								resultSetPointer.lookupTable[resultSetPointer.lookupTableFieldIdx][resultSetKeys[resultSetPointer.index][resultSetRowIdx]]
							);
						}
					}
				}

				if(resultSetPointer.type == 'value') {
					for(var resultSetRowIdx=0; resultSetRowIdx<highLevelWaterMark; resultSetRowIdx++) {
						column_output[fields[resultsetPointerIdx].fieldName].push(
							resultSetValues[resultSetPointer.index][resultSetRowIdx]
						);
					}
				}
			}
			
			return {"resultSet": column_output, "resultSetRowCount": highLevelWaterMark, "outputType": outputType};
			
		} else if(outputType == 'json_hash') {
			var hash_output = new Array();
			var hash_output_coded = new Array();

			var resultSetPointer;

			rsp = resultSetPointers;

			for(var resultSetRowIdx=0; resultSetRowIdx<highLevelWaterMark; resultSetRowIdx++) {
				row = {};
				row_coded = {};
				for(var resultsetPointerIdx=0; resultsetPointerIdx<resultSetPointers.length; resultsetPointerIdx++) {
					resultSetPointer = rsp[resultsetPointerIdx];

					if(resultSetPointer.type == 'key') {
						if(resultSetPointer.keyType == 'directKey') {
							row[fields[resultsetPointerIdx].fieldName] 
								= reversedDictionary[fields[resultsetPointerIdx].fieldName][resultSetKeys[resultSetPointer.index][resultSetRowIdx]];
							row_coded[fields[resultsetPointerIdx].fieldName] = resultSetKeys[resultSetPointer.index][resultSetRowIdx];
						} else if(resultSetPointer.keyType == 'derivedKey') {
							row[fields[resultsetPointerIdx].fieldName] 
								= resultSetPointer.lookupTable[resultSetPointer.lookupTableFieldIdx][resultSetKeys[resultSetPointer.index][resultSetRowIdx]];
							row_coded[fields[resultsetPointerIdx].fieldName]
								= resultSetKeys[resultSetPointer.index][resultSetRowIdx];
						}
					}

					if(resultSetPointer.type == 'value') {
						row[fields[resultsetPointerIdx].fieldName] 
							= resultSetValues[resultSetPointer.index][resultSetRowIdx];
						row_coded[fields[resultsetPointerIdx].fieldName] 
							= resultSetValues[resultSetPointer.index][resultSetRowIdx];
					}
				}
				hash_output.push(row);
				hash_output_coded.push(row_coded);
			}
			
			return {"resultSet": hash_output, "resultSetCoded": hash_output_coded, "resultSetRowCount": highLevelWaterMark, "outputType": outputType};
		}
	};
	
	this.getDateInfo = function(dateFieldIdx, dateKey, dateInfoIdx) {
		return this.datesReversedDictionary[
			this.reversedDictionaryToDatesReversedDictionaryLookup[fieldIdx][dateKey]
			][dateInfoIdx];
	};
	
	this.listAllData = function() {
		var output = '';
		
		for(var i=0; i<this.header.length; i++) {
			output += this.header[i] + ';';
		}
		output = output.substring(0, output.length-1) + '\n';
		
		for(var i=0; i<this.recordCount; i++) {
			for(var j=0; j<this.compressedDataToRawDataIndexes.length; j++) {
				if(this.fieldSpec[this.header[j]] == this.DIM || this.fieldSpec[this.header[j]] == this.DATE) {
					output += this._reversedDictionary[j][this.keyCodes[this.compressedDataToRawDataIndexes[j]][i]] + ';';
				} else {
					output += this.values[this.compressedDataToRawDataIndexes[j]][i] + ';';
				}
			}
			output = output.substring(0, output.length-1) + '\n';
		}
		return output;
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
	** Creates a _rows*_columns matrix
	*/
	this.matrix = function(_rows, _columns, type) {
		var m = new Array(_columns);
		for(var i=0; i<_columns; i++) {
			if(type == 'Int32Array') {
				m[i] = new Int32Array(_rows);
			} else if(type == 'Float32Array') {
				m[i] = this._Array(_rows, 0); //new Float32Array(_rows);
			}
		}
		return m;
	};
	
	this._Array = function(length, initValue) {
		var a = new Array(length);
		for(var i=0; i<length; i++) {
			a[i] = initValue;
		}
		return a;
	};
	
	this.debug = function(message) {
		postMessage({'reply': 'debug', 'message': message});
	};
	
	this.copyObject = function(obj) {
		if (null == obj || "object" != typeof obj) return obj;
	    var copy = obj.constructor();
	    for (var attr in obj) {
	        if (obj.hasOwnProperty(attr)) copy[attr] = obj[attr];
	    }
	    return copy;
	};
}

// For node.js
try {
	module.exports = jsIMDB;
} catch(e) {
	;
}