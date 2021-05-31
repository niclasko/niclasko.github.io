/*
** Resource scheduler
** Copyright 2020, Niclas Kjäll-Ohlsson (niclasko@gmail.com)
*/
function Scheduler(_container) {
    var self = this;
    var container = _container;
    
    var resources = [];
    var resourceIndexes = {};

    self.intervals = [];

    var start = (new Date()).today();
    var days = 8;
    var timeline = Scheduler.createTimelineHourly(start, days);

    var tags = [];

    var intervalContainerElement;

    var timeCellWidth = 0;
    var cellHeight = 0;
    var minutesPerPixel = 0;

    this.setTimeline = function(_start, _days) {
        start = _start;
        days = _days;
        timeline = Scheduler.createTimelineHourly(start, days);
    };

    this.timeSlotCount = function() {
        return timeline.length;
    };

    this.addResource = function(resourceName) {
        resources.push(new Resource(resources.length, resourceName, self));
        resourceIndexes[resourceName] = resources.length-1;
    };

    var getResource = function(resourceName) {
        return resources[getResourceIndex(resourceName)];
    };

    this.setResourceData = function(resourceName, dataKey, data) {
        var resource = getResource(resourceName);
        if(data.length < resource.timeSlotCount()) {
            return;
        }
        for(var i=0; i<resource.timeSlotCount(); i++) {
            resource.setData(i, dataKey, data[i]);
        }
    };

    var getMinMax = function(dataKey) {
        var min = MAX_INT;
        var max = MIN_INT;
        var value;
        for(var i=0; i<resources.length; i++) {
            for(var j=0; j<resources[i].timeSlotCount(); j++) {
                value = resources[i].getData(j, dataKey);
                if(value < min) {
                    min = value;
                }
                if(value > max) {
                    max = value;
                }
            }
        }
        return {"min": min, "max": max};
    };

    this.heatmap = function(dataKey, unitOfMeasure, scaleContainer) {
        var minMax = getMinMax(dataKey);
        var value;
        var css = "rgba(51, 204, 51, {opacity})";
        for(var i=0; i<resources.length; i++) {
            for(var j=0; j<resources[i].timeSlotCount(); j++) {
                value = resources[i].getData(j, dataKey);
                value = (value-minMax.min)/(minMax.max-minMax.min);
                resources[i].getEntry(j).element().style.backgroundColor = css.replace("{opacity}", (value*0.6));
            }
        }
        heatMapScaleHtml(dataKey, minMax.min, minMax.max, scaleContainer, css, unitOfMeasure);
    };

    var heatMapScaleHtml = function(dataKey, min, max, scaleContainer, css, unitOfMeasure) {
        var cssValue, value;
        var scaleSteps = 31;
        var scaleHtml = "<table><tr><td colspan=\"30\">" + dataKey + "</td></tr><tr>";
        for(var i=0; i<=scaleSteps; i++) {
            cssValue = css.replace("{opacity}", (i/scaleSteps)*0.6);
            value = "&nbsp;";
            if(i==0) {
                value = Math.round(min) + unitOfMeasure;
            } else if(i==scaleSteps) {
                value = Math.round(max) + unitOfMeasure;
            }
            scaleHtml += "<td style=\"background-color: " + cssValue + "\">" + value + "</td>";
        }
        scaleHtml += "</tr></table>";
        document.getElementById(scaleContainer).innerHTML = scaleHtml;
    };

    var getResourceIndex = function(resource) {
        return resourceIndexes[resource];
    };

    var resetContainer = function() {
        containerElement = document.getElementById(container);
        if(!containerElement) {
            return false;
        }
        containerElement.innerHTML = "";
        tags = [containerElement];
        return true;
    };

    var currentTag = function() {
        if(tags.length == 0) {
            return null;
        }
        return tags[tags.length-1];
    };

    var popCurrentTag = function() {
        tags.pop();
    };

    var createTag = function(tagName) {
        var tag = document.createElement(tagName);
        currentTag().appendChild(tag);
        tags.push(tag);
        return tag;
    };

    var table = function() {
        var table = createTag("table");
        table.className = "schedulerTable";
        return table;
    };

    var endTag = function() {
        popCurrentTag();
    };

    var row = function() {
        return createTag("tr");
    };

    var cell = function(childTag, options, ondblclick) {
        var cellElement = document.createElement("td");
        cellElement.appendChild(childTag);
        setTagOptions(cellElement, options);
        if(ondblclick) {
            cellElement.ondblclick = ondblclick;
        }
        currentTag().appendChild(cellElement);
        return cellElement;
    };

    var headerCell = function(childTag, options) {
        var cellElement = document.createElement("th");
        cellElement.appendChild(childTag);
        setTagOptions(cellElement, options);
        currentTag().appendChild(cellElement);
        return cellElement;
    };

    var filler = function(childTag) {
        var fillerElement = document.createElement("div");
        fillerElement.className = "filler";
        fillerElement.appendChild(childTag);
        return fillerElement;
    };

    var setTagOptions = function(tag, options) {
        if(options && options.length) {
            for(var i=0; i<options.length; i++) {
                for(var key in options[i]) {
                    tag.setAttribute(key, options[i][key]);
                }
            }
        }
    };

    var text = function(value) {
        return document.createTextNode(value);
    };

    var dateHeader = function() {
        row();
        headerCell(text(""), [{"class": "frozenColumnTopLeft"}]);
        var value = timeline[0].toDateString();
        var valueCount = 0;
        for(var i=0; i<timeline.length; i++) {
            if(timeline[i].toDateString() === value) {
                valueCount++;
            } else if(timeline[i].toDateString() !== value) {
                headerCell(text(value), [{"colspan": valueCount}, {"class": "schedulerTableCell"}]);
                value = timeline[i].toDateString();
                valueCount = 1;
            }
        }
        headerCell(text(value), [{"colspan": valueCount}, {"class": "schedulerTableCell"}]);
        endTag();
    };

    var timeHeader = function() {
        row();
        headerCell(text("Resource"), [{"class": "frozenColumnTopLeft"}]);
        for(var i=0; i<timeline.length; i++) {
            headerCell(filler(text(timeline[i].getTimeOfDay())), [{"class": "schedulerTableCell"}]);
        }
        endTag();
    };

    var headers = function() {
        dateHeader();
        timeHeader();
    };

    var intervalMoveStart = function(e, interval) {
        e.preventDefault();
        e.stopPropagation();
        interval.startMove(e.clientX);
        window.onpointermove = (event) => onMove(event, interval);
        window.onclick = (event) => intervalMoveEnd(event, interval);
    };

    var onMove = function(e, interval) {
        e.preventDefault();
        interval.move(e.clientX);
    };

    var intervalMoveEnd = function(e, interval) {
        window.onpointermove = null;
        window.onclick = null;
        interval.endMove(e.clientX);
    };

    var intervalResizeStart = function(e, interval) {
        e.preventDefault();
        e.stopPropagation();
        interval.startResize(e.clientX);
        window.onpointermove = (event) => onResize(event, interval);
        window.onclick = (event) => intervalResizeEnd(event, interval);
    };

    var onResize = function(e, interval) {
        e.preventDefault();
        interval.resize(e.clientX);
    };

    var intervalResizeEnd = function(e, interval) {
        window.onpointermove = null;
        window.onclick = null;
        interval.endResize(e.clientX);
    };

    var createInterval = function(resourceMatrixEntry) {
        if(self.intervals.length==0) {
            setTimeCellWidth();
        }
        var schedulerInterval = new SchedulerInterval(resourceMatrixEntry, self);
        self.intervals.push(schedulerInterval);
        return schedulerInterval.getElement();
    };

    var addInterval = function(e, resourceMatrixEntry) {
        //e.target.appendChild(createInterval(resourceMatrixEntry));
        containerElement.appendChild(createInterval(resourceMatrixEntry));
    };

    var createResourceMatrix = function() {
        for(var i=0; i<resources.length; i++) {
            resources[i].setElement(row());
            cell(text(resources[i].resourceName()), [{"class": "frozenColumn"}]);
            for(var j=0; j<resources[i].timeSlotCount(); j++) {
                resources[i].createResourceMatrixEntry(j, timeline[j]);
            }
            endTag();
        }
    };

    var setTimeCellWidth = function() {
        timeCellWidth = resources[0].getEntry(0).screenWidth();
        cellHeight = resources[0].getEntry(0).screenHeight();
        minutesPerPixel = 60/timeCellWidth;
    };
    
    this.render = function() {
        if(!resetContainer()) {
            return;
        }

        table();

        headers();
        createResourceMatrix();

        endTag();
        setTimeCellWidth();
    };

    this.getIntervals = function() {
        return intervals;
    };

    this.getResources = function() {
        return resources;
    };

    this.getTimeCellWidth = function() {
        return timeCellWidth;
    };

    this.getCellHeight = function() {
        return cellHeight;
    };

    this.getMinutesPerPixel = function() {
        return minutesPerPixel;
    };

    var Resource = function(_resourceIndex, _resourceName, _scheduler) {
        var self = this;
        var element;
        var resourceIndex = _resourceIndex;
        var resourceName = _resourceName;
        var scheduler = _scheduler;
        var resourceMatrixEntries = new Array(scheduler.timeSlotCount());
        var resourceIntervals = [];
        var overlapCounts = new Array(scheduler.timeSlotCount()).fill(0);
        var lanes = new Array(scheduler.timeSlotCount()).fill(0);

        this.resourceName = function() {
            return resourceName;
        };
        this.getResourceMatrixEntries = function() {
            return resourceMatrixEntries;
        };
        this.setElement = function(_element) {
            element = _element;
        };
        this.setData = function(timeSlotIndex, dataKey, data) {
            resourceMatrixEntries[timeSlotIndex].setData(dataKey, data);
        };
        this.getData = function(timeSlotIndex, dataKey) {
            return resourceMatrixEntries[timeSlotIndex].getData(dataKey);
        };
        this.getEntry = function(timeSlotIndex) {
            return resourceMatrixEntries[timeSlotIndex];
        };
        this.timeSlotCount = function() {
            return scheduler.timeSlotCount();
        };
        this.createResourceMatrixEntry = function(timeSlotIndex, startTime) {
            resourceMatrixEntries[timeSlotIndex] = new ResourceMatrixEntry(
                resourceIndex, timeSlotIndex, startTime, self, scheduler);
        };
        this.addInterval = function(interval) {
            resourceIntervals.push(interval);
        };
        this.element = function() {
            return element;
        };
        this.updateLanes = function() {
            var indexes;
            for(var i=0; i<lanes.length; i++) {
                lanes[i] = 0;
            }
            for(var i=0; i<resourceIntervals.length; i++) {
                indexes = resourceIntervals[i].getAffectedTimeSlots();
                for(var j=0; j<indexes.length; j++) {
                    if(resourceIntervals[i].getLane() > lanes[indexes[j]]) {
                        lanes[indexes[j]] = resourceIntervals[i].getLane();
                    }
                }
            }
        };
        this.getAvailableLane = function(interval, delta) {
            var lane = 0;
            var indexes = interval.getAffectedTimeSlots();
            for(var i=0; i<indexes.length; i++) {
                overlapCounts[indexes[i]] += delta;
                if(overlapCounts[indexes[i]] > lane) {
                    lane = overlapCounts[indexes[i]];
                }
            }
            for(var i=0; i<indexes.length; i++) {
                if(lane > 1 && lanes[indexes[i]] == lane) {
                    lane += 1;
                }
            }
            return lane;
        };
    };

    var ResourceMatrixEntry = function(_resourceIndex, _intervalIndex, _startTime, _resource, _scheduler) {
        var self = this;
        var resource = _resource;
        var scheduler = _scheduler;
        var resourceIndex = _resourceIndex;
        var intervalIndex = _intervalIndex;
        var startTime = _startTime;
        var element;
        var data = {};
        var initialize = function() {
            element = cell(
                text(""),
                [{"class": "schedulerTableCell"}],
                (event) => addInterval(event, self)
            );
        };
        this.screenWidth = function() {
            return element.offsetWidth;
        };
        this.screenHeight = function() {
            return element.offsetHeight;
        };
        this.offsetPixels = function() {
            return intervalIndex*scheduler.getTimeCellWidth();
        };
        this.startTime = function() {
            return startTime;
        };
        this.resourceIndex = function() {
            return resourceIndex;
        };
        this.resourceName = function() {
            return resource.resourceName();
        };
        this.setData = function(dataKey, value) {
            data[dataKey] = value;
        };
        this.getData = function(dataKey) {
            return data[dataKey];
        };
        this.element = function() {
            return element;
        };
        this.resource = function() {
            return resource;
        };
        initialize();
    };

    var SchedulerInterval = function(_resourceMatrixEntry, _scheduler) {
        var self = this;
        var scheduler = _scheduler;
        var element;
        var resource = _resourceMatrixEntry.resource();
        var resourceMatrixEntry = _resourceMatrixEntry;
        var startX = -1;
        var startLeft = -1;
        var startWidth = -1;
        var previousSteps = 0;

        var offsetLeft;
        var offsetTop;

        var left;
        var width;
        var originalFrom;
        var originalTo;
        var from;
        var to;

        var intervalLane = -1;

        var stepFraction = 1/12;
        var timeStepSize = 60*stepFraction;
        var pixelStepSize = scheduler.getTimeCellWidth()*stepFraction;

        self.label;
        self.affectedTimeSlots = [];
        self.duration;

        var initialize = function() {
            offsetLeft = resourceMatrixEntry.element().offsetLeft-1;
            left = 0;
            offsetTop = resourceMatrixEntry.element().offsetTop;
            width = (scheduler.getTimeCellWidth()*2);
            element = document.createElement("div");
            element.style.width = width+"px";
            element.style.height = "12px";
            element.style.left = (offsetLeft+left) + "px";
            element.style.top = (offsetTop) + "px";
            element.className = "interval";
            element.style.display = "block";
            element.onpointerdown = (event) => intervalMoveStart(event, self);
            element.onpointerup = (event) => intervalMoveEnd(event, self);
            element.ondblclick = function(e) { e.stopImmediatePropagation(); };

            rightEdge = document.createElement("div");
            rightEdge.className = "interval_right_edge";
            rightEdge.onpointerdown = (event) => intervalResizeStart(event, self);
            rightEdge.onpointerup = (event) => intervalResizeEnd(event, self);
            rightEdge.ondblclick = function(e) { e.stopImmediatePropagation(); };
            element.appendChild(rightEdge);

            originalFrom = resourceMatrixEntry.startTime().copy();
            originalTo = resourceMatrixEntry.startTime().copy().addMinutes(width*scheduler.getMinutesPerPixel());
            from = originalFrom.copy();
            to = originalTo.copy();

            resource.addInterval(self);

            setLabel();
            setAffectedTimeSlots();
        };
        var getIntervalLeft = function() {
            return parseFloat(element.style.left.replace("px", "")) - (offsetLeft*1.0);
        };
        var getIntervalWidth = function() {
            return parseFloat(element.style.width.replace("px", ""));
        };
        var setFromTo = function() {
            setFrom();
            setTo();
        };
        var setFrom = function() {
            from.set(originalFrom);
            from.addMinutes((left/pixelStepSize)*timeStepSize);
        };
        var setTo = function() {
            to.set(from);
            to.addMinutes((width/pixelStepSize)*timeStepSize);
        };
        var setLabel = function() {
            self.label = {
                resource: self.resourceName(),
                date: from.toDateString(),
                timeSpan: self.toString(),
                duration: to.diffPrint(from),
                durationInSeconds: to.diffSeconds(from)
            };
        };
        this.getLane = function() {
            return intervalLane;
        };
        var changeLane = function(lane) {
            if(lane > 0) {
                intervalLane = lane;
                element.style.top = (offsetTop+(lane-1)*scheduler.getCellHeight()) + "px";
                resourceMatrixEntry.element().style.height = (lane*scheduler.getCellHeight()) + "px";
                resource.updateLanes();
            }
        };
        var collisionDetect = function(delta) {
            changeLane(resource.getAvailableLane(self, delta));
        };
        var setAffectedTimeSlots = function() {
            collisionDetect(-1);
            self.affectedTimeSlots = [];
            for(var i=Math.floor(from.hoursDiff(start)); i<Math.ceil(to.hoursDiff(start)); i++) {
                if(i < 0 || i > timeline.length) {
                    continue;
                }
                self.affectedTimeSlots.push(i);
            }
            collisionDetect(1);
        };
        var correct = function(delta) {
            var diff = delta % pixelStepSize;
            if(diff == 0) {
                return delta;
            }
            return delta - diff;
        };
        var renderLeft = function() {
            element.style.display = "none";
            element.style.left = (offsetLeft + left) + "px";
            element.style.display = "block";
        };
        var renderWidth = function() {
            element.style.display = "none";
            element.style.width = width + "px";
            element.style.display = "block";
        };
        self.startMove = function(clientX) {
            startX = clientX;
            startLeft = getIntervalLeft();
            previousSteps = 0;
        };
        self.move = function(clientX) {
            var steps = Math.round((clientX-startX)/pixelStepSize);
            var stepDelta = steps-previousSteps;
            if(stepDelta != 0) {
                left = correct(startLeft + (steps*pixelStepSize));
                renderLeft();
                previousSteps = steps;
                setFromTo();
                setLabel();
                setAffectedTimeSlots();
            }
        };
        self.endMove = function(clientX) {
            self.startMove(clientX);
        };
        self.startResize = function(clientX) {
            startX = clientX;
            startWidth = getIntervalWidth();
            previousSteps = 0;
        };
        self.resize = function(clientX) {
            var steps = Math.round((clientX-startX)/pixelStepSize);
            var stepDelta = steps-previousSteps;
            var newWidth;
            if(stepDelta != 0) {
                newWidth = correct(startWidth + (steps*pixelStepSize));
                if(newWidth > 0) {
                    width = newWidth;
                    renderWidth();
                    setTo();
                    setLabel();
                    setAffectedTimeSlots();
                    previousSteps = steps;
                }
            }
        };
        self.endResize = function(clientX) {
            self.startResize(clientX);
        };
        self.getElement = function() {
            return element;
        };
        self.toString = function() {
            return from.getTimeOfDay() + " - " + to.getTimeOfDay();
        };
        self.resourceName = function() {
            return resourceMatrixEntry.resourceName();
        };
        self.resourceIndex = function() {
            return resourceMatrixEntry.resourceIndex();
        };
        self.getAffectedTimeSlots = function() {
            return self.affectedTimeSlots;
        };
        initialize();
    };
};

Scheduler.createTimelineHourly = function(startDate, days) {
    if(days <= 0) {
        return [];
    }
    var timeline = [];
    var h = 0;
    while(h < (days*24)) {
        timeline.push(new Date(startDate.getTime()).addHours(h));
        h++;
    }
    return timeline;
};

Date.prototype.today = function() {
    this.setHours(0,0,0,0);
    return this;
};

Date.prototype.addDays = function(d) {
    this.setDate(this.getDate() + d);
    return this;
};

Date.prototype.addHours = function(h) {
    this.setHours(this.getHours()+h);
    return this;
};

Date.prototype.addMinutes = function(m) {
    this.setTime(this.getTime()+(m*60*1000));
    return this;
};

Date.prototype.set = function(d) {
    this.setTime(d.getTime());
};

Date.prototype.copy = function() {
    return new Date(this.getTime());
};

Date.prototype.getTimeOfDay = function(h) {
    return (""+this.getHours()).padStart(2, "0") + ":" + (""+this.getMinutes()).padStart(2, "0");
};

Date.prototype.hoursDiff = function(d) {
    return (this.getTime()-d.getTime())/1000/60/60;
};

Date.prototype.diffSeconds = function(d) {
    return Math.round((this.getTime()-d.getTime())/1000);
};

Date.prototype.diffPrint = function(d) {
    return durationPrint(this.diffSeconds(d));
};

function durationPrint(seconds) {
    var sign = Math.sign(seconds);
    seconds = Math.abs(seconds);
    var minutes = seconds / 60;
    seconds = Math.floor(seconds % 60);
    var hours = minutes / 60;
    minutes = Math.floor(minutes % 60);
    var days = Math.floor(hours / 24);
    hours = Math.floor(hours % 24);

    return (sign < 0 ? "-" : "") +
        (days > 0 ? days + "d" : "") +
        (hours > 0 ? hours + "h" : "") +
        (minutes > 0 ? minutes + "m" : "") +
        (seconds > 0 ? seconds + "s" : "");
};

Array.prototype.fill = function(val) {
    for(var i=0; i<this.length; i++) {
        this[i] = val;
    }
    return this;
};

function p(n, len, fill) {
    return (""+n).padStart(len, fill);
}

const MAX_INT = 9007199254740991;
const MIN_INT = -9007199254740991;
