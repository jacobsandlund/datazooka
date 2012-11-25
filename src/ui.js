
define('ui', function(require, exports) {

  var d3 = require('d3'),
      core,
      panel,
      disableModeTimer,
      dataName,
      numDataSets = 0,
      chartMode,
      firstCompare;


  exports.setup = function(h) {

    // TODO: Remove circular dependency
    core = require('./core');

    panel = d3.select('#control-panel');

    panel.select('#interactions')
        .on('mouseover', function() {
          if (disableModeTimer) {
            clearTimeout(disableModeTimer);
          }
        })
        .on('mouseout', function() {
          if (core.isMouseOut()) {
            disableModeTimer = setTimeout(setChartMode, 550);
          }
        });

    panel.select('#interactions .bar.button')
        .on('click', function() { setChartMode('bar'); });

    panel.select('#interactions .compare.button')
        .on('click', function() { setChartMode('compare'); });

    panel.select('.remove-all.button')
        .on('click', core.clearCharts);
  };

  function showStatistics(show) {
    show = show ? 'block' : null;
    panel.select('#variables').style('display', show);
  }

  function changeDataName(newDataName) {
    if (newDataName === dataName) {
      return;
    }
    var set = core.dataSet(newDataName),
        ids = set.definitionIds,
        defns = set.definitions,
        data,
        li;
    dataName = newDataName;
    if (numDataSets > 1) {
      panel.select('.data-name select').property('value', dataName);
    }
    data = ids.map(function(id) { return {id: id, label: defns[id].label}; });

    li = panel.select('#variables ul').selectAll('li')
        .data(data, function(d) { return d.id; });
    li.enter().append('li')
        .on('click', clickChart)
        .text(function(d) { return d.label; });
    li.exit().remove();
  }

  function clickChart(d) {
    if (chartMode === 'compare') {
      if (firstCompare) {
        if (firstCompare !== d.id) {
          core.addChart(firstCompare + '-' + d.id);
        }
        firstCompareReset();
      } else {
        firstCompare = d.id;
        d3.select(this).classed('down', true);
      }
    } else {
      core.addChart(d.id);
    }
  }

  function firstCompareReset() {
    firstCompare = null;
    panel.selectAll('#variables li.down').classed('down', false);
  }

  function setChartMode(mode) {
    if (chartMode === mode) {
      mode = null;
    }
    if (disableModeTimer) {
      clearTimeout(disableModeTimer);
    }
    chartMode = mode;
    panel.select('.compare.button').classed('down', mode === 'compare');
    panel.select('.bar.button').classed('down', mode === 'bar');
    if (mode) {
      showStatistics(true);
    } else {
      showStatistics(false);
      firstCompareReset();
    }
  }

  exports.addDataName = function(name) {
    numDataSets += 1;
    if (numDataSets === 1) {
      panel.select('.data-name')
          .text(name + '.');
    } else if (numDataSets === 2) {
      var nameHolder = panel.select('.data-name'),
          firstName = nameHolder.text();
      firstName = firstName.slice(0, firstName.length - 1);
      nameHolder.html('');
      nameHolder.append('select')
          .on('change', function() {
            changeDataName(this.value);
            core.changeDataName(this.value);
          });
      exports.addDataName(firstName);
      numDataSets -= 1;
      changeDataName(firstName);
    }
    if (numDataSets > 1) {
      panel.select('.data-name select').append('option')
          .attr('value', name)
          .text(name);
    }
  };

  exports.updating = function(updating) {
    d3.select('#holder').style('opacity', updating ? 0.3 : null);
    panel.classed('updating', updating);
  };

  exports.updated = function(name) {
    changeDataName(name);
    exports.updating(false);
  };

});

