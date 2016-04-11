var margin = {top: 1, right: 1, bottom: 6, left: 1},
  width = 960 - margin.left - margin.right,
  height = 500 - margin.top - margin.bottom,
  nodeWidth = 0.1,
  nodePadding = 15;


d3.json("game-moves.json", function(moves) {
    var nodes = moves.nodes;
    var links = moves.links;

    var numgames = nodes.filter((node) => node.level == 1)
        .reduce((p, c) => p + c.value, 0);
    var numlevels = Math.max.apply(null, nodes.map((node) => node.level));

    var svg = d3.select("body").append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .attr("viewBox", "0 0 " + (numlevels + 1) + " " + numgames)
        .attr("preserveAspectRatio", "none")
        .append("g")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    var totalheight = 0;
    var lastlevel = -1;
    var alt = 0;
    nodes.forEach((move) => {
        move.incoming = [];
        move.outgoing = [];
        move.level -= 1; // level := x position.
        if (move.level % 2 == 0) {
            move.style = {fill: "black"};
        } else {
            move.style = {fill: "white"};
        }
        if (move.level != lastlevel) {
            totalheight = 0;
        }
        if (alt) {
            move.x = move.level + 0.04;
        } else {
            move.x = move.level;
        }
        alt = 1 - alt;
        move.y = totalheight;
        move.incomingheight = totalheight;
        move.outgoingheight = totalheight;
        totalheight += move.value;
        lastlevel = move.level;
    });

    lastlevel = -1;
    alt = 0;
    links.forEach((link) => {
        var source = link.source;
        var target = link.target;
        nodes[source].outgoing.push(link);
        nodes[target].incoming.push(link);
        source = nodes[source];
        target = nodes[target];
        var sx = source.x + nodeWidth;
        var sy0 = source.outgoingheight;
        source.outgoingheight += link.value;
        var sy1 = source.outgoingheight;

        var tx = target.x;
        var ty0 = target.incomingheight;
        target.incomingheight += link.value;
        var ty1 = target.incomingheight;

        link.sx = sx;
        link.sy0 = sy0;
        link.sy1 = sy1;
        link.tx = tx;
        link.ty0 = ty0;
        link.ty1 = ty1;

        lastlevel = source.level;
    });

    svg.append("g").selectAll(".node")
        .data(moves.nodes)
        .enter()
        .append("rect")
        .attr("class", "node")
        .attr("x", (d) => d.x)
        .attr("width", nodeWidth)
        .attr("y", (d) => d.y)
        .attr("height", (d) => d.value);

    svg.append("g").selectAll(".link")
        .data(moves.links)
        .enter()
        .append("path")
        .attr("class", "link")
        .attr("d", (d) => "M" + d.sx + "," + d.sy0 + " L" + d.tx + "," + d.ty0 +
              " L" + d.tx + "," + d.ty1 + " L" + d.sx + "," + d.sy1 + " Z")
        .style({stroke: "none", fill: "#000000", opacity: "0.2"});
});
