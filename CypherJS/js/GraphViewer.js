var GraphViewer = function(options) {
	
	var preprocessGraphData = function(nodes, links) {
		var nodeIds = {};
		var groupId = 1;
		var labelToGroupId = {};
		for(var ix in nodes) {
			nodeIds[nodes[ix].id] = ix;
			nodes[ix].group = 
				(nodes[ix].labels.length > 0 && 
					(labelToGroupId[nodes[ix].labels[0]] || (labelToGroupId[nodes[ix].labels[0]] = groupId++))) || 0;
		}
		for(var ix in links) {
			links[ix].source = nodeIds[links[ix].fromNode.id()];
			links[ix].target = nodeIds[links[ix].toNode.id()];
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
		.force("collision", d3.forceCollide(radius*8))
		.force("link", d3.forceLink());
		
	//add zoom capabilities 
	var zoom_handler = d3.zoom()
		.on("zoom", zoom_actions);

	zoom_handler(svg);
	
	//add encompassing group for the zoom 
	var g = svg.append("g")
		.attr("class", "everything");

	var link = g.append("g")
		.attr("class", "links")
		.selectAll("line")
		.data(this.graphData.links)
		.enter().append("line");
		
	link.append("title")
		.text(function(d) { return JSON.stringify(d); });

	var node = g.append("g")
		.attr("class", "nodes")
		.selectAll("circle")
		.data(this.graphData.nodes)
		.enter().append("circle")
			.attr("r", 10)
			.attr("fill", function(d) { return color(d.group); })
			.on("dblclick", function(d) {
				if(!d.dragged) {
					delete d["fx"];
					delete d["fy"];
					d3.event.stopPropagation();
				}
			})
			.call(d3.drag()
				.on("start", dragstarted)
				.on("drag", dragged)
				.on("end", dragended)
			);

	node.append("title")
		.text(function(d) { return JSON.stringify(d); });

	simulation
		.nodes(this.graphData.nodes)
		.on("tick", ticked);

	simulation.force("link")
		.links(this.graphData.links);

	function ticked() {
		link
			.attr("x1", function(d) { return d.source.x; })
			.attr("y1", function(d) { return d.source.y; })
			.attr("x2", function(d) { return d.target.x; })
			.attr("y2", function(d) { return d.target.y; });

		node
			.attr("cx", function(d) { return d.x; })
			.attr("cy", function(d) { return d.y; });
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