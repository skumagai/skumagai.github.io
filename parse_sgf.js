"use strict";

var fs = require('fs'),
    sgf = require('smartgame'),
    smartgamer = require('smartgamer'),
    path = require('path'),
    stringify = require("csv-stringify"),
    process = require('process');

var gettransfuncs = function (game) {
    var size = 19;
    if ('SZ' in game.getGameInfo()) {
        size = game.getGameInfo().SZ;
    }

    var mid = (size + 1) / 2;

    var xmove, ymove, followup, followup2;

    var transform = function () {
        if (p[0] <= mid) {
            xmove = identity;
        } else {
            xmove = flipx(size);
        }

        if (p[1] <= mid) {
            ymove = identity;
        } else {
            ymove = flipy(size);
        }
    }

    var identity = (xy) => {return xy;};
    var flipx = function(s) { return (xy) => {return [size - xy[0] + 1, xy[1]];}; };
    var flipy = function(s) { return (xy) => {return [xy[0], size - xy[1] + 1];}; };
    var swap = (xy) => {return [xy[1], xy[0]];};

    // p is the position of the first stone by a black player.
    var p = position(game.goTo(1).node());
    if (p[0] == mid && p[1] == mid) {
        p = position(game.next().node());
    }
    transform();

    // apply the transform, so that the current node is in the upper left part of a board.
    p = ymove(xmove(p));

    if (p[0] < p[1]) {
        followup = identity;
    } else if (p[0] > p[1]) {
        followup = swap;
    } else { // (p[0] == p[1]: the 1st stone is on a plane of symmetry.
        while (true) {
            p = ymove(xmove(position(game.next().node())));
            if (p[0] < p[1]) {
                followup = identity;
                break;
            } else if (p[0] > p[1]) {
                followup = swap;
                break;
            }
        }
    }

    return {fx: xmove, fy: ymove, ft: followup}
}

var player = function(node) {
    return Object.keys(node)[0];
}

var position = function(node) {
    var tonum = (c) => { return [ c.charCodeAt(0) - 96, c.charCodeAt(1) - 96]; };
    var p = player(node);
    return tonum(node[p]);
}

var processsgfs = function (files, metaout, moveout) {
    var fields = new Set();
    var meta = new Array();
    var moves = new Array();
    var gameid = 0;
    files.forEach((file) => {
        gameid++;
        var f = fs.readFileSync(file, {encoding: 'utf8'});
        var game = smartgamer(sgf.parse(f));
        var ginfo = game.getGameInfo();

        Object.keys(ginfo).forEach((key) => {
            fields.add(key);
        });
        // AB and AW are stored as-is.
        Object.defineProperty(ginfo, 'gameid', {value: gameid, enumerable: true});
        meta.push(ginfo);

        if (0 != game.totalMoves()) {
            var funcs = gettransfuncs(game);

            var oldnode, node;
            game.goTo(0).node();
            var moveid = 0;
            while ((oldnode = node) != (node = game.next().node())) {
                if (!('B' in node) && !('W' in node)) {
                    break;
                }
                moveid++;
                var p = player(node);
                var c = position(node);
                var nc = funcs.ft(funcs.fy(funcs.fx(c)));
                // console.log(funcs.fy(c));

                moves.push({gameid: gameid,
                    moveid: moveid,
                    player: p,
                    x: c[0],
                    y: c[1],
                    xnorm: nc[0],
                    ynorm: nc[1]});
            }
        }
    });

    var header = {gameid: 'gameid'};
    fields.forEach((field) => {
        Object.defineProperty(header, field, {value: field, enumerable: true});
    });
    stringify(meta, {header: true, columns: header}, (err, output) => {
        fs.writeFile(metaout, output, (err) => {
            if (err) {
                console.error(err.message);
            }
        });
    });

    var fd = fs.openSync(moveout, 'w');
    fs.writeSync(fd, 'gameid,moveid,player,x,y,xnorm,ynorm\n');
    moves.forEach((move) => {
        fs.writeSync(fd, [move.gameid, move.moveid, move.player, move.x, move.y, move.xnorm, move.ynorm+'\n']);
    });
    fs.close(fd);
}

var traverse = function(d) {
    var sgffiles = Array();
    var walk = function(dir) {
        var files = fs.readdirSync(dir, 'utf8');
        files.forEach((file) => {
            var fpath = path.join(dir, file);
            var f = fs.statSync(fpath);
            if (f.isDirectory()) {
                walk(fpath);
            } else if (path.extname(file).toLowerCase() == '.sgf') {
                sgffiles.push(fpath);
            }
        });
    }
    walk(d);
    return sgffiles;
}

var argv = process.argv;
if (argv.length != 5) {
    console.error("usage: parse_sgf.js <datadir> <metaout> <moveout>");
    return(1);
}
var dir = argv[2];
var metaout = argv[3];
var moveout = argv[4];
var sgfs = traverse(dir);
processsgfs(sgfs, metaout, moveout);
