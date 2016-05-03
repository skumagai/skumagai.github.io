"use strict";
var GoTree = {};

GoTree.Context = function (size, svg) {
    this.size = size;
    this.svg = svg;
    this.center = size / 2;
}

GoTree.getcontext = function (elem, size) {

    var margin = 1;
    var adjsize = size - 2 * margin;

    // Setting up drwaing area (svg)
    var svg = d3.select("#" + elem)
        .attr({
            "width": size,
            "height": size,
            "preserveAspectRatio": "none"
        });
    svg.append("defs")
        .append("marker")
        .attr({
            "id": "arrowhead",
            "viewBox": "0 0 10 10",
            "markerWidth": 5,
            "markerHeight": 5,
            "refX": 10,
            "refY": 5,
            "orient": "auto",
            "markerUnits": "strokeWidth"
        })
        .append("path")
        .attr({
            "d": "M0,0 L10,5 L0,10 Z"
        });
    svg.append("rect")
        .attr({
            "class": "background",
            "x": 0,
            "y": 0,
            "width": size,
            "height": size
        });
    svg = svg.append("g")
        .attr("transform", "translate(" + margin + "," + margin + ")");

    return new GoTree.Context(adjsize, svg);
}

GoTree.Context.prototype.draw = function (data, boardfrac, cutoff=0.01, maxlevel=15) {
    // Truncate at maxlevel-th move, even if there are more data.
    // cutoff omit displaying moves if their % is lower than this value.
    // boardfrac is a ratio of the board width/height to the width/height of SVG.

    var center = this.center;
    var boardsize = this.size * boardfrac;
    var offset = center - boardsize / 2;
    var gridsize = 19;
    var boardmult = boardsize / gridsize;
    var rstone = 0.4;
    var rmark = 0.2;

    var colors = [
        "#000000", "#1a1a1a", "#333333", "#4d4d4d",
        "#666666", "#808080", "#9a9a9a", "#b3b3b3",
        "#cdcdcd", "#e6e6e6", "#ffffff"];

    var svg = this.svg;

    var Position = function (x, y) {
        this.x = x;
        this.y = y;
        this.visibility = "hidden";
        this.nodes = [];
    }

    var positions = new Map();
    d3.range(1, gridsize+1).forEach(x => {
        d3.range(1, gridsize+1).forEach(y => {
            positions.set("("+x+","+y+")", new Position(x, y))
        });
    });


    d3.json(data, function(tree) {

        var arcgen = d3.svg.arc();

        // Setting up gobard:
        var coord = d3.scale.linear().domain([1, gridsize]).range([0, boardsize]);

        // marked grid points at (3, 3), (3, 6), (3, 9) etc
        var marks = [];
        d3.range(4, gridsize, 6).forEach(x => {
            d3.range(4, gridsize, 6).forEach(y => {
                marks.push({"x": x, "y": y});
            })
        });

        //
        // create the board.
        //
        var board = svg.append("g").attr("class", "board")
            // need to set the following line to properly center the board.
            .attr("transform", "translate(" + offset + "," + offset + ")");

        var piechart = board.append("g")
            .attr({
                "class": "piechart",
                "transform": "translate(" + boardsize / 2+ "," + boardsize / 2 + ")"
            });

        var hgrid = board.append("g").attr("class", "horizontal")
            .selectAll(".horizontal")
            .data(d3.range(1, gridsize+1))
            .enter().append("line")
            .attr({
                "class": "grid",
                "x1": coord(1),
                "x2": coord(gridsize),
                "y1": d => coord(d),
                "y2": d => coord(d),
            });

        var vgrid = board.append("g").attr("class", "vertical")
            .selectAll(".vertical")
            .data(d3.range(1, gridsize+1))
            .enter().append("line")
            .attr({
                "class": "grid",
                "x1": d => coord(d),
                "x2": d => coord(d),
                "y1": coord(1),
                "y2": coord(gridsize),
            });

        var mark = board.append("g").attr("class", "mark")
            .selectAll(".mark")
            .data(marks)
            .enter().append("circle")
            .attr({
                "cx": d => coord(d.x),
                "cy": d => coord(d.y),
                "r": coord(1 + rmark)
            });

        // place the stones.
        var stones = board.append("g").attr("class", "stone")
            .selectAll(".stone")
            .data(Array.from(positions.values()))
            .enter()
            .append("circle")
            .attr({
                "cx": d => coord(d.x),
                "cy": d =>  coord(d.y),
                "r": coord(1 + rstone) // radius of a stone is 0.4 times the interval of a grid.
            })
        .classed("hidden", true); // Stones are initially invisible.

        positions.forEach((v, k, m) => {
            v.elem = stones.filter((d, i) => d === v);
        });

        var total = tree.count;
        cutoff *= total; // Now cutoff value is in the unit of games.

        var unitangle = 2 * Math.PI / total;

        var cangle = 0; // current angle

        var queue1 = [tree];
        var queue2 = [];

        var arcs = [];
        var angle = 0;

        tree.parent = null;

        // compute Manhattan distance
        var distance = function(node1, node2) {
            return Math.abs(node1.x - node2.x) + Math.abs(node1.y - node2.y);
        }

        // depth-first (pass 1): filtering out rare moves and computing angles.
        // also get the maximum total distance of each pass.
        var assignangle = function(node) {
            return _assignangle(node, 0, 0);
        }
        var _assignangle = function(node, level, cumdist) {
            // cumdist is a cumulative distance up to the current move.
            // maxdist is a maximum of cumulative distance up to the final displayed move.
            level += 1;
            if (level > maxlevel) {
                return cumdist;
            }

            node.winb = node.win.B / (node.win.B + node.win.W);

            if (node.parent == null) {
                var lastangle = 0;
            } else {
                lastangle = node.startAngle;
                cumdist += distance(node.parent, node);
            }

            node.label = "(" + node.x + "," + node.y + ")";
            var children = node.children.filter(v => v.count >= cutoff);

            children = children.sort((a, b) => {
                if (a.count < b.count) {
                    return 1;
                } else if (a.count == b.count) {
                    return 0;
                } else {
                    return -1;
                }
            });
            if (children.length == 0) {
                return cumdist;
            }
            var maxdist = 0;
            children.forEach(d => {
                d.parent = node;
                d.startAngle = lastangle;
                lastangle += d.count * unitangle;
                d.endAngle = lastangle;
                var d = _assignangle(d, level, cumdist);
                maxdist = maxdist < d ? d : maxdist;
            });
            return maxdist;
        }

        // depth-first (pass 2): assign length between arcs, and register arcs to
        // a corresponding position on the goboard.
        var assignlength = function(node, unitdist) {
            if (node.parent == null) {
                node.innerRadius = 0;
                node.outerRadius = boardsize / 2 * Math.sqrt(2);
            } else {
                node.innerRadius = node.parent.outerRadius;
                node.outerRadius = node.innerRadius + unitdist * distance(node, node.parent);
                positions.get(node.label).nodes.push(node);
                arcs.push(node);
            }
            node.children.forEach(d => assignlength(d, unitdist));
        }

        // maxdist is updated in the following code.
        var maxdist = assignangle(tree);
        assignlength(tree, (center - Math.sqrt(2) * boardsize / 2 -5) / maxdist);

        var moves = svg.append("g")
            .attr({
                "class": "moves",
                "transform": "translate(" + center + "," + center + ")"
            });

        var colorbars = [];
        var barx = center / 10;
        var barwidth = center / 20;
        var baryoffset = center / 20;
        colors.forEach((col, idx) => {
            colorbars.push({
                'y': (idx + 1) * baryoffset,
                'fill': col
            });
        });
        var colorbar = svg.append('g').attr('class', 'colorbar hidden');
        colorbar.selectAll('.colorblock')
            .data(colorbars)
            .enter()
            .append('rect')
            .attr({
                'x': barx,
                'width': barwidth,

                'y': n => n.y,
                'height': n => baryoffset,

                'class': 'colorblock'
            })
            .style("fill", n => n.fill);
        colorbar.selectAll('.colortext')
            .data(d3.range(9,-10,-2))
            .enter()
            .append('text')
            .attr({
                'x': barx - center / 80,
                'y': (d,i) => {
                    return baryoffset * (i + 2) + baryoffset / 4;
                },
                'font-size': 10,
                'text-anchor': 'end'
            })
            .text(n => n + '%');

        moves.selectAll(".move")
            .data(arcs)
            .enter()
            .append("path")
            .attr({
                "d": arcgen,
                "class": d => "move " + d.player
            })
        .on("mouseover", d => {

            var traj = [d];
            var cur = d;
            while (cur.parent.player != "root") {
                traj.unshift(cur.parent);
                cur = cur.parent;
            }

            traj.forEach(n => {
                positions.get(n.label).elem
                    .classed({
                        "hidden": false,
                        "B": n.player == "B",
                        "W": n.player == "W"
                    })
            });

            var arrows = [];
            for (var i = 0; i < traj.length - 1; i++) {
                var n1 = traj[i];
                var n2 = traj[i+1];
                var rad = Math.atan((n1.y - n2.y) / (n1.x - n2.x));
                var xoffset = Math.cos(rad) * rstone;
                var yoffset = Math.sin(rad) * rstone;
                if (n1.x < n2.x) {
                    xoffset *= -1;
                    yoffset *= -1;
                }

                arrows.push({
                    "x1": n1.x - xoffset,
                    "x2": n2.x + xoffset,

                    "y1": n1.y - yoffset,
                    "y2": n2.y + yoffset
                });
            }

            board.selectAll(".arrow")
                .data(arrows)
                .enter()
                .append("line")
                .attr({
                    "class": "arrow",

                    "x1": n => coord(n.x1),
                    "x2": n => coord(n.x2),

                    "y1": n => coord(n.y1),
                    "y2": n => coord(n.y2),

                    "marker-end": "url(#arrowhead)"
                });

            var delim = 2 * Math.PI * d.winb;
            // (Invisible pie chart under the goban in the middle.
            var bwin = {
                "innerRadius": 0,
                "outerRadius": boardsize / 2 * Math.sqrt(2),
                "startAngle": 0,
                "endAngle": delim,
                "id": "slice-b",
                "class": "B pie"
            };
            var wwin = {
                "innerRadius": 0,
                "outerRadius": boardsize / 2 * Math.sqrt(2),
                "startAngle": delim,
                "endAngle": 2 * Math.PI,
                "id": "slice-w",
                "class": "W pie"
            };
            piechart.selectAll(".pie")
                .data([bwin, wwin])
                .enter()
                .append("path")
                .attr({
                    "d": arcgen,
                    "class": n => n.class,
                    "id": n => n.id
                });

            moves.selectAll('.move')
                .style('fill', n => {
                    var diff = d.winb - n.winb;
                    var idx = Math.ceil((d.winb - n.winb) * 50 + 4.5);
                    idx = idx < 0 ? 0 : idx;
                    idx = idx > 10 ? 10 : idx;
                    return colors[idx];
                });
            svg.select('.colorbar').classed('hidden', false);
        })
        .on("mouseout", d => {
            positions.forEach((v, k, m) => v.elem.classed("hidden", true));
            svg.selectAll(".arrow").remove();
            svg.selectAll(".pie").remove();
            moves.selectAll('.move').style('fill', null);
            svg.select('.colorbar').classed('hidden', true);
        });
    });
}
