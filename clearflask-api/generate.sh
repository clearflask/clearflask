set -ex

# Client API
rm -fr ../clearflask-frontend/src/api/client
openapi-generator generate \
    -t typescript-fetch-templates \
    -i api-client.yaml \
    -g typescript-fetch \
    -o ../clearflask-frontend/src/api/client

# Admin API
rm -fr ../clearflask-frontend/src/api/admin
openapi-generator generate \
    -t typescript-fetch-templates \
    -i api-admin.yaml \
    -g typescript-fetch \
    -o ../clearflask-frontend/src/api/admin

rm -fr ../clearflask-frontend/src/docs/api
openapi-generator generate \
    -i api.yaml \
    -g html \
    -o ../clearflask-frontend/src/docs/api
