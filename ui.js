
binfo._register('ui', ['core'], function(ui, core) {

  "use strict";

  var rendering = ui.dependency('rendering'),
      setup = ui.dependency('setup'),
      holder,
      panel,
      disableModeTimer,
      dataName,
      chartMode,
      firstCompare;

  ui.setup = function(_, width) {
    holder = _;
    holder
        .attr('class', 'holder')
        .style('width', width);

    var lineOne,
        lineTwo,
        statistics,
        totals,
        updatePanel,
        optionsPanel;

    holder.append('div')
        .attr('class', 'charts');

    panel = holder.append('div')
        .attr('class', 'control panel');


    lineOne = panel.append('div')
        .attr('class', 'line-one panel-line');

    lineOne.append('div')
        .attr('class', 'bar button')
        .text('Bar')
        .on('click', function() { setChartMode('bar'); });

    lineOne.append('div')
        .attr('class', 'compare button')
        .text('Compare')
        .on('click', function() { setChartMode('compare'); });

    statistics = lineOne.append('div')
        .attr('class', 'statistics')
        .on('mouseover', function() {
          if (disableModeTimer) {
            clearTimeout(disableModeTimer);
          }
        })
        .on('mouseout', function() {
          var e = d3.event,
              tgt = e.target,
              related;
          // Taken from quirksmode
          related = e.relatedTarget;
          while (related !== tgt && related.nodeName !== 'BODY') {
            related = related.parentNode;
          }
          if (related === tgt) return;
          disableModeTimer = setTimeout(setChartMode, 550);
        });
    statistics.append('div')
        .attr('class', 'title')
        .text('Statistics');
    statistics.append('ul');

    lineOne.append('div')
        .attr('class', 'clear button')
        .text('Clear')
        .on('click', core.clearCharts);

    updatePanel = panel.append('div')
        .attr('class', 'update panel')
        .style('display', 'none');
    updatePanel.append('div')
        .attr('class', 'line-one panel-line')
      .append('div')
        .attr('class', 'update action button')
        .text('Update')
        .on('click', function() { core.update('force'); });
    updatePanel.append('div')
        .attr('class', 'line-two panel-line')
      .append('div')
        .attr('class', 'cancel button')
        .text('Cancel')
        .style('display', 'none')
        .on('click', core.cancel);

    function toggleDock() {
      var dockButton = lineOne.select('.dock.button'),
          dock = dockButton.classed('down');
      dockButton.classed('down', !dock);
      panel.classed('docked', dock);
      if (dock) {
        dockButton.text('Undock');
      } else {
        dockButton.text('Dock');
      }
    }
    lineOne.append('div')
        .attr('class', 'dock button')
        .on('click', toggleDock);
    toggleDock();

    lineTwo = panel.append('div')
        .attr('class', 'line-two panel-line');

    optionsPanel = lineTwo.append('div')
        .attr('class', 'options panel')
        .style('display', 'none');
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

    lineTwo.append('div')
        .text('Options')
        .attr('class', 'options button')
        .on('click', function() {
          var disp = optionsPanel.style('display');
          optionsPanel.style('display', disp === 'block' ? 'none' : 'block');
          d3.select(this).classed('down', disp === 'none');
        });

    totals = lineTwo.append('div')
        .attr('class', 'totals');
    totals.append('span')
        .attr('class', 'active-data')
        .text('-');
    totals.append('span').text(' of ');
    totals.append('span')
        .attr('class', 'total')
        .text('-');

    lineTwo.append('select')
        .attr('class', 'data-name')
        .on('change', function() {
          changeDataName(this.value);
          core.changeDataName(this.value);
        });
  };

  function showStatistics(show) {
    panel.select('.statistics').classed('show', show);
  };

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
    panel.select('.data-name').property('value', dataName);
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

  ui.addDataName = function(name) {
    panel.select('.data-name').append('option')
        .attr('value', name)
        .text(name);
  };

  function needsUpdate(needs) {
    holder.select('.update.action.button').classed('active', needs);
    holder.select('.cancel.button').style('display', needs ? null : 'none');
  }
  ui.needsUpdate = needsUpdate;

  ui.updating = function(updating) {
    holder.select('.charts').style('opacity', updating ? 0.3 : null);
    panel.style('opacity', updating ? 0.3 : null);
  };

  ui.updated = function(name) {
    changeDataName(name);
    ui.needsUpdate(false);
    ui.updating(false);
  };

});

