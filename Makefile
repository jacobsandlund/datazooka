.PHONY: build

test:
	foreman start

build:
	foreman run ./build
