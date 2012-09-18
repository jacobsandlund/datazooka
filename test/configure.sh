#!/bin/sh

start() {
  title=$1
  sed '/<script .*src=.*>/d' test/index.html |
      sed "s#<h1>Binfo</h1>#<h1>Binfo ($title)</h1>#"
}

start Combined | sed '/<\/body>/i\
  <script src="crossfilter.v1.js"></script>\
  <script src="d3.v2.js"></script>\
  <script src="../binfo.js"></script>\
  <script src="test.js"></script>\
  ' > test/combined.html

start Loader | sed '/<\/body>/i\
  <script src="crossfilter.v1.js"></script>\
  <script src="d3.v2.js"></script>\
  <script src="../vaccine_loader.js"></script>\
  ' > test/loader.html

