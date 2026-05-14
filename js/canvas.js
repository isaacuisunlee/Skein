/* KNOTTINGHAM author: fi-le (info@fi-le.net) licence: MIT © 2023
 * Experimental torus mode is intentionally opt-in and keeps planar drawing as the default.
 * To stay compatible with PaperScript, this file avoids module syntax and import wrappers.
 */

function getTorusRect() {
    var W = Number(window.globals.torusWidth || 500);
    var H = Number(window.globals.torusHeight || 350);
    return new Rectangle(view.center.x - W / 2, view.center.y - H / 2, W, H);
}

function torusLatticeVector(a, b) {
    var rect = getTorusRect();
    return new Point(a * rect.width, b * rect.height);
}

function modNumber(x, base, period) {
    var y = (x - base) % period;
    if (y < 0) y += period;
    return base + y;
}

function modPointToTorus(p) {
    var rect = getTorusRect();
    return new Point(
        modNumber(p.x, rect.x, rect.width),
        modNumber(p.y, rect.y, rect.height)
    );
}

function torusDistance(p, q) {
    var rect = getTorusRect();
    var dx = Math.abs(p.x - q.x);
    var dy = Math.abs(p.y - q.y);
    dx = Math.min(dx, rect.width - dx);
    dy = Math.min(dy, rect.height - dy);
    return Math.sqrt(dx * dx + dy * dy);
}

function torusCrossingKey(p, t1, t2, a, b) {
    var rect = getTorusRect();
    var qx = Math.round((p.x - rect.x) * 10);
    var qy = Math.round((p.y - rect.y) * 10);
    var A = Math.round(t1 * 100);
    var B = Math.round(t2 * 100);
    var s1 = a;
    var s2 = b;
    if (B < A) {
        var tmp = A;
        A = B;
        B = tmp;
        s1 = -a;
        s2 = -b;
    }
    return qx + ':' + qy + ':' + A + ':' + B + ':' + s1 + ':' + s2;
}

function getTime(seg) {
    return seg.time + seg.index;
}

function metric(a, b) {
    return Math.min(
        Math.abs(a - b),
        Math.abs(a - b + activeKnot.segments.length),
        Math.abs(a - b - activeKnot.segments.length)
    );
}

var hitOptions = {segments: true, stroke: true, handles: false, fill: true, tolerance: 5};
var intersectionWatcher = [[], [], [], []];
var torusIntersectionMeta = [];
var previousGaussCode = [];
var previousPolynomial = null;
var REIDEMEISTER_DISTANCE_THRESHOLD = 25;
var drawing = false;
var undoStack = [];
var lastMousePosition = new Point(0, 0);
var segment, path, handle, handleIn;
var discreteMove = false;
var drawn;
var selectedEnd = false;
var activeKnot;
var torusGridLayer = new Layer();
var torusCoverLayer = new Layer();
var knotLayer = new Layer();
var intersectionLayer = new Layer();

function resetIntersections() {
    intersectionWatcher = [[], [], [], []];
    torusIntersectionMeta = [];
}

function prepareLayers() {
    if (!torusGridLayer || torusGridLayer.removed) torusGridLayer = new Layer();
    if (!torusCoverLayer || torusCoverLayer.removed) torusCoverLayer = new Layer();
    if (!knotLayer || knotLayer.removed) knotLayer = new Layer();
    if (!intersectionLayer || intersectionLayer.removed) intersectionLayer = new Layer();
    torusGridLayer.locked = true;
    torusCoverLayer.locked = true;
    torusGridLayer.sendToBack();
    torusCoverLayer.insertAbove(torusGridLayer);
    knotLayer.insertAbove(torusCoverLayer);
    intersectionLayer.insertAbove(knotLayer);
}

function clearTorusLayers() {
    if (torusGridLayer) torusGridLayer.removeChildren();
    if (torusCoverLayer) torusCoverLayer.removeChildren();
}

function drawTorusGrid() {
    prepareLayers();
    torusGridLayer.removeChildren();
    if (!window.globals.torusMode) return;
    var rect = getTorusRect();
    var r = Number(window.globals.coverRadius || 1);
    for (var a = -r; a <= r; a++) {
        for (var b = -r; b <= r; b++) {
            var offset = torusLatticeVector(a, b);
            var tile = new Path.Rectangle({
                rectangle: new Rectangle(rect.x + offset.x, rect.y + offset.y, rect.width, rect.height),
                strokeColor: (a == 0 && b == 0) ? 'black' : 'gray',
                strokeWidth: (a == 0 && b == 0) ? 1.5 : 0.5,
                dashArray: (a == 0 && b == 0) ? null : [4, 4],
                locked: true,
                data: {kind: 'torus-grid'}
            });
            torusGridLayer.addChild(tile);
        }
    }
}

function refreshTorusCover() {
    prepareLayers();
    torusCoverLayer.removeChildren();
    if (!window.globals.torusMode) return;
    if (!window.globals.showUniversalCover) return;
    if (!activeKnot) return;
    var r = Number(window.globals.coverRadius || 1);
    for (var a = -r; a <= r; a++) {
        for (var b = -r; b <= r; b++) {
            if (a == 0 && b == 0) continue;
            var ghost = activeKnot.clone();
            ghost.translate(torusLatticeVector(a, b));
            ghost.selected = false;
            ghost.fullySelected = false;
            ghost.opacity = 0.25;
            ghost.locked = true;
            ghost.data = {kind: 'torus-copy', shiftA: a, shiftB: b};
            torusCoverLayer.addChild(ghost);
        }
    }
}

function refreshTorusView() {
    drawTorusGrid();
    refreshTorusCover();
}

globals.refreshTorusView = refreshTorusView;

function getTorusCrossings() {
    var out = [];
    var seen = {};
    var r = Number(window.globals.coverRadius || 1);
    if (r < 1) r = 1;

    var ordinary = activeKnot.getCrossings(activeKnot);
    for (var i = 0; i < ordinary.length; i++) {
        var x = ordinary[i];
        var mp = modPointToTorus(x.point);
        var key = torusCrossingKey(mp, getTime(x), getTime(x.intersection), 0, 0);
        if (!seen[key]) {
            seen[key] = true;
            x.torusShiftA = 0;
            x.torusShiftB = 0;
            x.torusPoint = mp;
            x.shiftedPathForTorus = null;
            out.push(x);
        }
    }

    for (var a = -r; a <= r; a++) {
        for (var b = -r; b <= r; b++) {
            if (a == 0 && b == 0) continue;
            var shifted = activeKnot.clone();
            shifted.translate(torusLatticeVector(a, b));
            shifted.visible = false;
            shifted.locked = true;
            shifted.data = {kind: 'torus-temp-copy', shiftA: a, shiftB: b};
            var xs = activeKnot.getCrossings(shifted);
            for (var j = 0; j < xs.length; j++) {
                var y = xs[j];
                var t1 = getTime(y);
                var t2 = getTime(y.intersection);
                var mp2 = modPointToTorus(y.point);
                var key2 = torusCrossingKey(mp2, t1, t2, a, b);
                if (!seen[key2]) {
                    seen[key2] = true;
                    y.torusShiftA = a;
                    y.torusShiftB = b;
                    y.torusPoint = mp2;
                    y.shiftedPathForTorus = shifted;
                    out.push(y);
                }
            }
            if (xs.length == 0) shifted.remove();
        }
    }

    out.sort(function(u, v) {
        return (u.torusPoint.x - v.torusPoint.x) || (u.torusPoint.y - v.torusPoint.y);
    });
    var filtered = [];
    for (var m = 0; m < out.length; m++) {
        var dup = false;
        for (var n = 0; n < filtered.length; n++) {
            if (torusDistance(out[m].torusPoint, filtered[n].torusPoint) < 1 &&
                Math.abs(getTime(out[m]) - getTime(filtered[n])) < 0.02) {
                dup = true;
            }
        }
        if (!dup) filtered.push(out[m]);
    }
    return filtered;
}

function removeTempTorusPaths(intersections) {
    var removed = {};
    for (var i = 0; i < intersections.length; i++) {
        var temp = intersections[i].shiftedPathForTorus;
        if (temp && !removed[temp.id]) {
            removed[temp.id] = true;
            temp.remove();
        }
    }
}

function matchCrossingBooleans(intersections, kwargs) {
    if (kwargs && kwargs.skipMatching) return intersectionWatcher[1] || [];
    var bools = Array(intersections.length).fill(false);
    for (var i = 0; i < intersections.length; i++) {
        var currentPoint = window.globals.torusMode ?
            (intersections[i].torusPoint || modPointToTorus(intersections[i].point)) :
            intersections[i].point;
        var min = 99999999999999;
        var min_index = -1;
        for (var k = 0; k < intersectionWatcher[0].length; k++) {
            var distance = window.globals.torusMode ?
                torusDistance(currentPoint, intersectionWatcher[0][k]) :
                currentPoint.getDistance(intersectionWatcher[0][k]);
            if (distance < min) {
                min = distance;
                min_index = k;
            }
        }
        if (min_index >= 0 && min < 30) {
            bools[i] = intersectionWatcher[1][min_index];
        } else {
            bools[i] = metric(getTime(intersections[i]), 0) > metric(getTime(intersections[i].intersection), 0);
        }
    }
    return bools;
}

function showIntersections(kwargs) {
    if (!kwargs) kwargs = {};
    prepareLayers();
    intersectionLayer.removeChildren();
    var intersections = window.globals.torusMode ? getTorusCrossings() : activeKnot.getCrossings(activeKnot);
    var bools = matchCrossingBooleans(intersections, kwargs);

    resetIntersections();
    intersectionWatcher[1] = bools;
    for (var i = 0; i < intersections.length; i++) {
        var intersect = intersections[i];
        intersectionWatcher[0][i] = window.globals.torusMode ?
            (intersect.torusPoint || modPointToTorus(intersect.point)) :
            intersect.point;
        intersectionWatcher[1][i] = (typeof intersectionWatcher[1][i] == 'undefined') ? false : intersectionWatcher[1][i];
        intersectionWatcher[2][i] = getTime(intersect);
        intersectionWatcher[3][i] = getTime(intersect.intersection);
        torusIntersectionMeta[i] = {a: intersect.torusShiftA || 0, b: intersect.torusShiftB || 0};
    }

    for (var j = 0; j < intersections.length; j++) {
        var x = intersections[j];
        if (window.globals.torusMode && (x.torusShiftA || x.torusShiftB)) {
            var marker = new Path.Circle({
                center: x.torusPoint,
                radius: Math.max(5, window.globals.strokeWidth),
                strokeColor: intersectionWatcher[1][j] ? 'red' : 'blue',
                fillColor: new Color(1, 1, 1, 0.01),
                strokeWidth: 2,
                data: {kind: 'intersection', i1: j, path: activeKnot},
                locked: !window.globals.showIntersections
            });
            intersectionLayer.addChild(marker);
            continue;
        }

        var pathAtCrossing = x.path;
        var curve1 = x.curve;
        var t1 = x.time;
        var tangent1 = x.tangent;
        var tangent2 = x.intersection.tangent;
        if (intersectionWatcher[1][j]) {
            t1 = x.intersection.time;
            tangent1 = x.intersection.tangent;
            tangent2 = x.tangent;
            curve1 = x.intersection.curve;
        }
        var alpha = 1.3 * Math.abs(tangent1.dot(tangent2));
        var denominator = Math.max(0.1, Math.cos(alpha));
        var radius = (globals.gapWidth * Math.tan(alpha) + 2 * globals.strokeWidth / denominator) / Math.max(1, curve1.length);
        if (t1 - radius >= 0 && t1 + radius <= 1) {
            var partA = curve1.getPart(t1 - radius, t1 + radius);
            var partB = curve1.getPart(t1 - radius * 1.01, t1 + radius * 1.01);
            var gap = new Path({
                segments: [partA.segment1.clone(), partA.segment2.clone()],
                strokeColor: 'white',
                strokeWidth: window.globals.gapWidth * window.globals.strokeWidth,
                data: {kind: 'intersection', i1: j, path: pathAtCrossing},
                locked: globals.isomorphy || !window.globals.showIntersections
            });
            intersectionLayer.addChild(gap);
            var cap = new Path({
                segments: [partB.segment1.clone(), partB.segment2.clone()],
                strokeColor: window.globals.showIntersections ?
                    (intersectionWatcher[1][j] ? 'red' : 'blue') :
                    window.globals.strokeColor,
                strokeWidth: window.globals.strokeWidth,
                locked: true
            });
            intersectionLayer.addChild(cap);
        }
        if (window.globals.torusMode) {
            var central = new Path.Circle({
                center: intersectionWatcher[0][j],
                radius: 3,
                fillColor: intersectionWatcher[1][j] ? 'red' : 'blue',
                data: {kind: 'intersection', i1: j, path: activeKnot},
                locked: !window.globals.showIntersections
            });
            intersectionLayer.addChild(central);
        }
    }
    removeTempTorusPaths(intersections);
    refreshTorusView();
}

function getActiveTorusWindingString() {
    if (!activeKnot || !activeKnot.data) return "";
    if (activeKnot.data.torusWinding) {
        return "(" + activeKnot.data.torusWinding[0] + "," + activeKnot.data.torusWinding[1] + ")";
    }
    return "(unknown)";
}

function typesetInvariants() {
    if (window.globals.torusMode) {
        gauss.innerHTML = "Torus mode: planar Gauss code disabled";
        dt.innerHTML = "Torus mode: planar DT code disabled";
        polynomial.innerHTML = "Torus mode: planar Alexander polynomial disabled";
        if (typeof jonesPolynomial !== 'undefined') jonesPolynomial.innerHTML = "";
        if (typeof homflyPolynomial !== 'undefined') homflyPolynomial.innerHTML = "";
        var w = getActiveTorusWindingString();
        if (w) polynomial.innerHTML += "<br>Active component winding: " + w;
        polynomial.innerHTML += "<br>Periodic crossings: " + intersectionWatcher[0].length;
        return;
    }

    var gC = gaussCode(intersectionWatcher);
    gauss.innerHTML = gC.toString();
    dt.innerHTML = dowkerThistlethwaiteCode(intersectionWatcher).toString();
    var p = alexanderPolynomial(intersectionWatcher, activeKnot);
    polynomial.innerHTML = alexanderString(p);
    candidates.innerHTML = "";
    candidates_p.style.visibility = "hidden";
    previousPolynomial = p;
    previousGaussCode = gC;
    if (window.MathJax) MathJax.typeset();
}

function setLog(s) {
    if (typeof log != 'undefined') log.innerHTML = s;
}

function pushUndo() {
    if (undoStack.length > 40) undoStack.shift();
    undoStack.push(globals.toJSON());
}

function popUndo() {
    if (undoStack.length > 0) {
        globals.fromJSON(undoStack.pop());
        typesetInvariants();
    }
}

globals.updateStyle = function() {
    activeKnot.strokeWidth = globals.strokeWidth;
    activeKnot.strokeColor = globals.strokeColor;
    showIntersections({});
    refreshTorusView();
};
globals.undo = function() { popUndo(); };
globals.straighten = function() {
    activeKnot.clearHandles();
    showIntersections({});
    globals.smooth = false;
    discreteMove = true;
};
globals.flatten = function() {
    activeKnot.flatten(1);
    showIntersections({spatial: true});
    globals.smooth = false;
};
globals.simplify = function() {
    activeKnot.simplify(0.3);
    showIntersections({});
    globals.smooth = false;
};
globals.reflect = function() {
    activeKnot.scale(-1, 1);
    showIntersections({});
    pushUndo();
};
globals.makeAlternating = function() {
    for (var i = 0; i < intersectionWatcher[1].length; i++) intersectionWatcher[1][i] = i % 2 == 0;
    window.globals.switchIsomorphy();
    pushUndo();
};
globals.toSVG = function() {
    return project.exportSVG({bounds: 'content'});
};
globals.toJSON = function() {
    var obj = activeKnot.exportJSON({asString: false});
    var torusData = {
        torusMode: window.globals.torusMode,
        showUniversalCover: window.globals.showUniversalCover,
        coverRadius: window.globals.coverRadius,
        torusWidth: window.globals.torusWidth,
        torusHeight: window.globals.torusHeight,
        activeKnotData: activeKnot.data || {}
    };
    return JSON.stringify([obj, intersectionWatcher, torusData]);
};
globals.fromJSON = function(jsonString) {
    var obj = JSON.parse(jsonString);
    prepareLayers();
    knotLayer.activate();
    if (!activeKnot || activeKnot.removed) activeKnot = new Path();
    activeKnot.importJSON(JSON.stringify(obj[0]));
    activeKnot.data = activeKnot.data || {kind: 'knot'};
    var intersections = obj[1] || [[], [], [], []];
    intersectionWatcher = intersections;
    for (var k = 0; k < intersections[1].length; k++) {
        intersectionWatcher[1][k] = intersections[1][k];
        if (intersections[0][k] && intersections[0][k][0] == 'Point') {
            intersectionWatcher[0][k] = new Point(intersections[0][k][1], intersections[0][k][2]);
        } else if (intersections[0][k] && intersections[0][k].x !== undefined) {
            intersectionWatcher[0][k] = new Point(intersections[0][k].x, intersections[0][k].y);
        }
    }
    if (obj[2]) {
        window.globals.torusMode = !!obj[2].torusMode;
        window.globals.showUniversalCover = obj[2].showUniversalCover !== false;
        window.globals.coverRadius = obj[2].coverRadius || 1;
        window.globals.torusWidth = obj[2].torusWidth || 500;
        window.globals.torusHeight = obj[2].torusHeight || 350;
        activeKnot.data = obj[2].activeKnotData || activeKnot.data;
    } else {
        window.globals.torusMode = false;
        activeKnot.closed = true;
    }
    if (window.globals.syncTorusControls) window.globals.syncTorusControls();
    refreshTorusView();
    showIntersections({skipMatching: true});
    typesetInvariants();
};
globals.select = function() {
    var bool = activeKnot.fullySelected;
    activeKnot.fullySelected = false;
    activeKnot.fullySelected = !bool;
    hitOptions.handles = true;
};
globals.draw = function() {
    drawing = true;
    project.clear();
    torusGridLayer = new Layer();
    torusCoverLayer = new Layer();
    knotLayer = new Layer();
    intersectionLayer = new Layer();
    prepareLayers();
    globals.smooth = false;
    refreshTorusView();
};
globals.toTikz = function(scale) {
    if (window.globals.torusMode) {
        return "% TikZ export for torus diagrams is experimental; exported path is the active lift only.\n";
    }
    return "% TikZ export placeholder for active planar diagram.\n";
};
globals.switchIsomorphy = function() {
    if (window.globals.torusMode) window.globals.isomorphy = false;
    showIntersections({});
    typesetInvariants();
};
globals.getNumIntersections = function() {
    return intersectionWatcher[0].length;
};
globals.fromSnappy = function(geometry) {
    setLog("Snappy import is not available in this lightweight workspace build.");
};

globals.makePQCurve = function(p, q) {
    p = parseInt(p);
    q = parseInt(q);
    if (isNaN(p)) p = 1;
    if (isNaN(q)) q = 0;
    window.globals.torusMode = true;
    window.globals.isomorphy = false;
    resetIntersections();
    project.clear();
    torusGridLayer = new Layer();
    torusCoverLayer = new Layer();
    knotLayer = new Layer();
    intersectionLayer = new Layer();
    prepareLayers();
    knotLayer.activate();

    var rect = getTorusRect();
    var start = new Point(rect.x + rect.width * 0.25, rect.y + rect.height * 0.5);
    var end = start + new Point(p * rect.width, q * rect.height);
    var mid = (start + end) / 2;
    var normal = new Point(-q, p);
    if (normal.length > 0) normal.length = 40;

    activeKnot = new Path({
        segments: [
            new Segment(start),
            new Segment(mid + normal),
            new Segment(end)
        ],
        strokeColor: window.globals.strokeColor || 'black',
        strokeWidth: window.globals.strokeWidth,
        closed: false,
        fullySelected: true,
        data: {
            kind: 'knot',
            torusWinding: [p, q],
            torusClosed: true
        }
    });
    activeKnot.smooth({type: 'catmull-rom', factor: 0.5});
    if (window.globals.syncTorusControls) window.globals.syncTorusControls();
    drawTorusGrid();
    refreshTorusCover();
    showIntersections({});
    pushUndo();
    typesetInvariants();

    // TODO: Multiple components are needed for torus skein products.  For primitive
    // classes (p,q) and (r,s), the expected minimal intersection number is |p*s-q*r|.
};

function onMouseDown(event) {
    if (drawing) {
        project.clear();
        torusGridLayer = new Layer();
        torusCoverLayer = new Layer();
        knotLayer = new Layer();
        intersectionLayer = new Layer();
        prepareLayers();
        knotLayer.activate();
        drawn = new Path({
            segments: [event.point],
            strokeColor: 'black',
            strokeWidth: window.globals.strokeWidth,
            fullySelected: true,
            data: {kind: 'knot'}
        });
        refreshTorusView();
        return;
    }
    pushUndo();
    lastMousePosition = event.point;
    segment = handleIn = handle = null;
    var hitResult = project.hitTest(event.point, hitOptions);
    if (!hitResult) {
        activeKnot.selected = !activeKnot.selected;
        hitOptions.handles = false;
        return;
    }
    if (event.modifiers && event.modifiers.shift && !(hitResult.item.data && hitResult.item.data.kind == 'intersection')) {
        if (hitResult.type == 'segment') {
            discreteMove = true;
            hitResult.segment.remove();
            showIntersections({});
        }
        return;
    }
    if (event.modifiers && event.modifiers.control && hitResult.type == 'segment') {
        discreteMove = true;
        var seg = hitResult.segment;
        seg.handleIn = (seg.previous.point - seg.next.point) / 4;
        seg.handleOut = -seg.handleIn;
    }
    if (hitResult.item.data && hitResult.item.data.kind == 'intersection') {
        activeKnot = hitResult.item.data.path;
        var i = hitResult.item.data.i1;
        intersectionWatcher[1][i] = !intersectionWatcher[1][i];
    } else if (hitResult.type == 'segment') {
        activeKnot = hitResult.item;
        segment = hitResult.segment;
        activeKnot.selected = true;
        selectedEnd = segment.index == 0;
    } else if (hitResult.type == 'stroke') {
        activeKnot = hitResult.item;
        var index = hitResult.location._segment1.index;
        activeKnot.selected = true;
        segment = activeKnot.insert(index + 1, event.point);
    } else if (hitResult.type == 'handle-in') {
        segment = hitResult.segment;
        handle = true;
        handleIn = true;
    } else if (hitResult.type == 'handle-out') {
        segment = hitResult.segment;
        handle = true;
        handleIn = false;
    }
    showIntersections({});
    typesetInvariants();
}

function onMouseUp(event) {
    if (drawing) {
        if (globals.smooth) drawn.simplify();
        drawn.simplify(15);
        drawn.fullySelected = true;
        if (window.globals.torusMode) {
            drawn.closed = false;
            drawn.data = drawn.data || {};
            drawn.data.kind = 'knot';
            drawn.data.torusClosed = false;
            drawn.data.torusWinding = null;
        } else {
            drawn.closed = true;
        }
        drawing = false;
        activeKnot = drawn;
        showIntersections({});
        refreshTorusView();
        pushUndo();
        lastMousePosition = event.point;
    } else {
        if (globals.smooth) activeKnot.smooth({type: 'catmull-rom', factor: 0.5});
        refreshTorusView();
    }
    typesetInvariants();
}

function onMouseDrag(event) {
    if (drawing) {
        drawn.add(event.point);
        refreshTorusView();
        return;
    }
    if (event.point.getDistance(lastMousePosition) > 25) {
        pushUndo();
        lastMousePosition = event.point;
    }
    var delta = null;
    if (handle && handleIn) delta = event.point - segment.point - segment.handleIn;
    else if (handle && !handleIn) delta = event.point - segment.point - segment.handleOut;
    else if (segment) delta = event.point - segment.point;
    if (!delta) return;
    if (globals.isomorphy) delta = delta / Math.max(1, delta.length / 5);
    if (handle) {
        if (handleIn) {
            segment.handleIn += delta;
            if (!globals.independentHandles) segment.handleOut -= delta;
        } else {
            segment.handleOut += delta;
            if (!globals.independentHandles) segment.handleIn -= delta;
        }
    } else if (segment) {
        segment.point += delta;
        var next = segment;
        var previous = segment;
        for (var i = 0; i < window.globals.neighbors; i++) {
            next = next.next;
            previous = previous.previous;
            delta *= 0.5;
            next.point += delta;
            previous.point += delta;
        }
    }
    showIntersections({});
    refreshTorusView();
    typesetInvariants();
}

function onKeyDown(event) {
    var delta = new Point(0, 0);
    if (event.key == 'a') delta.x -= 10;
    else if (event.key == 'd') delta.x += 10;
    if (event.key == 'w') delta.y -= 10;
    else if (event.key == 's') delta.y += 10;
    activeKnot.translate(delta);
    if (event.key == 'e') activeKnot.rotate(3);
    else if (event.key == 'q') activeKnot.rotate(-3);
    else if (event.key == 'm') activeKnot.scale(-1, 1);
    else if (event.key == 'z') popUndo();
    showIntersections({});
    refreshTorusView();
}

prepareLayers();
knotLayer.activate();
activeKnot = new Path({
    segments: [
        new Point(350, 220),
        new Point(450, 120),
        new Point(600, 220),
        new Point(450, 320)
    ],
    closed: true,
    strokeColor: 'black',
    strokeWidth: window.globals.strokeWidth,
    fullySelected: true,
    data: {kind: 'knot'}
});
activeKnot.smooth({type: 'catmull-rom', factor: 0.5});
pushUndo();
showIntersections({});
typesetInvariants();
refreshTorusView();
