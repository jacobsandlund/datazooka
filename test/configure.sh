#!/bin/sh

start() {
  title=$1
  sed '/<script .*src=.*>/d' test/index.html |
      sed "s#<h1>Binfo</h1>#<h1>Binfo ($title)</h1>#"
}

start Combined | sed '/<\/body>/i\
  <script src="/lib/crossfilter.js"></script>\
  <script src="/lib/d3.js"></script>\
  <script src="/binfo.js"></script>\
  <script src="test.js"></script>\
  ' > test/combined.html

start Loader | sed '/<\/body>/i\
  <script src="/lib/crossfilter.js"></script>\
  <script src="/lib/d3.js"></script>\
  <script src="/vaccine_loader.js"></script>\
  <script>vaccine_load("/test/test.js");</script>\
  ' > test/loader.html

