set -ex

rm -fr ../clearflask-frontend/src/api/client
openapi-generator generate \
    -t typescript-fetch-templates \
    -i client-api.yaml \
    -g typescript-fetch \
    -o ../clearflask-frontend/src/api/client
