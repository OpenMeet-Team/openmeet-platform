#!/bin/sh

echo "Starting OpenMeet Platform"
echo "App version: $(cat /usr/src/app/dist/spa/app-version.txt)"
echo "Commit SHA: $(cat /usr/src/app/dist/spa/commit-sha.txt)"

# Execute CMD
exec "$@"
