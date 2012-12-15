.PHONY: build

test:
	@echo Open http://localhost:5000/test.html in a browser
	foreman start

build:
	foreman run ./build
