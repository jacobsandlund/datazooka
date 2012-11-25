#!/bin/sh

development="public/test.html"
production="public/index.html"
demo="flights"
sed -e '/<!-- DEVELOPMENT -->/,/<!-- \/DEVELOPMENT -->/d' \
    -e 's#<!-- PRODUCTION -->#<script src="/datazooka.js"></script>#' \
    -e 's#\(/[^/]*\)\.js"#\1.min.js"#g' -e 's#\(/[^/]*\)\.css"#\1.min.css"#g' \
    -e "s/test.js/\/demos\/$demo.js/" \
    $development > $production
