#!/usr/bin/env bash

set -e

SOURCE_DIR=$1
TARGET=$2

# Overwrite
echo >${TARGET}

echo "-- PLUGIN DDL" >>${TARGET}
echo "USE 'killbill';" >>${TARGET}
echo "ALTER DATABASE killbill CHARACTER SET utf8 COLLATE utf8_bin;" >>${TARGET}
echo >>${TARGET}
for DIR in "${SOURCE_DIR}"/*/; do
  DIR=${DIR%*/}
  NAME=${DIR##*/}
  if [[ ${NAME} == "analytics-plugin" ]]; then
    # Load sql files in appropriate order
    DDL_FILES=$(find "${DIR}" -name 'ddl.sql')
    DDL_FILES+=" "$(find "${DIR}" -name 'calendar.sql')
    DDL_FILES+=" "$(find "${DIR}"/system -type f -name '*.sql' -o -name '*.ddl' -maxdepth 1)
    DDL_FILES+=" "$(find "${DIR}"/reports -type f \( -name '*.sql' -o -name '*.ddl' \) -a -not -name 'calendar.sql' -maxdepth 1)
    REPORT_PATHS=$(find "${DIR}"/reports -type d -mindepth 1 -maxdepth 1)
    for REPORT_PATH in ${REPORT_PATHS}; do
      DDL_FILES+=" "$(find "${REPORT_PATH}" -type f -name 'v_*sub*.sql' -o -name 'v_*sub*.ddl' | sort)
      DDL_FILES+=" "$(find "${REPORT_PATH}" -type f \( -name 'v_*.sql' -o -name 'v_*.ddl' \) -a -not -name 'v_*sub*' | sort)
      DDL_FILES+=" "$(find "${REPORT_PATH}" -type f \( -name '*.sql' -o -name '*.ddl' \) -a -not -name 'v_*')
      DDL_FILES+=" "$(find "${REPORT_PATH}" -type f -name '*.prc')
    done
  else
    DDL_FILES=$(find "${DIR}" -name 'ddl.sql')
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
  elif [[ ${NAME} == "payment-test-plugin" ]]; then
    echo "drop table if exists testpayment_hpp_requests;" >>${TARGET}
    echo "drop table if exists testpayment_responses;" >>${TARGET}
    echo "drop table if exists testpayment_payment_methods;" >>${TARGET}
  elif [[ ${NAME} == "analytics-plugin" ]]; then
    echo "drop table if exists report_accounts_summary;" >>${TARGET}
    echo "drop table if exists report_active_by_product_term_monthly;" >>${TARGET}
    echo "drop table if exists report_cancellations_daily;" >>${TARGET}
    echo "drop table if exists report_chargebacks_daily;" >>${TARGET}
    echo "drop table if exists report_invoices_balance_daily;" >>${TARGET}
    echo "drop table if exists report_invoices_daily;" >>${TARGET}
    echo "drop table if exists report_mrr_daily;" >>${TARGET}
    echo "drop table if exists report_new_accounts_daily;" >>${TARGET}
    echo "drop table if exists report_payment_provider_conversion_history;" >>${TARGET}
    echo "drop table if exists report_payment_provider_errors_sub2;" >>${TARGET}
    echo "drop table if exists report_payment_provider_errors;" >>${TARGET}
    echo "drop table if exists report_payment_provider_monitor_history;" >>${TARGET}
    echo "drop table if exists report_payments_by_provider_history;" >>${TARGET}
    echo "drop table if exists report_payments_by_provider_last_24h_summary;" >>${TARGET}
    echo "drop table if exists report_payments_total_daily;" >>${TARGET}
    echo "drop table if exists report_refunds_total_daily;" >>${TARGET}
  fi
  echo >>${TARGET}

  for DDL_FILE in $DDL_FILES; do
    DDL_NAME=${DDL_FILE##*/}
    echo "-- PLUGIN DDL -> ${NAME} -> ${DDL_NAME}" >>${TARGET}
    sed 's/\/\*.*\*\///' ${DDL_FILE} >>${TARGET}
    echo >>${TARGET}
  done
done
