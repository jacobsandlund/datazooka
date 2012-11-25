
define('ui', function(require, exports) {

  var d3 = require('d3'),
      core,
      holder,
      panel,
      disableModeTimer,
      dataName,
      numDataSets = 0,
      needsUpdate,
      chartMode,
      firstCompare;


  exports.setup = function(h) {

    // TODO: Remove circular dependency
    core = require('./core');

    holder = h;
    holder.attr('class', 'holder');

    var config,
        totals,
        interactions,
        statistics,
        updatePanel,
        viewToggles,
        optionsPanel;

    panel = holder.append('div')
        .attr('class', 'control-panel');

    panel.append('div')
        .attr('class', 'tool title')
        .text('DataZooka');

    config = panel.append('div')
        .attr('class', 'config');

    totals = config.append('div')
        .attr('class', 'totals pane');
    totals.append('span')
        .attr('class', 'active-data')
        .text('-');
    totals.append('span')
        .attr('class', 'percent-active')
        .text(' (XX.X%)');
    totals.append('span').text(' of ');
    totals.append('span')
        .attr('class', 'total')
        .text('-');
    totals.append('span')
        .attr('class', 'data-name');

    interactions = config.append('div')
        .attr('class', 'interactions pane')
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

    interactions.append('span').text('Add');

    interactions.append('div')
        .attr('class', 'bar button')
        .text('Bar')
        .on('click', function() { setChartMode('bar'); });

    interactions.append('span').text('or');

    interactions.append('div')
        .attr('class', 'compare button')
        .text('Comparison')
        .on('click', function() { setChartMode('compare'); });

    interactions.append('span').text('charts.');

    statistics = interactions.append('div')
        .attr('class', 'statistics')
        .style('display', 'none');
    statistics.append('ul');

    updatePanel = statistics.append('div')
        .attr('class', 'update panel')
        .style('display', 'none');
    updatePanel.append('div')
        .attr('class', 'update action button')
        .text('Update')
        .on('click', function() { core.update('force'); });
    updatePanel.append('div')
        .attr('class', 'cancel button')
        .text('Cancel')
        .style('display', 'none')
        .on('click', core.cancel);

    config.append('div')
        .attr('class', 'remove-all button')
        .text('Remove All')
        .on('click', core.clearCharts);



    viewToggles = panel.append('div')
        .attr('class', 'view-toggles pane');

    viewToggles.append('div')
        .text('Options')
        .attr('class', 'options button')
        .on('click', toggleOptionsPanel);

    optionsPanel = viewToggles.append('div')
        .attr('class', 'options-panel')
        .style('display', 'none');
    optionsPanel.append('div')
        .attr('class', 'title')
        .text('Options');
    optionsPanel.append('div')
        .attr('class', 'remove')
        .html('&#10006;')
        .on('click', toggleOptionsPanel);
    function changeUpdateMode() {
      var updateMode = this.id.slice(7);
      var always = updateMode === 'always';
      core.updateMode(updateMode);
      updatePanel.style('display', always ? 'none' : 'block');
      if (always) {
        core.update();
      }
    }
    function addUpdateStyle(style, label) {
      var div = optionsPanel.append('div');
      div.append('input')
          .attr('type', 'radio')
          .attr('name', 'update')
          .attr('id', style)
          .on('click', changeUpdateMode);
      div.append('label')
          .attr('for', style)
          .text(label);
    }
    addUpdateStyle('update-always', 'Always update automatically');
    addUpdateStyle('update-smart', 'Smart update (on mouse still)');
    addUpdateStyle('update-manual', 'Manual update');
    optionsPanel.select('#update-' + core.updateMode()).property('checked', true);
    optionsPanel.append('div')
        .attr('class', 'close-options button')
        .text('Close')
        .on('click', toggleOptionsPanel);

  };

  function toggleOptionsPanel() {
    var optionsPanel = panel.select('.options-panel'),
        disp = optionsPanel.style('display');
    optionsPanel.style('display', disp === 'block' ? 'none' : 'block');
    panel.select('.options.button').classed('down', disp === 'none');
  }

  function showStatistics(show) {
    show = show ? null : 'none';
    if (!needsUpdate) {
      panel.select('.statistics').style('display', show);
    }
    panel.select('.statistics ul').style('display', show);
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

    li = panel.select('.statistics ul').selectAll('li')
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
    panel.selectAll('.statistics li.down').classed('down', false);
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

  exports.needsUpdate = function(needs) {
    needsUpdate = needs;
    if (needs) {
      panel.select('.statistics').style('display', 'block');
    }
    panel.select('.update.action.button').classed('active', needs);
    panel.select('.cancel.button').style('display', needs ? null : 'none');
  }

  exports.updating = function(updating) {
    holder.style('opacity', updating ? 0.3 : null);
    panel.classed('updating', updating);
  };

  exports.updated = function(name) {
    changeDataName(name);
    exports.needsUpdate(false);
    exports.updating(false);
  };

});

