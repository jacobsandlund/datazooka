
binfo._register('ui', ['core'], function(ui, core) {

  "use strict";

  var rendering = ui.dependency('rendering'),
      setup = ui.dependency('setup'),
      holder,
      panel,
      dataName,
      compareActive,
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
        .attr('class', 'compare button')
        .text('Compare')
        .on('click', function() {
          compare(true);
        });

    statistics = lineOne.append('div')
        .attr('class', 'statistics')
        .on('mouseover', function() { showStatistics(true); })
        .on('mouseout', function() {
          if (!compareActive) {
            showStatistics(false)
          }
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
      panel.style('position', dock ? null : 'fixed');
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

  function compare(active) {
    compareActive = active;
    panel.select('.compare.button').classed('down', active);
    if (active) {
      showStatistics(true);
    }
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
        .on('click', function(d) { core.addChart(d.id); })
        .text(function(d) { return d.label; });
    li.exit().remove();
  }

  function addCompareChart() {
    var xc = holder.select('select.compare.xc').property('value'),
        yc = holder.select('select.compare.yc').property('value');
    holder.select('.add.action.button').classed('active', false);
    if (yc === '--nothing--') {
      addChart(xc);
    } else {
      addChart(xc + '-' + yc);
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

