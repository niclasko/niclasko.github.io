var dataset, datasetheader, datasetheadernames;

var explanations = {};

var binnedValues = {};

var GUIfields = {};
var derivedFieldsInfo = {};

var activeMenu = null;
var menuClickCount = 0;

var imgList;

var selectedFieldTarget = null;
var selectedFieldTargetHref = null;

var jsimdb, timer = new Timer();

var FACT = 1, DIM = 2, DATE = 3;

var worker, _file, pivot, _queryResults, _queryResultsCount;

var filters = {};

var decisionTreeRoot;
var ruleList;

var _fileSampleData, _fieldSpec, _lineSeparator;

var timer = new Timer();

function showLoading() {
	$('#loading').show();
}

function hideLoading() {
	$('#loading').hide();
}

function clearPivot() {
	resetSelection();
	$('#output').html('');
	pivot.initPivot();
}

function resetSelection() {
	$('#rows').html('');
	$('#columns').html('');
	$('#measures').html('');
	GUIfields = new Array();
}

function newGUIField(_fieldName, derivedFieldInfo) {
	if(GUIfields[_fieldName] == undefined) {
		GUIfields[_fieldName] = 1;
		
		if(derivedFieldInfo != undefined) {
			pivot.addTabularDataHeaderField(_fieldName);
		}
		
	} else {
		GUIfields[_fieldName]++;
	}
	
	if(derivedFieldInfo != undefined) {
		derivedFieldsInfo[_fieldName] = derivedFieldInfo;
	}
	
	return _fieldName + (GUIfields[_fieldName] > 1 ? ' ' + GUIfields[_fieldName] : '');
}

function removeGUIField(_fieldName) {
	if(GUIfields[_fieldName] != undefined) {
		GUIfields[_fieldName]--;
	}
}

function getFields() {
	var fields = new Array();

	for(field in GUIfields) {
		if(GUIfields[field] > 0) {
			if(derivedFieldsInfo[field] != undefined) {
				fields.push(derivedFieldsInfo[field]);
			} else {
				fields.push({'fieldName': field});
			}
		}
	}

	return fields;
}

function selectField(id, derivedFieldInfo) {
	
	if(selectedFieldTarget == null) {
		return;
	}
	
	var fieldIdx,
		fieldName;
	
	if(id != null) {
		fieldIdx = id.replace('lf','');
		fieldName = datasetheader[fieldIdx];
	} else if(id == null && derivedFieldInfo != undefined) {
		fieldName = derivedFieldInfo.dateInfoFieldName + ' (' + derivedFieldInfo.dateFieldName + ')';
	}
	 
	var fieldId = newGUIField(fieldName, derivedFieldInfo);
	var spanId = fieldId.replace(' ', '');
	var fieldAction = '';
	var fieldHtml;

	if(selectedFieldTarget == 'rows') {
		pivot.addRow(fieldName, fieldId);
		fieldAction = 'menuClickCount++; showDimensionMenu(event, \'' + fieldId + '\',\'Row\');';
	} else if(selectedFieldTarget == 'columns') {
		pivot.addColumn(fieldName, fieldId);
		fieldAction = 'menuClickCount++; showDimensionMenu(event, \'' + fieldId + '\',\'Column\');';
	} else if(selectedFieldTarget == 'measures') {
		pivot.addMeasure(fieldName, fieldId);
		fieldAction = 'menuClickCount++; showMeasureMenu(event, \'' + fieldId + '\');';
	}

	fieldHtml =
		'<span id="' + spanId + '">'
		+ '<a href="javascript:void(null)" onclick="' + fieldAction + '">'
		+ enclose(fieldId) + '</a></span>';

	$('#' + selectedFieldTarget).append(fieldHtml + ' ');

	query(getFields());
}

function clearMenu() {
	if(activeMenu != null) {
		activeMenu.remove();
	}
}

function addDimension(fieldName, blankValue) {
	worker.postMessage(
		{
			"action": "addDimension",
			"fieldName": fieldName,
			"blankValue": blankValue
		}
	);
}

function setFieldValue(fieldName, fieldValue) {
	worker.postMessage(
		{
			"action": "setFieldValue",
			"fieldName": fieldName,
			"fieldValue": fieldValue,
			"filters": filters
		}
	);
}

function showFieldsMenu(e) {
	clearMenu();
	
	var blankValue = 'Not Set';
	
	var menu = $(
		'<div class="menu" style="top: ' + e.pageY + '; left: ' + e.pageX + ';"">'
		+ 'Add new dimension field called <input type="text" id="newDimName" class="input_text">&nbsp;'
		+ '<a href="javascript:void(null)" onclick="var n = $(\'#newDimName\').val(); '
		+ 'if(n == \'\') { alert(\'Please enter a name for the new dimension field.\'); } '
		+ 'else { addDimension(n, \'' + blankValue + '\'); $(this).parent().remove(); }">'
		+ 'Add</a><br>'
		+ '</div>'
	);

	activeMenu = menu;

	$('body').append(menu);
}

function showDimensionMenu(e, fieldId, row_or_column) {
	clearMenu();

	var menu = $(
		'<div class="menu" style="top: ' + e.pageY + '; left: ' + e.pageX + ';" onclick="$(this).remove();">'
		+ '<a href="javascript:void(null)" onclick="pivot.add' + row_or_column + 'SubTotal(\'' + fieldId + '\'); doPivot();">Add sub-total</a><br>'
		+ '<a href="javascript:void(null)" onclick="pivot.remove' + row_or_column + 'SubTotal(\'' + fieldId + '\'); doPivot();">Remove sub-total</a><br>'
		+ '<hr>'
		+ '<a href="javascript:void(null)" onclick="pivot.remove' + row_or_column +
			'(\'' + fieldId + '\'); $(document.getElementById(\'' + fieldId.replace(' ', '') + '\')).remove(); removeGUIField(\'' + 
			fieldId + '\'); query(getFields());">Remove</a><br>'
		+ '</div>'
	);

	activeMenu = menu;

	$('body').append(menu);
}

function showMeasureMenu(e, fieldId) {
	clearMenu();

	var menu = $(
		'<div class="menu" style="top: ' + e.pageY + '; left: ' + e.pageX + ';" onclick="$(this).remove();">'
		+ '<a href="javascript:void(null)" onclick="pivot.setMeasurePercentageOfRowTotal(\'' + fieldId + '\'); doPivot();">% of row total</a><br>'
		+ '<a href="javascript:void(null)" onclick="pivot.setMeasurePercentageOfColumnTotal(\'' + fieldId + '\'); doPivot();">% of column total</a><br>'
		+ '<a href="javascript:void(null)" onclick="pivot.setMeasurePercentageOfPaneTotal(\'' + fieldId + '\'); doPivot();">% of pane total</a><br>'
		+ '<a href="javascript:void(null)" onclick="pivot.measurePercentageClear(\'' + fieldId + '\'); doPivot();">Clear %-formatting</a><br>'
		+ '<hr>'
		+ '<a href="javascript:void(null)" onclick="pivot.setMeasureHeatmapRow(\'' + fieldId + '\'); doPivot();">Heatmap row</a><br>'
		+ '<a href="javascript:void(null)" onclick="pivot.setMeasureHeatmapColumn(\'' + fieldId + '\'); doPivot();">Heatmap column</a><br>'
		+ '<a href="javascript:void(null)" onclick="pivot.setMeasureHeatmapPane(\'' + fieldId + '\'); doPivot();">Heatmap pane</a><br>'
		+ '<a href="javascript:void(null)" onclick="pivot.clearMeasureHeatmap(\'' + fieldId + '\'); doPivot();">Clear heatmap</a><br>'
		+ '<hr>'
		+ '<a href="javascript:void(null)" onclick="pivot.removeMeasure(\'' + fieldId + '\'); $(document.getElementById(\'' +
			fieldId.replace(' ', '') + '\')).remove(); removeGUIField(\'' + fieldId + '\'); query(getFields());">Remove</a>'
		+ '</div>'
	);

	activeMenu = menu;

	$('body').append(menu);
}

function showRowsMenu(e) {
	clearMenu();

	var menu = $(
		'<div class="menu" style="top: ' + e.pageY + '; left: ' + e.pageX + ';" onclick="$(this).remove();">'
		+ '<a href="javascript:void(null)" onclick="pivot.addRowTotal(); doPivot();">Add row grand total</a><br>'
		+ '<a href="javascript:void(null)" onclick="pivot.removeRowTotal(); doPivot();">Remove row grand total</a>'
		+ '</div>'
	);

	activeMenu = menu;

	$('body').append(menu);
}

function showColumnsMenu(e) {
	clearMenu();

	var menu = $(
		'<div class="menu" style="top: ' + e.pageY + '; left: ' + e.pageX + ';" onclick="$(this).remove();">'
		+ '<a href="javascript:void(null)" onclick="pivot.addColumnTotal(); doPivot();">Add column grand total</a><br>'
		+ '<a href="javascript:void(null)" onclick="pivot.removeColumnTotal(); doPivot();">Remove column grand total</a>'
		+ '</div>'
	);

	activeMenu = menu;

	$('body').append(menu);
}

function showMeasuresMenu(e) {
	clearMenu();
	
	var menu = $(
		'<div class="menu" style="top: ' + e.pageY + '; left: ' + e.pageX + ';" onclick="$(this).remove();">'
		+ 'Measure header position:<br>'
		+ '<a href="javascript:void(null)" onclick="pivot.setMeasureHeaderPlacement(pivot.COLUMN_ABOVE); doPivot();">Above columns</a><br>'
		+ '<a href="javascript:void(null)" onclick="pivot.setMeasureHeaderPlacement(pivot.COLUMN_BELOW); doPivot();">Below columns</a><br>'
		+ '<a href="javascript:void(null)" onclick="pivot.setMeasureHeaderPlacement(pivot.ROW_ABOVE); doPivot();">Above rows</a><br>'
		+ '<a href="javascript:void(null)" onclick="pivot.setMeasureHeaderPlacement(pivot.ROW_BELOW); doPivot();">Below rows</a><br>'
		+ '</div>'
	);

	activeMenu = menu;

	$('body').append(menu);
}

function showMeasuresFieldMenu(e, field) {
	clearMenu();
	
	var targetSelect = getTargets(field);
	
	var menu = $(
		'<div class="menu" style="top: ' + e.pageY + '; left: ' + e.pageX + '; display: block;">'
		+ '<a href="javascript:void(null)" onclick="binValue(\'' + field + '\', 10, \'percentile\'); $(this).parent().remove();">Bin value (percentile)</a><br>'
		+ '<a href="javascript:void(null)" onclick="binValue(\'' + field + '\', $(\'#equiWidthBinCount\').val(), \'equi-width\'); $(this).parent().remove();">'
		+ 'Bin value (equi-width)</a> &nbsp;Bins:<input type="text" id="equiWidthBinCount" class="input_text" size="2" value="20"><br>'
		+ '<a href="javascript:void(null)" onclick="addMeasureFilter(\'' + field + '\'); $(this).parent().remove();">Add filter</a><br>'
		+ '<a href="javascript:void(null)" onclick="var e = document.getElementById(\'' + targetSelect.id + '\'); '
		+ 'getPercentilesByTarget(\'' + field + '\', e.options[e.selectedIndex].value, 10); $(this).parent().remove();">Get percentiles by</a>' + targetSelect.html
		+ '</div>'
	);
	
	activeMenu = menu;

	$('body').append(menu);
}

function getTargets(field) {
	
	var id = 'selMeasureTarget';
	
	var html = '<select id="' + id + '" class="input_text">';
	
	for(var i=0; i<_fieldSpec.length; i++) {
		if(_fieldSpec[i].dimensionOrFact == this.DIM) {
			html += '<option value="' + _fieldSpec[i].field + '">' + _fieldSpec[i].field + '</option>';
		}
	}
	
	html += '</select>';
	
	return {'html': html, 'id': id};
}

function getPercentilesByTarget(valueFieldName, targetFieldName, bins) {
	worker.postMessage(
		{
			'action': 'getPercentilesByTarget', 
			'valueFieldName': valueFieldName,
			'targetFieldName': targetFieldName,
			'filters': filters,
			'bins': bins
		}
	);
} 

function showDimensionsFieldMenu(e, field) {
	clearMenu();
	
	var explanationHtml = '';
	
	if(explanations[field] != undefined) {
		
		explanationHtml += '<br><u>Explanations</u>';
		
		for(var i=0; i<explanations[field].length; i++) {
			explanationHtml += '<br><a href="javascript:void(null)" '
				+ 'onclick="showExplanation(\'' + field + '\', ' + i + '); $(this).parent().remove();">' 
				+ explanations[field][i].name + '</a>';
		}
	}
	
	var menu = $(
		'<div class="menu" style="top: ' + e.pageY + '; left: ' + e.pageX + '; display: block;">'
		+ 'Set field value for currently filtered rows. Value: <input type="text" id="fieldLabel" class="input_text">'
		+ ' <a href="javascript:void(null)" onclick="var v = $(\'#fieldLabel\').val(); '
		+ 'if(v == \'\') { alert(\'Please enter a field value\'); } '
		+ 'else { setFieldValue(\'' + field + '\', v); $(this).parent().remove(); }">Set field value</a><br>'
		+ '<a href="javascript:void(null)" onclick="addBagOfWordsFilter(\'' + field + '\'); $(this).parent().remove();">Add "bag of words"-filter</a><br>'
		+ '<a href="javascript:void(null)" onclick="explainDialog(\'' + field + '\'); $(this).parent().remove();">Explain</a>'
		+ explanationHtml +
		+ '</div>'
	);
	
	activeMenu = menu;

	$('body').append(menu);
}

function addBagOfWordsFilter(fieldName) {
	worker.postMessage(
		{
			'action': 'wordBagFilter', 
			'fieldName': fieldName
		}
	);
}

function showExplanation(fieldName, explanationId) {
	$('#explanationDialog_targetConcept').html(fieldName);
	
	var ruleListHeaderHtml = '<table cellspacing="1">', ruleListHtml = '<table cellspacing="1">';
	
	var ruleList = explanations[fieldName][explanationId].ruleList;
	var accuracyInfo = explanations[fieldName][explanationId].accuracyInfo;
	
	ruleListHeaderHtml += '<table cellspacing="1">'
				+ '<tr style="background-color: lightGray;">'
				+ '<td style="width: 195px;"><b>Rule conditions</b></td>'
				+ '<td style="width: 100px;"><b>Rule consequence</b></td>'
				+ '<td style="width: 100px;"><b>Support</b></td>'
				+ '<td style="width: 100px;"><b>Confidence</b></td></tr></table>';
	
	var conditionHtml, ruleStyle;
	
	var confusionMatrixHtml = '<table>';
	var classes = new Array();
	
	for(var _class in accuracyInfo.confusionMatrix) {
		classes.push(_class);
	}
	
	confusionMatrixHtml += '<tr style="background-color: lightGray;"><td colspan="2">&nbsp;</td><td colspan="' + classes.length + '">Rule conclusion</td></tr>';
	confusionMatrixHtml += '<tr style="background-color: lightGray;"><td colspan="2">&nbsp;</td>';
	for(var i=0; i<classes.length; i++) {
		confusionMatrixHtml += '<td>' + classes[i] + '</td>';
	}
	confusionMatrixHtml += '</tr>';
	
	for(var i=0; i<classes.length; i++) {
		confusionMatrixHtml += '<tr>';
		if(i==0) {
			confusionMatrixHtml += '<td style="background-color: lightGray;" rowspan="' + classes.length + '">Actual</td>';
		}
		confusionMatrixHtml += '<td style="background-color: lightGray;">' + classes[i] + '</td>';
		for(var j=0; j<classes.length; j++) {
			confusionMatrixHtml += '<td style="text-align: right;">' +
				(accuracyInfo.confusionMatrix[classes[i]][classes[j]] != undefined ?
					parseFloat(accuracyInfo.confusionMatrix[classes[i]][classes[j]]*100).toFixed(2) + '%' :
					'0%')
				+ '</td>';
		}
		confusionMatrixHtml += '</tr>';
	}
	
	for(var i=0; i<ruleList.length; i++) {
		
		if(ruleList[i].conditions.length > 0) {
			conditionHtml = ruleList[i].conditions[0];

			for(var j=1; j<ruleList[i].conditions.length; j++) {
				conditionHtml += '<br>' + ruleList[i].conditions[j];
			}
		} else {
			conditionHtml = 'none';
		}
		
		if(i%2 == 1) {
			ruleStyle = ' style="background-color: #EEEEEE;"'
		} else {
			ruleStyle = '';
		}
		
		ruleListHtml += '<tr' + ruleStyle + ' valign="top">'
					+ '<td style="width: 195px;">' + conditionHtml + '</td>'
					+ '<td style="width: 100px;">' + ruleList[i].consequence + '</td>'
					+ '<td style="text-align: right; width: 100px;">' + parseFloat(ruleList[i].support*100).toFixed(2) + '%</td>'
					+ '<td style="text-align: right; width: 100px;">' + parseFloat(ruleList[i].confidence*100).toFixed(2) + '%</td></tr>';
	}
	
	ruleListHtml += '</table>';
	
	$('#explanationDialog_ruleListHeader').html(ruleListHeaderHtml);
	$('#explanationDialog_ruleList').html(ruleListHtml);
	
	$('#explanationDialog_ruleAccuracy').html(parseFloat(accuracyInfo.accuracy*100).toFixed(2) + '%');
	$('#explanationDialog_confusionMatrix').html(confusionMatrixHtml);
	
	$('#explanationDialog').dialog({height: 450, width: 534, modal: true});
}

function explainDialog(fieldName) {
	$('#explainDialog_targetConcept').html(fieldName);
	
	var attributeHtml = '';
	
	for(var i=0; i<datasetheader.length; i++) {
		if(datasetheader[i] != fieldName && datasetheader[i] != '# Records') {
			attributeHtml += '<input type="checkbox" name="explanatoryAttributes" value="' + datasetheader[i] + '">' + datasetheader[i] + '<br>';
		}
	}
	
	$('#explainDialog_explanationName').val('');
	
	$('#explainDialog_attributes').html(attributeHtml);
	
	$('#explainDialog').dialog({height: 290, width: 400, modal: true});
}

function doExplain() {
	var targetFieldName = $('#explainDialog_targetConcept').html();
	
	var attributes = new Array();
	
	$.each($("input[name='explanatoryAttributes']"), function() {
		if($(this).prop('checked')) {
			attributes.push($(this).prop('value'));
		};
	});
	
	if(explanations[targetFieldName] == undefined) {
		explanations[targetFieldName] = new Array();
	}
	
	explanations[targetFieldName].push(
		{
			"name": $('#explainDialog_explanationName').val(),
			"attributes": attributes,
			"decisionTreeRoot": null,
			"ruleList": null,
			"accuracyInfo": null
		}
	);
	
	timer.clearActivity('ID3');
	timer.begin('ID3');
	runningTimer = setInterval(
		function() {
			timer.end('ID3');
			$('#info').html(
				"Generating explanation for concept " + 
				targetFieldName +
				"... Time elapsed: " +
				timer.printActivitySeconds('ID3')
			),
			timer.begin('ID3');
		},
		20
	);
	worker.postMessage({"action": "ID3", "targetFieldName": targetFieldName, "attributes": attributes, "filters": []});
}

function enclose(value) {
	if(value.indexOf(' ') > -1) {
		return '[' + value + ']';
	}
	return value;
}

function displayFilter(fieldName) {
	if(filters[fieldName] != undefined) {
		return;
	}
	worker.postMessage({'action': 'getDictionary', 'fieldName': fieldName});
}

function displayDateInfoFilter(fieldName, dateInfoFieldName) {
	if(filters[fieldName] != undefined) {
		return;
	}
	worker.postMessage({'action': 'getDateInfoDictionary', 'fieldName': fieldName, 'dateInfoFieldName': dateInfoFieldName});
}

function listDataSet(dataHeader, _init) {

	datasetheader = dataHeader.slice(0);
	datasetheadernames = dataHeader.slice(0);
	
	datasetheader.push("# Records");
	datasetheadernames.push("# Records");
	
	pivot.setTabularDataHeaderOnly(datasetheadernames, _init);
	
	var action = '';

	var html = '', dateInfoFields = jsimdb.dateInfoFields, dateInfoFieldsExpander;
	for(var i=0; i<datasetheader.length; i++) {
		
		if(jsimdb.fieldSpec[datasetheader[i]] > jsimdb.FACT) {
			action = '&nbsp;<a href="javascript:void(null)" onclick="displayFilter(\'' + 
				datasetheader[i] + '\');"><img src="filter.png"></a>' +
					'&nbsp;<a href="javascript:void(null)" onclick="menuClickCount++; showDimensionsFieldMenu(event, \'' +
						datasetheader[i] + '\');">&gt;</a>';
		} else if(jsimdb.fieldSpec[datasetheader[i]] == jsimdb.FACT && !(datasetheadernames[i] === "# Records")) {
			action = '&nbsp;<a href="javascript:void(null)" onclick="menuClickCount++; showMeasuresFieldMenu(event, \'' +
				datasetheader[i] + '\');">&gt;</a>';
		} else {
			action = '';
		}
		
		if(jsimdb.fieldSpec[datasetheader[i]] == DATE) {
			dateInfoFieldsExpander =
				'<a href="javascript:void(null)" onclick="$(this).html(($(this).html() == '
				+ '\'(+)\' ? \'(-)\' : \'(+)\')); $(\'#dateInfo' + i + '\').toggle();">(+)</a>&nbsp;';
		} else {
			dateInfoFieldsExpander = '';
		}
		
		html += '<div>' + dateInfoFieldsExpander + '<a href="javascript:void(null)" id="lf'
				+ i + '" onclick="selectField(this.id);">'
				+ datasetheadernames[i] + '</a>' + action + '</div>';
		
		if(jsimdb.fieldSpec[datasetheader[i]] == DATE) {
			html += '<div id="dateInfo' + i + '" style="display: none; background-color: lightGray;">';
			var count = 0,
				derivedFieldInfo;
			for(var dateInfoField in dateInfoFields) {
				
				derivedFieldInfo =
					'{' +
						'\'dateInfoField\': true,' +
						'\'dateInfoFieldName\': \'' + dateInfoField + '\',' +
						'\'dateFieldName\': \'' + datasetheader[i] + '\',' +
						'\'fieldName\': \'' + dateInfoField + ' (' + datasetheader[i] + ')\'' +
					'}';
				
				html +=
					(count++ > 0 ? '<br>' : '') + '&nbsp;&nbsp;<a href="javascript:void(null)" '
					+ 'onclick="selectField(null, ' + derivedFieldInfo + ');">' + dateInfoField + '</a>'
					+ '&nbsp;<a href="javascript:void(null)" onclick="displayDateInfoFilter(\''
					+ datasetheader[i] + '\',\'' + dateInfoField + '\');"><img src="filter.png"></a>';
			}
			html += '</div>';
		}
	}
	$('#fields').html(html);
	$('#loadedDataset').show();
	hideLoading();
	showQuickStartGuide();
}

function preloadImages() {
	var images = [
		'sort.png',
		'sort_desc.png',
		'sort_asc.png',
		'measure.png',
		'dimension.png',
		'calendar.png',
		'filter.png'
	];

	imgList = new Array(images.length);

	for(var i=0; i<images.length; i++) {
		imgList[i] = new Image();
		imgList[i].src = images[i];
	}
}

function showSplashScreen() {
	$('#splash_screen').dialog({height: 320, width: 300, modal: true, title: 'About'});
}

function showQuickStartGuide() {
	$('#getstarted').dialog({height: 250, width: 400, modal: false, title: 'Quick Start Guide', top: 100, left: 400});
}

function checkForFileParameterInUrl() {
	var url = document.location.href;
	var parameterStart = url.indexOf('?');
	
	if(parameterStart > -1) {
		var networkFile = url.substring(parameterStart+1);
		
		handleFileSelect(null, networkFile);
		
		return true;
	}
	
	return false;
}

function pageInit() {
	
	var dropZone = document.getElementById('drop_zone');

	if(dropZone.addEventListener) {
		dropZone.addEventListener('dragover', handleDragOver, false);
		dropZone.addEventListener('dragenter', handleDragOver, false);
		dropZone.addEventListener('drop', handleFileSelect, false);
	} else if(dropZone.attachEvent) {
		dropZone.attachEvent('dragover', handleDragOver);
		dropZone.attachEvent('dragenter', handleDragOver);
		dropZone.attachEvent('drop', handleFileSelect);
	}

	$('#fieldSeparator').val('');

	$('#upload').hide();

	initPivot();

	preloadImages();
	
	if(!checkForFileParameterInUrl()) {
		showSplashScreen();
	}
}

function initPivot() {

	pivot = new Pivot();

	// Instantiate new pivot object and set self-reference
	pivot._self = pivot;

	// Set pivot rendering container, typically an HTML div element
	pivot.setPivotPlaceHolder('output');

	// Define measure header position (above/below row/column headers)
	var el = $('#crosstabConfig');

	pivot.setMeasureHeaderPlacement(pivot.COLUMN_ABOVE);
	pivot.setHeaderTopPixelOffset(el.offset().top + el.height());
}

function doPivot() {
	// Transpose the data, i.e. create the pivot
	pivot.transpose();

	// Render pivot to HTML
	pivot.toHTML();

	$('#output').html('');

	// Set pivot HTML to div element
	$('#output').append(pivot.getHTML());
}

function selectFieldTarget(caller, target) {
	if(selectedFieldTargetHref != null) {
		selectedFieldTargetHref.css('font-weight', 'normal');
	}
	selectedFieldTarget = target;
	selectedFieldTargetHref = $(caller);
	selectedFieldTargetHref.css('font-weight', 'bold');
}

// File reader stuff below

function init() {
	var dropZone = document.getElementById('drop_zone');
	dropZone.addEventListener('dragover', handleDragOver, false);
	dropZone.addEventListener('dragenter', handleDragOver, false);
	dropZone.addEventListener('drop', handleFileSelect, false);
	$('#fieldSeparator').val('');
}

function createFakeFile(name) {
	return {
		'name': name,
		'size': 0,
		'isNetworkFile': true
	};
}

function formatFileName(_fileName) {
	var fileName = _fileName;
	fileName = '<a target="_blank" href="' + fileName + '">' +
				_fileName.substring(0,40) + '...</a>';
	return fileName;
}

function handleFileSelect(evt, networkFile) {
	if(evt != undefined) {
		evt.stopPropagation();
		evt.preventDefault();
		
		var files = evt.dataTransfer.files; // FileList object.
	} else if(evt == undefined && networkFile != undefined) {
		var files = new Array();
	}

	// files is a FileList of File objects. List some properties.
	var output = [];
	
	if(files.length == 0) {
		var f = createFakeFile(networkFile);
		files.push(f);
	}
	
	for (var i = 0, f; f = files[i]; i++) {
		document.getElementById('list').innerHTML = '("' + formatFileName(f.name) + '")';

		$('#queryPanel').hide();
		$('#queryResults').html('');
		$('#fieldSeparator').val('');

		clearPivot();
		$('#fields').html('');
		$('#loadedDataset').hide();

		worker = new Worker("jsIMDB.js");

		worker.onmessage = function(event) {
			if(event.data.reply == 'query_done') {
				timer.end_na('query');
				$('#info').html('Query time: ' + timer.printActivity('query') + '.');

				_queryResults = event.data.query_results;
				_queryResultsCount = event.data.resultSetRowCount;
				
				if(event.data.outputType == 'json') {
					pivot.setTabularDataProjection(event.data.query_results);

					pivot.transpose();
					pivot.toHTML();
					$('#output').html('');
					$('#output').append(pivot.getHTML());
				}

			} else if(event.data.reply == 'sample') {
				_file = event.data.file;
				sampleFile(event.data.fileSample, event.data.lineSeparator, event.data.fieldSeparatorSuggestion);
			} else if(event.data.reply == 'progress') {
				$('#info').html(event.data.activity + ": " + event.data.message + '%');
			} else if(event.data.reply == 'feedback') {
				$('#info').html(event.data.activity);
			}else if(event.data.reply == 'feedback') {
				$('#info').html(event.data.message);
			} else if(event.data.reply == 'done_compressing') {
				jsimdb = event.data.jsimdb;
				timer.end_na('compress_data');
				$('#info').html('Done loading data in ' + timer.printActivity('compress_data') + '.');
				document.getElementById('list').innerHTML = '("' + formatFileName(_file.name) + '", ' + jsimdb.recordCount + ' rows)';
				listDataSet(jsimdb.header, true);
				$('#loadedDataset').show();
				//$('#hrefListAllData').show();
			} else if(event.data.reply == 'error') {
				alert(event.data.message);
			} else if(event.data.reply == 'listAllDataDone') {
				$('#output').html('<pre>' + event.data.output + '</pre>');
			} else if(event.data.reply == 'debug') {
				console.log(event.data.message);
			} else if(event.data.reply == 'dictionaryListing') {
				
				var baseDerivedField = event.data.dateInfoFieldName;
				var derivedField
					= (event.data.isDateInfoField ? ' (' + baseDerivedField + ')' : '');
				
				var fieldName = event.data.fieldName + derivedField;
				var fieldName_ = makeIDValid(fieldName);
				
				if(filters[fieldName] == undefined) {
					var dict;
					var dictEntryMap;
					if(event.data.isDateInfoField) {
						dict = event.data.dictionary.dict;
						dictEntryMap = event.data.dictionary.entryMap;
					} else {
						dict = event.data.dictionary;
					}
					var dictEntry;
					var filterBoxHeight = (dict.length > 6 ? ' height: 150px;' : '');
					var dictVarName = 'dict' + fieldName_;
					var searchEntryListVarName = 'searchEntryList' + fieldName_;
					var dictList = 'var ' + dictVarName + ' = [';
					var searchEntryList = 'var ' + searchEntryListVarName;
					var filter = '<div id="flt' + fieldName_ + '" class="filterBox" style="left: 300px; top: 300px;">';
					filter += '<p style="margin-top: 0px; margin-left: 0px; margin-bottom: 0px; background-color: lightBlue; cursor: move;">' +
						'<a href="javascript:void(null)" onclick="$(\'#flt' +
						fieldName_ + '_listing\').toggle(); ' +
						'$(this).html(($(this).html() == \'[+]\' ? \'[-]\': \'[+]\'));">[-]</a>&nbsp;';
					filter += '<b>' + fieldName + '</b>&nbsp;<a href="javascript:void(null)" onclick="closeFilter(\'' +
						fieldName + '\'); $(\'#flt' + fieldName_ + '\').remove();">X</a><br></p>';
					filter += '&nbsp;<input id="fltsearch' + fieldName_ + '" type="text" size="15">&nbsp;' +
						'<a href="javascript:void(null)" id="chkSearchCheck' + fieldName_ +
						'" onclick="toggleSearchResultCheckBoxes(\'' + fieldName + '\', ' + searchEntryListVarName + ', true)">[x]</a>&nbsp;' +
						'<a href="javascript:void(null)" id="chkSearchUncheck' + fieldName_ +
						'" onclick="toggleSearchResultCheckBoxes(\'' + fieldName_ + '\', ' + searchEntryListVarName + ', false)">[ ]</a><br></span>';
					filter += '<div id="flt' + fieldName_ + '_listing" style="white-space: nowrap; display: block; overflow: scroll;' + filterBoxHeight + '">';
					filter += '<input id="chkALL' + fieldName_ + '" type="checkbox"' +
						' onchange="toggleFilterListAll(\'' + fieldName + '\', this.checked);" checked>' +
						'All<br>';
					for(var i=0; i<dict.length; i++) {
						
						if(event.data.isDateInfoField) {
							dictEntry = dict[i].value;
						} else {
							dictEntry = dict[i];
						}
						
						filter += '<span id="flt' + fieldName_ + i + '">' +
							'<input id="chk' + fieldName_ + i + '" type="checkbox" name="' + fieldName + '" onchange="toggleFilterItem(\'' + fieldName +
							'\', ' + i + ', this.checked, true);" checked visible="true" entryID="' + i + '">' +
							dictEntry + '<br></span>';
						dictList += '\'' + dictEntry.replace(/\'/g, "") + '\'' + (i<dict.length-1 ? ',' : '');
					}
					dictList += '];'
					
					filter += '<script type="text/javascript">';
					filter += 'var previousSearchString' + fieldName_ + ' = \'\';';
					filter += 'var trie' + fieldName_ + ' = new Trie(false, false);';
					filter += dictList;
					filter += searchEntryList + ';';
					filter += 'for(var i=0; i<' + dictVarName + '.length; i++) {';
					filter += '	trie' + fieldName_ + '.addString(' + dictVarName + '[i], i);';
					filter += '}';
					filter += 'function _c' + fieldName_ + '() {';
					filter += '	searchString = $(\'#fltsearch' + fieldName_ + '\').val();';
					filter += '	searchString = (searchString == undefined ? \'\' : searchString);'
					filter += '	if(previousSearchString' + fieldName_ + ' == searchString) return;';
					filter += '	var entryList = trie' + fieldName_ + '.query(searchString, false);';
					filter += '	if(searchString == \'\') {';
					filter += '		for(var i=0; i<' + dictVarName + '.length; i++) {';
					filter += '			$(\'#flt' + fieldName_ + '\' + i).show();';
					filter += '			$(\'#chk' + fieldName_ + '\' + i).attr(\'visible\', true);';
					filter += '		}';
					filter += '		' + searchEntryListVarName + ' = [];';
					filter += '		previousSearchString' + fieldName_ + ' = searchString;';
					filter += '		return;'
					filter += ' }';
					filter += '	if(entryList.length > 0) {';
					filter += '		for(var i=0; i<' + dictVarName + '.length; i++) {';
					filter += '			$(\'#flt' + fieldName_ + '\' + i).hide();';
					filter += '			$(\'#chk' + fieldName_ + '\' + i).attr(\'visible\', false);';
					filter += '		}';
					filter += '		' + searchEntryListVarName + ' = entryList;';
					filter += '		for(var i in entryList) {';
					filter += '			$(\'#flt' + fieldName_ + '\' + entryList[i].entryID).show();';
					filter += '			$(\'#chk' + fieldName_ + '\' + entryList[i].entryID).attr(\'visible\', true);';
					filter += '		}';
					filter += '	} else if(entryList.length == 0) {';
					filter += '		for(var i=0; i<' + dictVarName + '.length; i++) {';
					filter += '			$(\'#flt' + fieldName_ + '\' + i).hide();';
					filter += '			$(\'#chk' + fieldName_ + '\' + i).attr(\'visible\', false);';
					filter += '		}';
					filter += '		' + searchEntryListVarName + ' = entryList;';
					filter += '	}'
					filter += '	previousSearchString' + fieldName_ + ' = searchString;';
					filter += '}';
					
					filter += 'setInterval(_c' + fieldName_ + ', 100);';
					
					filter += '</script>';
					
					filter += '</div></div>';
					$('body').append(filter);
					$('#flt' + fieldName_).draggable({handle: 'p'});
					filters[fieldName] = {
						'type': 'dimension',
						'entries': (event.data.isDateInfoField ? _Array(dictEntryMap.length, false) : _Array(dict.length, false)),
						'allIncluded': true,
						'filterCount': 0
					};
					
					if(event.data.isDateInfoField) {
						filters[fieldName]['dateFieldName'] = event.data.fieldName;
						filters[fieldName]['dateInfoFieldName'] = baseDerivedField;
						filters[fieldName]['isDateInfoFilter'] = true;
						filters[fieldName]['filterIndexLookup'] = dict;
					}
				}
			} else if(event.data.reply == 'binValue') {
				jsimdb.header = event.data.header;
				jsimdb.fieldSpec = event.data.fieldSpec;
				listDataSet(jsimdb.header, false);
				clearPivot();
			} else if(event.data.reply == 'valueStat') {
				var fieldName = event.data.fieldName;
				var fieldName_ = event.data.fieldName.replace(/\s|\(|\)/g,'');
				
				var valueStat = event.data.valueStat;
				var filterBoxHeight = ' height: 60px;';
				var filter = '<div id="flt' + fieldName_ + '" class="filterBox" style="left: 300px; top: 300px;">';
				
				filter += '<p style="margin-top: 0px; margin-left: 0px; margin-bottom: 0px; background-color: lightBlue; cursor: move;">' +
					'<a href="javascript:void(null)" onclick="$(\'#flt' +
					fieldName_ + '_listing\').toggle(); ' +
					'$(this).html(($(this).html() == \'[+]\' ? \'[-]\': \'[+]\'));">[-]</a>&nbsp;';
					
				filter += '<b>' + fieldName + '</b>&nbsp;<a href="javascript:void(null)" onclick="closeFilter(\'' +
					fieldName + '\'); $(\'#flt' + fieldName_ + '\').remove();">X</a><br></p>';
					
				filter += '<div id="flt' + fieldName_ + '_listing" style="white-space: nowrap; display: block; overflow: scroll;' + filterBoxHeight + '">';
				
				filter += '<div id="sld' + fieldName_ + '"></div><br><div id="sldlbl' + fieldName_ + '"></div>';
				
				filter += '</div></div>';
				
				$('body').append(filter);
				$('#flt' + fieldName_).draggable({handle: 'p'});
				
				$('#sldlbl' + fieldName_).html(valueStat.min + " - " + valueStat.max);
				
				filters[fieldName] = {'type': 'measure', 'from': valueStat.min, 'to': valueStat.max};
				
				var stepFactor = 1;
				if(Math.abs(valueStat.min) < 1 && Math.abs(valueStat.max) < 1) {
					stepFactor = 0.01;
				}
				
				$('#sld' + fieldName_).slider({
					range: true,
					min: valueStat.min,
					max: valueStat.max,
					step: stepFactor,
					values: [valueStat.min,  valueStat.max],
					slide: function( event, ui ) {
						$('#sldlbl' + fieldName_).html(ui.values[0] + " - " + ui.values[1]);
					},
					stop: function( event, ui ) {
						filters[fieldName].from = ui.values[0];
						filters[fieldName].to = ui.values[1];
						query(getFields());
					}
				});
			} else if(event.data.reply == 'ID3') {
				decisionTreeRoot = event.data.decisionTreeRoot;
				
				window.clearInterval(runningTimer);
				$('#info').html(
					"Done generating explanation for concept " +
					$('#explainDialog_targetConcept').html() + " in " +
					timer.printActivitySeconds('ID3')
				);
				
				var exp = explanations[event.data.targetFieldName][explanations[event.data.targetFieldName].length-1];
				
				exp.decisionTreeRoot = event.data.decisionTreeRoot;
				
				worker.postMessage(
					{
						"action": "extractRules",
						"decisionTreeRoot": decisionTreeRoot,
						"targetFieldName": event.data.targetFieldName
					}
				);
			} else if(event.data.reply == 'scoreData') {
				
				console.log("Data has been scored.");
				
				jsimdb.header = event.data.header;
				jsimdb.fieldSpec = event.data.fieldSpec;
				listDataSet(jsimdb.header, false);
				clearPivot();
			} else if(event.data.reply == 'extractRules') {
				//console.log(event.data.ruleList);
				ruleList = event.data.ruleList;
				
				var exp = explanations[event.data.targetFieldName][explanations[event.data.targetFieldName].length-1];
				
				exp.ruleList = event.data.ruleList;
				
				worker.postMessage(
					{
						"action": "getDecisionTreeAccuracy",
						"decisionTreeRoot": decisionTreeRoot,
						"targetFieldName": event.data.targetFieldName
					}
				);
			} else if(event.data.reply == 'decisionTreeAccuracy') {
				var exp = explanations[event.data.targetFieldName][explanations[event.data.targetFieldName].length-1];
				exp.accuracyInfo = event.data.accuracyInfo;
			} else if(event.data.reply == 'percentilesByTarget') {
				
				var info = event.data.payload;
				
				var data = [],
					row,
					bestsplit_row,
					key_idx = 0;
				
				for(var key in info.percentiles) {
					
					for(var i=0; i<info.percentiles[key].length; i++) {
						
						row = {};
						
						row[info.targetFieldName] = key;
						row['Percentile'] = info.percentiles[key][i].percentile;
						row[info.valueFieldName] = info.percentiles[key][i].value;
						
						data.push(row);
						
						if(key_idx == 0) {
							bestsplit_row = {};

							bestsplit_row[info.targetFieldName] = 'Best split';
							bestsplit_row['Percentile'] = info.percentiles[key][i].percentile,
							bestsplit_row[info.valueFieldName] = info.bestSplit;

							data.push(bestsplit_row);
						}
					}
					
					key_idx++;
				}
				
				$('#output').html('');
				
				var svg = dimple.newSvg("#output", 420, 300);
				var myChart = new dimple.chart(svg, data);
				myChart.setBounds(50, 30, 370, 220);
				var x = myChart.addCategoryAxis("x", "Percentile");
				x.addOrderRule("Percentile");
				myChart.addMeasureAxis("y", info.valueFieldName);
					
				var lines = myChart.addSeries(info.targetFieldName, dimple.plot.line);
				
				lines.lineMarkers = true;
					
				myChart.addLegend(60, 10, 300, 20, "right");
				myChart.draw();
				
			} else if(event.data.reply == 'addDimension') {
				if(event.data.status == 'OK') {
					jsimdb.header = event.data.header;
					jsimdb.fieldSpec = event.data.fieldSpec;
					listDataSet(jsimdb.header, false);
					clearPivot();
				} else {
					alert(event.data.status);
				}
			} else if(event.data.reply == 'setFieldValue') {
				query(getFields());
				
				if(event.data.isNew) {
					addFilterEntry(event.data.fieldName, event.data.fieldValue);
				}
			}
		};

		_file = f;

		try {
			$('#hrefListAllData').hide();
			worker.postMessage({"action": 'sample', "file": f});
		} catch(err) {
			alert(err);
		}
    }
}

function makeIDValid(id) {
	return id.replace(/\s|\(|\)/g,'');
}

function addFilterEntry(fieldName, entry) {
	if(filters[fieldName] == undefined) {
		return;
	}
	
	eval('trie' + fieldName + '.addString(\'' + entry + '\')');
	eval('dict' + fieldName + '.push(\'' + entry + '\')');
	
	var idx = filters[fieldName].entries.push(!filters[fieldName].allIncluded)-1;
	filters[fieldName]['filterCount']++;
	
	$('#flt' + fieldName + '_listing').append(
		'<span id="flt' + fieldName + idx + '" style="display: inline;">' +
		'<input id="chk' + fieldName + idx + '" type="checkbox" name="' + fieldName + '" ' +
		'onchange="toggleFilterItem(\'' + fieldName + '\', ' + idx + ', this.checked, true);" ' +
		'checked visible="true" entryID="' + idx + '">' + entry + '<br></span>'
	);
}

function addMeasureFilter(fieldName) {
	worker.postMessage({'action': 'getValueStat', 'fieldName': fieldName});
}

function _Array(length, initValue) {
	var a = new Array(length);
	for(var i=0; i<length; i++) {
		a[i] = initValue;
	}
	return a;
}

function toggleSearchResultCheckBoxes(fieldName, searchEntryList, check) {
	if(searchEntryList == undefined) {
		return;
	}
	
	var fieldName_ = makeIDValid(fieldName);
	
	for(var i=0; i<searchEntryList.length; i++) {
		$('#chk' + fieldName_ + searchEntryList[i].entryID).prop('checked', check);
		toggleFilterItem(fieldName, searchEntryList[i].entryID, check, false);
	}
	query(getFields());
}

function toggleFilterListAll(fieldName, allIncluded) {
	filters[fieldName].allIncluded = allIncluded;
	$.each($("input[name='" + fieldName + "']"), function() {
		$(this).prop('checked', allIncluded);
	});
	filters[fieldName]['entries'] = _Array(filters[fieldName]['entries'].length, false);
	filters[fieldName]['filterCount'] = 0;
	query(getFields());
}

function toggleFilterItem(fieldName, _entryIdx, include, _query) {
	var filter = filters[fieldName];
	var entryIdx;
	
	if(filter.isDateInfoFilter) {
		entryIdx = filter.filterIndexLookup[_entryIdx].index;
	} else {
		entryIdx = _entryIdx;
	}
	
	if((include && !filter.allIncluded) ||
		(!include && filter.allIncluded)) {
		filter.entries[entryIdx] = true;
		filter['filterCount']++;
	} else if((include && filter.allIncluded) ||
			(!include && !filter.allIncluded)) {
		filter.entries[entryIdx] = false;
		filter['filterCount']--;
	}
	if(_query) {
		query(getFields());
	}
}

function closeFilter(fieldName) {
	delete filters[fieldName];
	query(getFields());
}

function readFile() {
	var dimensionOrFactSpec = new Array();
	var fieldSep = $('#fieldSeparator').val();
	if(fieldSep == '\\t') {
		fieldSep = '\t';
	}
	for(var i=0; i<_fieldSpec.length; i++) {
		dimensionOrFactSpec.push(_fieldSpec[i].dimensionOrFact);
	}
	$('#fileSamplePanel').hide();
	$('#readFilePanel').hide();
	timer.begin('compress_data');
	worker.postMessage(
		{
			"action": 'compress',
			"file": _file,
			"fieldSeparator": fieldSep,
			"dimensionOrFactSpec": dimensionOrFactSpec
		}
	);
}

function sampleFile(fileSampleData, lineSeparator, fieldSeparatorSuggestion) {
	_lineSeparator = (lineSeparator != undefined ? lineSeparator : _lineSeparator);
	var fieldSep;
	if(fieldSeparatorSuggestion != undefined) {
		if(fieldSeparatorSuggestion == '\t') {
			$('#fieldSeparator').val('\\t');
		} else {
			$('#fieldSeparator').val(fieldSeparatorSuggestion);
		}
		fieldSep = fieldSeparatorSuggestion;
	} else {
		fieldSep = $('#fieldSeparator').val();
		if(fieldSep == '\\t') {
			fieldSep = '\t';
		}
	}
	_fileSampleData = fileSampleData;
	var records = fileSampleData.split(_lineSeparator);
	var html = '';

	if(fieldSep == '') {
		html += '<table>';
		for(var i=0; i<records.length; i++) {
			html += '<tr ' + (i==0 ? 'style="background-color: lightGray; font-weight: bold;"' : '') + '><td>' + records[i] + '</td></tr>';
		}
		html += '</table>';
	} else if(fieldSep != '') {
		var pc = null, c, field = '';
		var fieldSpec = new Array();
		var fieldIdx = 0;
		var inQuote = false;
		
		var skipLastNChars = 0;
		
		if(records[0].charAt(records[0].length-1) == fieldSep) { // Last character of line is field separator
			skipLastNChars = fieldSep.length;
		}
		
		html += '<table>';
		for(var i=0; i<records.length; i++) {
			field = '';
			fieldIdx = 0;
			inQuote = false;
			html += '<tr ' + (i==0 ? 'style="background-color: lightGray; font-weight: bold;"' : '') + '>';
			for(var j=0; j<(records[i].length-skipLastNChars); j++) {
				pc = c;
				c = records[i].charAt(j);
				if(j == (records[i].length-1-skipLastNChars) && !inQuote && c != fieldSep) {
					field += c;
				}
				
				if(j == (records[i].length-1-skipLastNChars) && inQuote && c == '"') {
					c = '';
					inQuote = false;
				}
				
				if(c == '"' && pc != '\\' && !inQuote) {
					inQuote = true;
				} else if(c == '"' && pc != '\\' && inQuote) {
					inQuote = false;
				} else if((c == fieldSep && !inQuote) || j == (records[i].length-1-skipLastNChars)) {
					if(i==0) {
						fieldSpec.push({"field": field, "dimensionOrFact": -1});
						html += '<td><a id="fieldSpec' + fieldIdx + '" href="javascript:void(null)" onclick="toggleFieldType(this.id);">' + field + '</a></td>';
					} else {
						html += '<td>' + field + '</td>';
						if(isDate(field)) {
							if(fieldSpec[fieldIdx].dimensionOrFact == -1) {
								fieldSpec[fieldIdx].dimensionOrFact = DATE;
							}
						} else if(isNumber(field)) {
							if(fieldSpec[fieldIdx].dimensionOrFact == -1) {
								fieldSpec[fieldIdx].dimensionOrFact = FACT;
							}
						} else {
							fieldSpec[fieldIdx].dimensionOrFact = DIM;
						}
					}
					field = '';
					fieldIdx++;
				} else {
					field += c;
				}
			}
			html += '</tr>';
		}
		html += '</table>';
	}

	_fieldSpec = fieldSpec;

	$('#upload').dialog({height: 500, width: 700, modal: true});

	$('#fileSampleContents').html(html);
	$('#fileSamplePanel').show();

	if(fieldSep != '') {
		displayFieldSpec();
		$('#readFilePanel').show();
		$('#fileSampleContents').show();
	}
}

function displayFieldSpec() {
	for(var i=0; i<_fieldSpec.length; i++) {
		if(_fieldSpec[i].dimensionOrFact == FACT) {
			$('#fieldSpec' + i).html($('#fieldSpec' + i).html() + ' <img src="measure.png">');
		} else if(_fieldSpec[i].dimensionOrFact == DIM) {
			$('#fieldSpec' + i).html($('#fieldSpec' + i).html() + ' <img src="dimension.png">');
		} else if(_fieldSpec[i].dimensionOrFact == DATE) {
			$('#fieldSpec' + i).html($('#fieldSpec' + i).html() + ' <img src="calendar.png">');
		}
	}
}

function toggleFieldType(fieldSpecId) {
	var id = parseInt(fieldSpecId.replace('fieldSpec', ''));
	if(_fieldSpec[id].dimensionOrFact == FACT) {
		$('#' + fieldSpecId).html(_fieldSpec[id].field + ' <img src="dimension.png">');
		_fieldSpec[id].dimensionOrFact = DIM;
	} else if(_fieldSpec[id].dimensionOrFact == DIM) {
		$('#' + fieldSpecId).html(_fieldSpec[id].field + ' <img src="calendar.png">');
		_fieldSpec[id].dimensionOrFact = DATE;
	} else if(_fieldSpec[id].dimensionOrFact == DATE) {
		$('#' + fieldSpecId).html(_fieldSpec[id].field + ' <img src="measure.png">');
		_fieldSpec[id].dimensionOrFact = FACT;
	}
}

function isNumber(n) {
	return !isNaN(parseFloat(n)) && isFinite(n);
}

function handleDragOver(evt) {
	evt.stopPropagation();
	evt.preventDefault();
	evt.dataTransfer.dropEffect = 'copy'; // Explicitly show this is a copy.
}

function query(fields, output) {
	if(fields == undefined) {
		return;
	}
	if(fields.length == 0) {
		$('#output').html('');
		return;
	}
	
	var _output = (output == undefined ? 'json' : output);
	
	timer.begin('query');
	worker.postMessage({"action": "query", "outputType": _output, "fields": fields, "filters": filters});
}

function binValue(fieldName, binCount, type) {
	if(binnedValues[fieldName] != undefined) {
		return;
	} else if(binnedValues[fieldName] == undefined) {
		binnedValues[fieldName] = true;
		worker.postMessage({"action": "binValue", "field": fieldName, "binCount": binCount, "binType": type});
	}
}