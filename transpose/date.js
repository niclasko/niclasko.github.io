var dateRE = new RegExp('(0?[0-9]|[10-31])\-(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\-20(0[0-9]|[10-99])');

function isDate(field) {
	if(field == '') return false;
	var m = moment(field);
	if(!m.isValid()) {
		return moment(field, 'DD-MMM-YYYY').isValid();
	}
	return m.isValid();
}