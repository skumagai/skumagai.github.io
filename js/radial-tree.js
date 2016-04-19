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
        })
    .append("g")
        .attr("transform", "translate(" + margin + "," + margin + ")");

    return new GoTree.Context(adjsize, svg);
}

GoTree.Context.prototype.draw = function (data, boardfrac, arcwidth=10) {
    // boardfrac is a ratio of the board width/height to the width/height of SVG.

    var center = this.center;
    var boardsize = this.size * boardfrac;
    var offset = center - boardsize / 2;
    var gridsize = 19;
    var boardmult = boardsize / gridsize;

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



    d3.json(data, function(moves) {

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

        // board.append("rect")
        //     .attr({
        //         "class": "background",
        //         "x": coord(0),
        //         "y": coord(0),
        //         "width": coord(gridsize+1),
        //         "height": coord(gridsize+1),
        //     });

        var hgrid = board.append("g").attr("class", "horizontal")
            .selectAll(".horizontal")
            .data(d3.range(1, gridsize+1))
            .enter().append("line")
            .attr({
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
                "r": boardmult / 6,
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
                "r": boardmult / 2.2
            })
        .classed("hidden", true);

        positions.forEach((v, k, m) => {
            v.elem = stones.filter((d, i) => d === v);
        });

        var total = moves.count;
        var unitangle = 2 * Math.PI / total;

        var cangle = 0; // current angle

        var queue1 = [moves];
        var queue2 = [];

        var arcs = [];
        var angle = 0;

        moves.parent = null;

        // first count the number of levels in the dataset and obtaind the maximum length in the tree.
        var count = function (cur, level, length) {
            if (cur.children.length > 0) {
                return [].concat(...cur.children.map(c => count(c, level + 1, length + Math.abs(cur.x - c.x) + Math.abs(cur.y - c.y))));
            } else {
                return [level, length];
            }
        }
        var tmp = count(moves, 0, 0);
        var maxlen = 0;
        var level = 0;
        for (var i = 0; i < tmp.length; i += 2) {
            if (maxlen < tmp[i+1]) {
                maxlen = tmp[i+1];
            }
            if (level < tmp[i]) {
                level = tmp[i];
            }
        }

        var unitdist = (center - (Math.sqrt(2) * boardsize / 2) - arcwidth * level) / maxlen;

        // Going over all moves by breadth-first way.
        while (queue1.length > 0) {
            // This while loop represetns one level of moves (for example all 3-rd moves).
            if (queue2.length == 0) {
                angle = 0;
            }
            for (var node of queue1) {
                node.children.forEach(d => d.parent = node);
                Array.prototype.push.apply(queue2, node.children.sort((a, b) => {
                    if (a.count < b.count) {
                        return 1;
                    } else if (a.count == b.count) {
                        return 0;
                    } else {
                        return -1;
                    }
                }));
                var angleinc = node.count * unitangle;

                node.label = "(" + node.x + "," + node.y + ")";
                node.startAngle = angle;
                node.endAngle = angle + angleinc;

                if (null == node.parent) {
                    node.innerRadius = 0;
                    node.outerRadius = boardsize / 2 * Math.sqrt(2);
                } else {
                    if ("root" == node.parent.player) {
                        node.innerRadius = node.parent.outerRadius;
                        node.outerRadius = node.innerRadius + arcwidth;
                    } else {
                        node.innerRadius = node.parent.outerRadius +
                            unitdist * (Math.abs(node.x - node.parent.x) +
                                        Math.abs(node.y - node.parent.y));
                        node.outerRadius = node.innerRadius + arcwidth;
                    }
                    positions.get(node.label).nodes.push(node);
                    arcs.push(node);
                }
                angle += angleinc;
            }
            [queue1, queue2] = [queue2, queue1];
            queue2.length = 0;
        }

        var arcgen = d3.svg.arc();

        var moves = svg.append("g")
            .attr({
                "class": "moves",
                "transform": "translate(" + center + "," + center + ")"
            });
        moves.selectAll(".move")
            .data(arcs)
            .enter()
            .append("path")
            .attr({
                "d": arcgen,
                "class": d => d.player
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
        })
        .on("mouseout", d => {
            positions.forEach((v, k, m) => v.elem.classed("hidden", true));
        });
    });
}
