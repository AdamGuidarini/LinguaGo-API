#!/bin/bash
/opt/lt/bin/libretranslate --host 127.0.0.1 --port 4000 --load-only en,es &
node /app/server.js &

trap 'kill $(jobs -p)' TERM INT
wait -n          # exit if either process dies, so podman can restart the container
exit $?