set -ex

# Client API
rm -fr ../clearflask-frontend/src/api/client
openapi-generator generate \
    -t typescript-fetch-templates \
    -i client-api.yaml \
    -g typescript-fetch \
    -o ../clearflask-frontend/src/api/client
rm -fr ../clearflask-frontend/src/docs/client
openapi-generator generate \
    -i client-api.yaml \
    -g html \
    -o ../clearflask-frontend/src/docs/client

# Admin API
rm -fr ../clearflask-frontend/src/api/admin
openapi-generator generate \
    -t typescript-fetch-templates \
    -i admin-api.yaml \
    -g typescript-fetch \
    -o ../clearflask-frontend/src/api/admin
rm -fr ../clearflask-frontend/src/docs/admin
openapi-generator generate \
    -i admin-api.yaml \
    -g html \
    -o ../clearflask-frontend/src/docs/admin
