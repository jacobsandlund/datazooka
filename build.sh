#!/bin/sh
echo '(function() {'

cat $(find src -type f)   # vaccine.js must NOT be in the source list.

cat vaccine.js  # Must be after sources.
echo '}());'
