
.PHONY: all pack

all: | pack min

min: minjs mincss

minjs:
	node_modules/uglify-js/bin/uglifyjs binfo.js > binfo.min.js

mincss:
	java -jar node_modules/yuicompressor/build/yuicompressor-*.jar binfo.css > binfo.min.css

pack:
	cat \
		src/core.js \
		src/arrange.js \
		src/charts.js \
		src/logic.js \
		src/other.js \
		src/ui.js \
		> binfo.js
