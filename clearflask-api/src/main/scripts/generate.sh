#!/usr/bin/env bash

set -ex
set -o pipefail

OPENAPI_SOURCE_DIR=$1
SCRIPTS_DIR=$2
OPENAPI_TARGET_DIR=$3
TEMPLATE_SOURCE_DIR=$4

PATH="$PWD/node/":$PATH
NODE="node/node"
NPM="${NODE} node/node_modules/pnpm/bin/pnpm.cjs"

OPENAPI_GENERATOR="${NPM} --package=@openapitools/openapi-generator-cli@cli-4.1.3 dlx openapi-generator"

# Frontend Client API
${OPENAPI_GENERATOR} generate \
    -t ${TEMPLATE_SOURCE_DIR}/typescript-fetch \
    -i ${OPENAPI_SOURCE_DIR}/api-client.yaml \
    -g typescript-fetch \
    -o ${OPENAPI_TARGET_DIR}/frontend-client &
PIDS[${#PIDS[@]}]=$!

# Frontend Admin API
${OPENAPI_GENERATOR} generate \
    -t ${TEMPLATE_SOURCE_DIR}/typescript-fetch \
    -i ${OPENAPI_SOURCE_DIR}/api-admin.yaml \
    -g typescript-fetch \
    -o ${OPENAPI_TARGET_DIR}/frontend-admin &
PIDS[${#PIDS[@]}]=$!

# Frontend Config Schema
${NODE} ${SCRIPTS_DIR}/createConfig.js ${OPENAPI_SOURCE_DIR}/api.yaml ${OPENAPI_TARGET_DIR}/frontend-schema &
PIDS[${#PIDS[@]}]=$!

# Connect API
${OPENAPI_GENERATOR} generate \
    -t ${TEMPLATE_SOURCE_DIR}/typescript-fetch \
    -p typescriptThreePlus=true \
    -i ${OPENAPI_SOURCE_DIR}/api-connect.yaml \
    -g typescript-fetch \
    -o ${OPENAPI_TARGET_DIR}/connect &
PIDS[${#PIDS[@]}]=$!

# Bundle Docs for use with Redoc
# Docs https://github.com/OpenAPITools/openapi-generator/blob/master/docs/generators/openapi-yaml.md
${OPENAPI_GENERATOR} generate \
    -i ${OPENAPI_SOURCE_DIR}/api-docs.yaml \
    -g openapi-yaml \
    -o ${OPENAPI_TARGET_DIR}/docs &
PIDS[${#PIDS[@]}]=$!

# Server API
# Additional properties docs: https://github.com/OpenAPITools/openapi-generator/blob/master/docs/generators/jaxrs-cxf-extended.md
${OPENAPI_GENERATOR} generate \
    -t ${TEMPLATE_SOURCE_DIR}/java-jaxrs \
    --ignore-file-override=${TEMPLATE_SOURCE_DIR}/java-jaxrs/.openapi-generator-ignore \
    -i ${OPENAPI_SOURCE_DIR}/api.yaml \
    -g jaxrs-cxf \
    --type-mappings=OffsetDateTime=Instant \
    --additional-properties=java8=true \
    --additional-properties=modelPackage=com.smotana.clearflask.api.model \
    --additional-properties=apiPackage=com.smotana.clearflask.api \
    --additional-properties=invokerPackage=com.smotana.clearflask.api \
    --additional-properties=groupId=com.smotana \
    --additional-properties=artifactId=clearflask \
    --additional-properties=dateLibrary=java8 \
    --additional-properties=disableHtmlEscaping=true \
    --additional-properties=generateApiTests=false \
    --additional-properties=generateApiDocumentation=false \
    --additional-properties=generateModelTests=false \
    --additional-properties=generateModelDocumentation=false \
    --additional-properties=generateSupportingFiles=false \
    --additional-properties=hideGenerationTimestamp=true \
    --additional-properties=addConsumesProducesJson=true \
    --additional-properties=useBeanValidation=true \
    --additional-properties=removeEnumValuePrefix=false \
    --additional-properties=sourceFolder=src/main/java \
    -o ${OPENAPI_TARGET_DIR}/server &
PIDS[${#PIDS[@]}]=$!

for PID in ${PIDS[*]}; do
    wait $PID
done
