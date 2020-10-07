#!/usr/bin/env bash

set -ex

SOURCE_DIR=$1
TARGET=$2

# Overwrite
echo >${TARGET}

echo "-- PLUGIN DDL" >>${TARGET}
echo "CREATE USER IF NOT EXISTS 'killbill'@'%' IDENTIFIED BY 'killbill';" >>${TARGET}
echo "ALTER DATABASE killbill CHARACTER SET utf8 COLLATE utf8_bin;" >>${TARGET}
echo >>${TARGET}
for DIR in ${SOURCE_DIR}/*/; do
  DIR=${DIR%*/}
  NAME=${DIR##*/}
  if [[ ${NAME} == "analytics-plugin" ]]; then
    DDL_FILES="$(find ${DIR} -name 'ddl.sql')"
    DDL_FILES+="${DDL_FILES} ${DIR}/reports/calendar.sql"
    DDL_FILES+="${DDL_FILES} $(find "${DIR}"/reports -type f -name '*.sql' -o -name '*.ddl' -maxdepth 1)"
    DDL_FILES+="${DDL_FILES} $(find "${DIR}"/system -type f -name '*.sql' -o -name '*.ddl' -maxdepth 1)"
  else
    DDL_FILES=$(find ${DIR} -name 'ddl.sql')
  fi
  echo "DDL_FILES ${DDL_FILES}"

  echo >>${TARGET}
  echo "-- PLUGIN DDL -> ${NAME}" >>${TARGET}
  # For some reason they decided to include some plugin ddls but the ddl is missing drop table if exists
  # https://github.com/killbill/killbill-cloud/blob/8738410a96081ca472d206cfe9e2fa134ad432c6/docker/templates/mariadb/tagged/Dockerfile.template#L21
  if [[ ${NAME} == "stripe-plugin" ]]; then
    echo "drop table if exists stripe_hpp_requests;" >>${TARGET}
    echo "drop table if exists stripe_responses;" >>${TARGET}
    echo "drop table if exists stripe_payment_methods;" >>${TARGET}
  elif [[ ${NAME} == "analytics-plugin" ]]; then
    echo "drop table if exists report_accounts_summary;" >>${TARGET}
    echo "drop table if exists report_active_by_product_term_monthly;" >>${TARGET}
    echo "drop table if exists report_cancellations_daily;" >>${TARGET}
    echo "drop table if exists report_chargebacks_daily;" >>${TARGET}
    echo "drop table if exists ;" >>${TARGET}
    echo "drop table if exists ;" >>${TARGET}
  fi
  echo >>${TARGET}

  for DDL_FILE in $DDL_FILES; do
    DDL_NAME=${DDL_FILE##*/}
    echo "-- PLUGIN DDL -> ${NAME} -> ${DDL_NAME}" >>${TARGET}
    if [[ ${NAME} == "stripe-plugin" || ${NAME} == "killbill-email-notifications-plugin" ]]; then
      # Remove directives within comments such as "CHARACTER SET..." and "SET storage_engine..."
      sed 's/\/\*.*\*\///' ${DDL_FILE} >>${TARGET}
    else
      cat ${DDL_FILE} >>${TARGET}
    fi
    echo >>${TARGET}
  done

  COUNT=$((COUNT + 1))
done

echo >>${TARGET}
echo "-- PLUGIN DDL finalize" >>${TARGET}
echo "GRANT SELECT, UPDATE, DELETE, INSERT ON killbill.* TO 'killbill'@'%';" >>${TARGET}
echo >>${TARGET}
