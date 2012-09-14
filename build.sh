#!/bin/sh

file=binfo.js

echo '(function() {"use strict";' > $file
cat src/* >> $file
echo "}());" >> $file

