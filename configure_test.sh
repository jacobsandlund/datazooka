#!/bin/sh

sed '/script src="..\/src\//d' test/index.html |
    sed 's#!-- binfo.js placeholder --#script src="../binfo.js"></script#' |
    sed 's#<h1>Binfo</h1>#<h1>Binfo (Combined)</h1>#' > test/combined.html

