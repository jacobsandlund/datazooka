
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
        optionsPanel;

    holder.append('div')
        .attr('class', 'charts');

    panel = holder.append('div')
        .attr('class', 'control panel');


    lineOne = panel.append('div')
        .attr('class', 'panel-line');

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

    //updateShownPane = selectedPane.append('div')
    //    .attr('class', 'sub-pane update-shown')
    //    .style('display', 'none');
    //updateShownPane.append('div')
    //    .text('Update')
    //    .attr('class', 'update action button')
    //    .on('click', function() { renderSelected(); });
    //updateShownPane.append('div')
    //    .text('Cancel')
    //    .attr('class', 'cancel button')
    //    .style('display', 'none')
    //    .on('click', function() {
    //      changeDataName(dataNameRendered, false);
    //      userSelectCharts(selectedRendered, true);
    //    });

    optionsPanel = panel.append('div')
        .style('display', 'none');
    function changeUpdateStyle() {
      updateStyle = this.id;
      var alwaysUpdate = updateStyle === 'always-update';
      updateShownPane.style('display', alwaysUpdate ? 'none' : 'block');
    }
    function addUpdateStyle(style, label) {
      var div = optionsPanel.append('div');
      div.append('input')
          .attr('type', 'radio')
          .attr('name', 'update')
          .attr('id', style)
          .on('click', changeUpdateStyle);
      div.append('label')
          .attr('for', style)
          .text(label);
    }
    addUpdateStyle('always-update', 'Always update automatically');
    addUpdateStyle('smart-update', 'Smart update (on mouse still)');
    addUpdateStyle('manual-update', 'Manual update');
    optionsPanel.select('#always-update').property('checked', true);

    lineTwo = panel.append('div')
        .attr('class', 'panel-line');

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
        })
      .append('option')
        .attr('value', '')
        .text('');

    function toggleDock() {
      var dockButton = lineTwo.select('.dock.button'),
          dock = dockButton.classed('down');
      dockButton.classed('down', !dock);
      panel.style('position', dock ? null : 'fixed');
      if (dock) {
        dockButton.text('Undock');
      } else {
        dockButton.text('Dock');
      }
    }
    lineTwo.append('div')
        .attr('class', 'dock button')
        .on('click', toggleDock);
    toggleDock();
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

  function changeDataName(newDataName, clearSelected) {
    if (newDataName === dataName) {
      return;
    }
    var set = core.dataSet(newDataName),
        ids = set.definitionIds,
        defns = set.definitions,
        data,
        li;
    dataName = newDataName;
    data = ids.map(function(id) { return {id: id, label: defns[id].label}; });

    li = panel.select('.statistics ul').selectAll('li')
        .data(data, function(d) { return d; });
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
    //holder.select('.update.action.button').classed('active', needs);
    //holder.select('.cancel.button').style('display', needs ? null : 'none');
  }
  ui.needsUpdate = needsUpdate;

  ui.updating = function(updating) {
    holder.select('.charts').style('opacity', updating ? 0.3 : null);
  };

  ui.updated = function(name) {
    changeDataName(name);
    ui.needsUpdate(false);
    ui.updating(false);
  };

});

