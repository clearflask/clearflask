#!/usr/bin/env bash

set -ex

SOURCE_DIR=$1
TARGET=$2

echo "-- PLUGIN DDL" >${TARGET}
for DIR in ${SOURCE_DIR}/*/; do
  DIR=${DIR%*/}
  NAME=${DIR##*/}
  # Analytics plugin ddl.sql is not located in root
  if [[ ${NAME} == "analytics-plugin" ]]; then
    DIR=${DIR}/org/killbill/billing/plugin/analytics
  fi

  echo >>${TARGET}
  echo "-- PLUGIN DDL: ${NAME}" >>${TARGET}
  echo "use killbill" >>${TARGET}
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
  cat ${DIR}/ddl.sql >>${TARGET}

  COUNT=$((COUNT + 1))
done
