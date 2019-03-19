set -ex

openapi-generator generate \
    -i clearflask-api/client-api.yaml \
    -g typescript-fetch \
    -o clearflask-frontend/api \
    --additional-properties supportsES6=true \
    --additional-properties withInterfaces=true
