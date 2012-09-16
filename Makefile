
.PHONY: all test configure min minjs mincss build

all: | build min

test:
	./configure_test.sh
	printf '\n\n!!!\nOpen localhost:3000 in a browser.\n!!!\n\n'
	node dev_server.js

min: minjs mincss

minjs:
	node_modules/uglify-js/bin/uglifyjs binfo.js > binfo.min.js

mincss:
	java -jar node_modules/yuicompressor/build/yuicompressor-*.jar binfo.css > binfo.min.css

build:
	sh build.sh

