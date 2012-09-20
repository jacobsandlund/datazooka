
define('datazooka/rendering', function(require, exports) {

  var d3 = require('d3'),
      chartSelection,
      formatNumber = d3.format(',d'),
      formatPercent = d3.format('.3p');

  function callCharts(name) {
    return function(chartData) {
      /*jshint validthis:true */
      d3.select(this).each(chartData.chart[name]);
    };
  }

  var updateCharts = callCharts('update'),
      renderCharts = callCharts('render'),
      cleanUpCharts = callCharts('resetUpdate');

  exports.refresh = function(active, total) {
    chartSelection.each(updateCharts);
    chartSelection.each(renderCharts);
    chartSelection.each(cleanUpCharts);
    d3.select('.active-data').text(formatNumber(active));
    d3.select('.total').text(formatNumber(total));
    d3.select('.percent-active').text(' (' + formatPercent(active / total) + ')');
  }

  exports.render = function(chartIds, charts) {
    var chartData;

    chartData = chartIds.map(function(id, i) {
      return {chart: charts[id]};
    });

    chartSelection = d3.select('.holder').selectAll('.chart')
        .data(chartData, function(d) { return d.chart.id; });

    chartSelection.enter()
      .append('div')
        .attr('class', 'chart')
      .append('div')
        .attr('class', 'title');

    chartSelection.exit().remove();

    chartSelection.order();
  };

});

