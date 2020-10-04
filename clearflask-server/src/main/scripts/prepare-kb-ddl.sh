#!/usr/bin/env bash

set -ex

SOURCE_DIR=$1
TARGET=$2

echo "-- PLUGIN DDL" >${TARGET}
for DIR in ${SOURCE_DIR}/*/; do
  DIR=${DIR%*/}
  NAME=${DIR##*/}
  if [[ ${NAME} == "analytics-plugin" ]]; then
    DDL_FILES="${DIR}/reports/calendar.sql $(find "${DIR}"/reports -type f -name '*.sql' -o -name '*.ddl' -maxdepth 1) $(find "${DIR}"/system -type f -name '*.sql' -o -name '*.ddl' -maxdepth 1)"
  else
    DDL_FILES=$(find ${DIR} -name '*.sql' -o -name '*.ddl')
  fi
  echo "DDL_FILES ${DDL_FILES}"

  echo >>${TARGET}
  echo "-- PLUGIN DDL -> ${NAME}" >>${TARGET}
  echo "use killbill;" >>${TARGET}
  # For some reason they decided to include some plugin ddls but the ddl is missing drop table if exists
  # https://github.com/killbill/killbill-cloud/blob/8738410a96081ca472d206cfe9e2fa134ad432c6/docker/templates/mariadb/tagged/Dockerfile.template#L21
  if [[ ${NAME} == "stripe-plugin" ]]; then
    echo "drop table if exists stripe_hpp_requests;" >>${TARGET}
    echo "drop table if exists stripe_responses;" >>${TARGET}
    echo "drop table if exists stripe_payment_methods;" >>${TARGET}
  fi
  if [[ ${NAME} == "payment-test-plugin" ]]; then
    echo "drop table if exists testpayment_hpp_requests;" >>${TARGET}
    echo "drop table if exists testpayment_responses;" >>${TARGET}
    echo "drop table if exists testpayment_payment_methods;" >>${TARGET}
  fi
  echo >>${TARGET}

  for DDL_FILE in $DDL_FILES; do
    DDL_NAME=${DDL_FILE##*/}
    echo "-- PLUGIN DDL -> ${NAME} -> ${DDL_NAME}" >>${TARGET}
    cat ${DDL_FILE} >>${TARGET}
    echo >>${TARGET}
  done

  COUNT=$((COUNT + 1))
done
