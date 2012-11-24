.PHONY: test build

all: | build min

test: configure-test
	printf '\n\n!!!\nOpen localhost:3000 in a browser.\n!!!\n\n'
	node dev_server_standalone.js

configure-test:
	test/configure.sh

build:
	./build.sh > public/datazooka.js

min: minjs mincss

minjs:
	node_modules/uglify-js/bin/uglifyjs public/datazooka.js > public/datazooka.min.js

mincss:
	java -jar node_modules/yuicompressor/build/yuicompressor-*.jar datazooka.css > public/datazooka.min.css
