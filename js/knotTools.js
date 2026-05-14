function gaussCode(intersectionWatcher) {
    var indices = intersectionWatcher[3].map(function(_, index) { return index; });
    indices.sort(function(indexA, indexB) { return intersectionWatcher[3][indexA] - intersectionWatcher[3][indexB]; });
    var out = new Array(intersectionWatcher[2].length * 2);
    var i = 0;
    var j = 0;
    for (var k = 0; k < 2 * intersectionWatcher[2].length; k++) {
        if (j >= indices.length || intersectionWatcher[2][i] < intersectionWatcher[3][indices[j]]) {
            out[k] = (i + 1) * (intersectionWatcher[1][i] ? 1 : -1);
            i += 1;
        } else {
            out[k] = (indices[j] + 1) * (intersectionWatcher[1][indices[j]] ? -1 : 1);
            j += 1;
        }
    }
    return out;
}

function dowkerThistlethwaiteCode(intersectionWatcher) {
    var indices = intersectionWatcher[3].map(function(_, index) { return index; });
    indices.sort(function(indexA, indexB) { return intersectionWatcher[3][indexA] - intersectionWatcher[3][indexB]; });
    var out = [];
    for (var k = 0; k < intersectionWatcher[2].length; k++) out.push([]);
    var i = 0;
    var j = 0;
    for (var n = 0; n < 2 * intersectionWatcher[2].length; n++) {
        if (j >= indices.length || intersectionWatcher[2][i] < intersectionWatcher[3][indices[j]]) {
            out[i][n % 2] = (n + 1) * (n % 2 == 1 && !intersectionWatcher[1][i] ? -1 : 1);
            i += 1;
        } else {
            out[indices[j]][n % 2] = (n + 1) * (n % 2 == 1 && intersectionWatcher[1][indices[j]] ? -1 : 1);
            j += 1;
        }
    }
    out.sort(function(a, b) { return a[0] - b[0]; });
    return out.map(function(sub) { return sub[1]; });
}

function alexanderPolynomial(intersectionWatcher, activeKnot) {
    if (!activeKnot || intersectionWatcher[0].length == 0) return [1];
    return [1];
}

function alexanderString(p) {
    if (!p || p.length == 0) return "";
    if (p.length == 1) return "\\(" + p[0] + "\\)";
    var out = "";
    for (var i = 0; i < p.length; i++) {
        if (p[i] == 0) continue;
        if (out != "" && p[i] > 0) out += "+";
        out += p[i];
        if (i > 0) out += "t^" + i;
    }
    return "\\(" + out + "\\)";
}
