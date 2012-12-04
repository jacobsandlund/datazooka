#!/bin/sh

development="public/test.html"
demo="flights"
sed -e '/<!-- DEVELOPMENT -->/,/<!-- \/DEVELOPMENT -->/d' \
    -e 's#<!-- PRODUCTION -->#<script src="/datazooka.js"></script>#' \
    -e "s/test.js/\/demos\/$demo.js/" \
    $development
