all: build configure mincss

build:
	./build.sh | node_modules/uglify-js/bin/uglifyjs > public/datazooka.min.js

configure:
	./configure.sh

mincss:
	java -jar node_modules/yuicompressor/build/yuicompressor-*.jar datazooka.css > public/datazooka.min.css
