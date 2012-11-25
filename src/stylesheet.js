
define('stylesheet', function(require, exports) {

  var d3 = require('d3'),
      config = require('./config');

  exports.setup = function(holder) {
    var css = '',
        i,
        lvl,
        levels = config.compareLevels,
        level = d3.scale.linear(),
        pts = [],
        domain,
        blue = 222,
        blueIndigo = 200,
        indigo = 180,
        indigoGreen = 158,
        green = 120,
        greenYellow = 80,
        yellow = 60,
        yellowOrange = 45,
        orange = 30,
        orangeRed = 15,
        red = 0,
        hue = d3.scale.linear(),
        saturation = d3.scale.linear(),
        fadeSaturation = d3.scale.linear(),
        brightness = d3.scale.linear(),
        fadeScale = d3.scale.linear(),
        fullScale = d3.scale.identity();
    level
        .domain([0, levels - 1])
        .range([0, 1]);

    pts = [
      {d: 0,      h: blue,        b: 35},
      {d: 0.17,   h: blueIndigo,  b: 40},
      {d: 0.22,   h: indigo,      b: 35},
      {d: 0.3,    h: indigoGreen, b: 38},
      {d: 0.41,   h: green,       b: 42},
      {d: 0.54,   h: greenYellow, b: 60},
      {d: 0.65,   h: yellow,      b: 50},
      {d: 0.725,  h: yellowOrange,b: 50},
      {d: 0.83,   h: orange,      b: 50},
      {d: 0.95,   h: orangeRed,   b: 50},
      {d: 1,      h: red,         b: 60}
    ];
    domain = pts.map(function(d) { return d.d; });
    hue.range(pts.map(function(d) { return d.h; }));
    brightness.range(pts.map(function(d) { return d.b;}));
    saturation
        .domain([0, 1])
        .range([100, 100]);
    fadeSaturation
        .domain([0, 1])
        .range([40, 40]);
    hue.domain(domain);
    brightness.domain(domain);
    fadeScale
        .domain([35, 60])
        .range([78, 92]);

    function addCss(prefix, sat, brightScale) {
      for (i = 0; i < levels; i++) {
        lvl = level(i);
        css += '.' + prefix + '-' + i + '{fill:hsl(';
        css += hue(lvl) + ',';
        css += sat(lvl) + '%,';
        css += brightScale(brightness(lvl)) + '%';
        css += ');}';
      }
    };

    addCss('level', saturation, fullScale);
    addCss('level-fade', fadeSaturation, fadeScale);

    holder.append('style').html(css);
  };

});

