#!/bin/sh

# Replace environment variables in index.html
envsubst < ./dist/spa/index.html.template > ./dist/spa/index.html

# Execute CMD
exec "$@"
