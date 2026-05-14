window.globals = {
    neighbors: 0,
    strokeWidth: 5,
    gapWidth: 2,
    strokeColor: 'black',
    showIntersections: true,
    independentHandles: false,
    smooth: false,
    isomorphy: true,
    torusMode: false,
    showUniversalCover: true,
    coverRadius: 1,
    torusWidth: 500,
    torusHeight: 350
};

var polynomial = document.getElementById('alexanderPolynomial');
var jonesPolynomial = document.getElementById('jonesPolynomial');
var homflyPolynomial = document.getElementById('homflyPolynomial');
var candidates = document.getElementById('candidates');
var candidates_p = document.getElementById('candidates-p');
var smoothing = document.getElementById('smoothing');
var dragging = document.getElementById('dragging');
var isomorphy = document.getElementById('isomorphy');
var showIntersections = document.getElementById('showIntersections');
var dragIndependently = document.getElementById('dragIndependently');
var dt = document.getElementById('dt');
var log = document.getElementById('log');
var gauss = document.getElementById('gauss');
var orthButton = document.getElementById('orthButton');
var jonesButton = document.getElementById('jonesButton');
var homflyButton = document.getElementById('homflyButton');
var dtInput = document.getElementById('dtInput');
var rolfsenInput = document.getElementById('rolfsenInput');
var torusMode = document.getElementById('torusMode');
var showUniversalCover = document.getElementById('showUniversalCover');
var coverRadius = document.getElementById('coverRadius');
var torusWidth = document.getElementById('torusWidth');
var torusHeight = document.getElementById('torusHeight');

isomorphy.checked = smoothing.checked = showIntersections.checked = true;
dragging.checked = dragIndependently.checked = false;

function syncTorusControls() {
    if (torusMode) torusMode.checked = !!window.globals.torusMode;
    if (showUniversalCover) showUniversalCover.checked = !!window.globals.showUniversalCover;
    if (coverRadius) coverRadius.value = window.globals.coverRadius;
    if (torusWidth) torusWidth.value = window.globals.torusWidth;
    if (torusHeight) torusHeight.value = window.globals.torusHeight;
    if (isomorphy && window.globals.torusMode) isomorphy.checked = false;
}

function refreshAfterTorusControl() {
    if (window.globals.torusMode) {
        window.globals.isomorphy = false;
        if (isomorphy) isomorphy.checked = false;
    }
    if (window.globals.refreshTorusView) window.globals.refreshTorusView();
    if (window.globals.switchIsomorphy) window.globals.switchIsomorphy();
}

window.globals.syncTorusControls = syncTorusControls;
syncTorusControls();

torusMode.onchange = function() {
    window.globals.torusMode = this.checked;
    refreshAfterTorusControl();
};
showUniversalCover.onchange = function() {
    window.globals.showUniversalCover = this.checked;
    refreshAfterTorusControl();
};
coverRadius.oninput = function() {
    var v = parseInt(this.value);
    if (isNaN(v)) v = 1;
    if (v < 0) v = 0;
    if (v > 3) v = 3;
    this.value = v;
    window.globals.coverRadius = v;
    refreshAfterTorusControl();
};
torusWidth.oninput = function() {
    window.globals.torusWidth = Number(this.value || 500);
    refreshAfterTorusControl();
};
torusHeight.oninput = function() {
    window.globals.torusHeight = Number(this.value || 350);
    refreshAfterTorusControl();
};

function flatten() {
    smoothing.checked = false;
    window.globals.flatten();
}
function straighten() {
    smoothing.checked = false;
    window.globals.straighten();
}
function toTikz() {
    var string = window.globals.toTikz();
    navigator.clipboard.writeText(string);
}
function readJSON(file) {
    var reader = new FileReader();
    reader.onload = function(e) {
        window.globals.fromJSON(e.target.result);
    };
    reader.readAsText(file);
}
function toSVG() {
    var svg = window.globals.toSVG();
    svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    var svgData = svg.outerHTML;
    var svgBlob = new Blob(['\r\n', svgData], {type:"image/svg+xml;charset=utf-8"});
    var svgUrl = URL.createObjectURL(svgBlob);
    var downloadLink = document.createElement("a");
    downloadLink.href = svgUrl;
    downloadLink.download = "knottingham";
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
}
function toJSON() {
    var jsonString = window.globals.toJSON();
    var dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(jsonString);
    var dl = document.createElement("a");
    dl.setAttribute("href", dataStr);
    dl.setAttribute("download", "knot.knottingham");
    document.body.appendChild(dl);
    dl.click();
    document.body.removeChild(dl);
}

var pyodide = null;
async function getPyodide(display) {
    if (display) display.innerHTML = "loading...";
}
async function orthogonalise(button, code, codeType, successString, errorString) {
    if (button) button.innerHTML = errorString || "Pyodide unavailable in this build.";
}
function runSage(code, callback, display) {
    if (display) display.innerHTML = "Connection to SageCell unavailable.";
}
function getJones() {
    if (window.globals.torusMode) {
        jonesPolynomial.innerHTML = "";
        return;
    }
    runSage('', function(){}, jonesButton);
}
function getHomfly() {
    if (window.globals.torusMode) {
        homflyPolynomial.innerHTML = "";
        return;
    }
    runSage('', function(){}, homflyButton);
}
