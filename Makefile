
.PHONY: all build

all: | build min

min: minjs mincss

minjs:
	node_modules/uglify-js/bin/uglifyjs binfo.js > binfo.min.js

mincss:
	java -jar node_modules/yuicompressor/build/yuicompressor-*.jar binfo.css > binfo.min.css

build:
	sh build.sh

