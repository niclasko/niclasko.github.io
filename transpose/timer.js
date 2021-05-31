function Timer() {
	this.startTime;
	this.endTime;
	
	this.times = new Array();
	this.timesHash = new Array();
	
	this.clearActivity = function(_activity) {
		var th = this.timesHash[_activity];
		if(th != undefined) {
			this.times[th].Time = 0;
		}
	}
	
	this.begin = function(_activity) {
		var th = this.timesHash[_activity];
		if(th == undefined) {
			this.timesHash[_activity] =
				(this.times.push({Activity: _activity, StartTime: new Date().getTime(), Time: 0}) - 1);
		} else {
			this.times[th].StartTime = new Date().getTime();
		}
	};
	
	this.end_na = function(_activity) {
		var th = this.timesHash[_activity];
		this.times[th].EndTime = new Date().getTime();
		this.times[th].Time = (this.times[th].EndTime - this.times[th].StartTime);
	};
	
	this.end = function(_activity) {
		var th = this.timesHash[_activity];
		this.times[th].EndTime = new Date().getTime();
		this.times[th].Time += (this.times[th].EndTime - this.times[th].StartTime);
	};
	
	this.printActivitySeconds = function(_activity) {
		return parseFloat(this.times[this.timesHash[_activity]].Time/1000.0).toFixed(2) + ' s'
	};
	
	this.printActivity = function(_activity) {
		return this.times[this.timesHash[_activity]].Time + ' ms'
	};
	
	this.print = function() {
		var d = '';
		
		for(var i=0; i<this.times.length; i++) {
			d += this.times[i].Activity + ': ' + this.times[i].Time + ' ms<br>';
		}
		
		return d;
	};
}

try {
	module.exports = Timer;
} catch(e) {
	;
}