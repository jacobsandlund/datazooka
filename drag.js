
binfo._register('drag', [], function() {

  var dragApi = {},
      holder,
      drag,
      dragNode,
      ghost,
      ghostNode,
      topOffset,
      leftOffset,
      list,
      listNode;

  dragApi.setList = function(setHolder, setList) {
    holder = setHolder;
    list = setList;
    listNode = list.node();
    ghostNode = document.createElement('li');
    ghost = d3.select(ghostNode).attr('class', 'ghost');
    holder.on('mouseup', function() {
      if (drag) {
        endDrag();
      }
    });
    holder.on('mousemove', function() {
      if (drag) {
        updateDrag();
      }
    });
    list.on('mousedown', function() {
      var target = d3.event.target,
          parent;
      if (d3.select(target).classed('close')) {
        return;
      }
      parent = target;
      if (target === listNode) {
        return;
      }
      while (parent !== listNode) {
        target = parent;
        parent = target.parentNode
      }

      dragNode = target;
      var mouseDrag = d3.mouse(dragNode);
      leftOffset = mouseDrag[0];
      topOffset = mouseDrag[1];
      ghost.style('height', dragNode.offsetHeight + 'px');
      listNode.insertBefore(ghostNode, dragNode);
      drag = d3.select(dragNode)
          .classed('drag', true);
      updateDrag();
    });
  };

  function updateDrag() {
    var mouse = d3.mouse(listNode),
        x = mouse[0],
        y = mouse[1];
    drag.style('left', (x - leftOffset) + 'px');
    drag.style('top', (y - topOffset) + 'px');
  }

  function endDrag() {
    drag.classed('drag', false);
    ghost.remove();
    drag = null;
  }

  return dragApi;
});

