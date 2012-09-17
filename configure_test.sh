#!/bin/sh

configure() {
  script=$1
  title=$2
  sed '/script src="..\/src\//d' test/index.html |
      sed "s#!-- script placeholder --#script src='$script'></script#" |
      sed "s#<h1>Binfo</h1>#<h1>Binfo ($title)</h1>#"
}

configure ../binfo.js Combined > test/combined.html
configure ../vaccine_loader.js Loader > test/loader.html

