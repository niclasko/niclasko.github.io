// DAG editor: http://bl.ocks.org/rkirsling/5001347
var GraphViewer = function(options) {
	
	var preprocessGraphData = function(nodes, links) {
		var nodeIds = {};
		var groupId = 1;
		var labelToGroupId = {};
		for(var ix=0; ix<nodes.length; ix++) {
			nodeIds[nodes[ix].id] = ix;
			nodes[ix].group = 
				(nodes[ix].labels.length > 0 && 
					(labelToGroupId[nodes[ix].labels[0]] || (labelToGroupId[nodes[ix].labels[0]] = groupId++))) || 0;
		}
		for(var ix=0; ix<links.length; ix++) {
			links[ix].source = nodeIds[links[ix].source];
			links[ix].target = nodeIds[links[ix].target];
		}
		return {nodes: nodes, links: links};
	};
	
	this.graphData = preprocessGraphData(
		options.graphData.nodes,
		options.graphData.links
	);
	this.container = options.container;
	
	this.draw();
};

GraphViewer.prototype.draw = function() {
	var svg = d3.select(this.container).append("svg");
	svg.attr("width",  "100%");
	svg.attr("height", 300);
	
	var dims = svg.node().getBoundingClientRect();
	
	var width = dims.width;
	var height = dims.height;
	var radius = 3;
	
	var color = d3.scaleOrdinal(d3.schemeCategory10);
	
	var altKeyDown = false;
	
	d3.select("body")
		.on("keydown", function() {
			if(d3.event.altKey) {
				altKeyDown = true;
			}
		})
		.on("keyup", function() {
			if(altKeyDown) {
				altKeyDown = false;
			}
		});

	var simulation = d3.forceSimulation()
		.force("center", d3.forceCenter(width/2, height/2))
		.force("charge",d3.forceManyBody())
		.force("collide", d3.forceCollide(70))
		.force("link", d3.forceLink());
		
	//add zoom capabilities 
	var zoom_handler = d3.zoom()
		.on("zoom", zoom_actions);

	zoom_handler(svg);
	
	//add group for the zoom 
	var g = svg.append("g")
		.attr("class", "everything");
	
	var defs = g.append("svg:defs");

	defs.selectAll("marker")
		.data(["arrow"])
		.enter().append("svg:marker")
		.attr("class", "arrowhead")
		.attr("id", String)
		.attr("viewBox", "0 -5 10 10")
		.attr("refX", 22)
		.attr("markerWidth", 4)
		.attr("markerHeight", 4)
		.attr("orient", "auto-start-reverse")
		.append("svg:path")
		.attr("d", "M0,-5L10,0L0,5");

	var link = g.append("g")
		.attr("class", "links")
		.selectAll("g")
		.data(this.graphData.links)
		.enter().append("g");

	var line = link
		.append("line")
		.attr("marker-end",
			function(d) {
				return d.direction == "right" ||
					d.direction == "both" ? "url(#arrow)" : null;
			}
		)
		.attr("marker-start",
			function(d) {
				return d.direction == "left" ||
					d.direction == "both" ? "url(#arrow)" : null;
			}
		);
		
	line.append("title")
		.text(function(d) { return JSON.stringify(d); });

	var linkText = link.append("text")
		.attr("text-anchor", "middle")
		.text(d => d.type);

	var node = g.append("g")
		.attr("class", "nodes")
		.selectAll("g")
		.data(this.graphData.nodes)
		.enter().append("g")
		.call(d3.drag()
			.on("start", dragstarted)
			.on("drag", dragged)
			.on("end", dragended)
		);

	node.append("circle")
		.attr("r", 7)
		.attr("fill", function(d) { return color(d.group); })
		.on("dblclick", function(d) {
			if(!d.dragged) {
				delete d["fx"];
				delete d["fy"];
				d3.event.stopPropagation();
			}
		})
		.append("title")
		.text(function(d) { return JSON.stringify(d); });;

	node.append("text")
		.attr("class", "nodetext")
		.text(function(d) {
			return d.properties["name"];
		})
		.attr("x", 7)
		.attr("y", 3);

	simulation
		.nodes(this.graphData.nodes)
		.on("tick", ticked);

	simulation.force("link")
		.links(this.graphData.links);

	function ticked() {
		line
			.attr("x1", function(d) { return d.source.x; })
			.attr("y1", function(d) { return d.source.y; })
			.attr("x2", function(d) { return d.target.x; })
			.attr("y2", function(d) { return d.target.y; });

		linkText
			.attr("x", function(d) { return d.source.x+((d.target.x-d.source.x)/2)+3.5; })
			.attr("y", function(d) { return d.source.y+((d.target.y-d.source.y)/2)+3.5; })
			.attr("transform", function(d) {
				var deltaX = d.target.x-d.source.x;
				var deltaY = d.target.y-d.source.y;
				var originX = d.source.x+(deltaX/2);
				var originY = d.source.y+(deltaY/2);
				var angle = Math.atan2(deltaY, deltaX)/(Math.PI/180);
				if(Math.abs(angle) > 90) {
					angle -= 180;
				}
				fitText(Math.sqrt(Math.pow(deltaX,2)+Math.pow(deltaY,2))-30, this, d.type);
				return "rotate(" + angle + "," + originX + ", " + originY + ")";
			});

		node
			.attr("transform", function(d) {
			  return "translate(" + d.x + "," + d.y + ")";
			});
	}

	function fitText(linkLength, svgTextElement, text) {
		svgTextElement.textContent = text;
		var i = text.length-3;
		while(svgTextElement.getComputedTextLength() > linkLength && i >= 0) {
			svgTextElement.textContent = text.substring(0,i--) + "...";
		}
	}

	function dragstarted(d) {
		if (!d3.event.active) simulation.alphaTarget(0.3).restart();
		d.fx = d.x;
		d.fy = d.y;
		d.dragged = false;
	}

	function dragged(d) {
		d.fx = d3.event.x;
		d.fy = d3.event.y;
		d.dragged = true;
	}

	function dragended(d) {
		if(d.dragged) {
			d.fx = d3.event.x;
			d.fy = d3.event.y;
		}
		ticked();
	}
	
	function zoom_actions() {
		if(altKeyDown) return;
		g.attr("transform", d3.event.transform)
	}
}