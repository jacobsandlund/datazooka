#!/bin/sh

start() {
  title=$1
  sed '/<script .*src=.*>/d' test/index.html |
      sed "s#<h1>DataZooka</h1>#<h1>DataZooka ($title)</h1>#"
}

start Combined | sed '/<\/body>/i\
  <script src="/lib/crossfilter.js"></script>\
  <script src="/lib/d3.js"></script>\
  <script src="/datazooka.js"></script>\
  <script src="test.js"></script>\
  ' > test/combined.html

start Loader | sed '/<\/body>/i\
  <script src="/vaccine_loader.js"></script>\
  <script>vaccine_load("/test/test.js");</script>\
  ' > test/loader.html

