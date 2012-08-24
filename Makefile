
.PHONY: all pack

all: | pack min

min: minjs mincss

minjs:
	node_modules/uglify-js/bin/uglifyjs binfo.js > binfo.min.js

mincss:
	java -jar node_modules/yuicompressor/build/yuicompressor-*.jar binfo.css > binfo.min.css

pack:
	cat \
		core.js \
		arrange.js \
		charts.js \
		logic.js \
		other.js \
		ui.js \
		> binfo.js
