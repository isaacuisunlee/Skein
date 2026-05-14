var knotEncyclopedia = {};

function polyToInt(l, base) {
    if (!base) base = 1000;
    if (typeof bigInt == 'undefined') {
        var n = 0;
        for (var i = 0; i < l.length; i++) n += l[i] * Math.pow(base, i);
        return {value: n};
    }
    var toReturn = bigInt(0);
    for (var j = 0; j < l.length; j++) {
        toReturn = bigInt(base).pow(j).times(l[j]).plus(toReturn);
    }
    return toReturn;
}

function intToPoly(num, base) {
    if (!base) base = 1000;
    if (typeof bigInt == 'undefined' || num.value !== undefined) return [num.value || 0];
    num = bigInt(num);
    var sign = num < 0 ? -1 : 1;
    num = num.times(sign);
    var b = [];
    while (num.greater(0)) {
        var divmod = num.divmod(base);
        b.push(divmod.remainder.toJSNumber());
        num = divmod.quotient;
    }
    b.push(0);
    for (var i = 0; i < b.length; i++) {
        if (b[i] >= base / 2) {
            b[i] = b[i] - base;
            b[i + 1] = b[i + 1] + 1;
        }
        b[i] *= sign;
    }
    if (b[b.length - 1] == 0) b.pop();
    return b;
}

function det(matrix) {
    var size = matrix.length;
    var sum = typeof bigInt == 'undefined' ? 0 : bigInt(0);
    if (size === 0) return typeof bigInt == 'undefined' ? 1 : bigInt(1);
    if (size === 1) return matrix[0][0];
    for (var i = 0; i < size; i++) {
        var entry = matrix[0][i];
        var isZero = typeof bigInt == 'undefined' ? entry === 0 : bigInt(entry).equals(0);
        if (!isZero) {
            var smaller = [];
            for (var a = 1; a < size; a++) {
                smaller[a - 1] = [];
                for (var b = 0; b < size; b++) {
                    if (b < i) smaller[a - 1][b] = matrix[a][b];
                    else if (b > i) smaller[a - 1][b - 1] = matrix[a][b];
                }
            }
            var s = i % 2 === 0 ? 1 : -1;
            if (typeof bigInt == 'undefined') sum += entry * s * det(smaller);
            else sum = bigInt(entry).times(s).times(det(smaller)).plus(sum);
        }
    }
    return sum;
}
