# Java Properties
export CATALINA_OPTS="$CATALINA_OPTS
                      -Dorg.killbill.queue.creator.name=${KILLBILL_QUEUE_CREATOR_NAME:-localhost}
                      -Dlogback.configurationFile=/var/lib/killbill/logback.xml
                      -Dorg.killbill.server.properties=file://$KILLBILL_INSTALL_DIR/killbill.properties
                      "

#
# Load legacy properties (backward compatibility)
#
if [ ! -z ${KILLBILL_JRUBY_CONF_DIR+x} ]; then
  export KB_org_killbill_billing_osgi_bundles_jruby_conf_dir=$KILLBILL_JRUBY_CONF_DIR
fi
if [ ! -z ${KILLBILL_OSGI_DAO_CACHE_PREP_STMTS+x} ]; then
  export KB_org_killbill_billing_osgi_dao_cachePrepStmts=$KILLBILL_OSGI_DAO_CACHE_PREP_STMTS
elif [ ! -z ${KILLBILL_DAO_CACHE_PREP_STMTS+x} ]; then
  export KB_org_killbill_billing_osgi_dao_cachePrepStmts=$KILLBILL_DAO_CACHE_PREP_STMTS
fi
if [ ! -z ${KILLBILL_OSGI_DAO_CONNECTION_TIMEOUT+x} ]; then
  export KB_org_killbill_billing_osgi_dao_connectionTimeout=$KILLBILL_OSGI_DAO_CONNECTION_TIMEOUT
elif [ ! -z ${KILLBILL_DAO_CONNECTION_TIMEOUT+x} ]; then
  export KB_org_killbill_billing_osgi_dao_connectionTimeout=$KILLBILL_DAO_CONNECTION_TIMEOUT
fi
if [ ! -z ${KILLBILL_OSGI_DAO_IDLE_CONNECTION_TEST_PERIOD+x} ]; then
  export KB_org_killbill_billing_osgi_dao_idleConnectionTestPeriod=$KILLBILL_OSGI_DAO_IDLE_CONNECTION_TEST_PERIOD
elif [ ! -z ${KILLBILL_DAO_IDLE_CONNECTION_TEST_PERIOD+x} ]; then
  export KB_org_killbill_billing_osgi_dao_idleConnectionTestPeriod=$KILLBILL_DAO_IDLE_CONNECTION_TEST_PERIOD
fi
if [ ! -z ${KILLBILL_OSGI_DAO_IDLE_MAX_AGE+x} ]; then
  export KB_org_killbill_billing_osgi_dao_idleMaxAge=$KILLBILL_OSGI_DAO_IDLE_MAX_AGE
elif [ ! -z ${KILLBILL_DAO_IDLE_MAX_AGE+x} ]; then
  export KB_org_killbill_billing_osgi_dao_idleMaxAge=$KILLBILL_DAO_IDLE_MAX_AGE
fi
if [ ! -z ${KILLBILL_OSGI_DAO_LOG_LEVEL+x} ]; then
  export KB_org_killbill_billing_osgi_dao_logLevel=$KILLBILL_OSGI_DAO_LOG_LEVEL
elif [ ! -z ${KILLBILL_DAO_LOG_LEVEL+x} ]; then
  export KB_org_killbill_billing_osgi_dao_logLevel=$KILLBILL_DAO_LOG_LEVEL
fi
if [ ! -z ${KILLBILL_OSGI_DAO_MAX_ACTIVE+x} ]; then
  export KB_org_killbill_billing_osgi_dao_maxActive=$KILLBILL_OSGI_DAO_MAX_ACTIVE
elif [ ! -z ${KILLBILL_DAO_MAX_ACTIVE+x} ]; then
  export KB_org_killbill_billing_osgi_dao_maxActive=$KILLBILL_DAO_MAX_ACTIVE
fi
if [ ! -z ${KILLBILL_OSGI_DAO_MAX_CONNECTION_AGE+x} ]; then
  export KB_org_killbill_billing_osgi_dao_maxConnectionAge=$KILLBILL_OSGI_DAO_MAX_CONNECTION_AGE
elif [ ! -z ${KILLBILL_DAO_MAX_CONNECTION_AGE+x} ]; then
  export KB_org_killbill_billing_osgi_dao_maxConnectionAge=$KILLBILL_DAO_MAX_CONNECTION_AGE
fi
if [ ! -z ${KILLBILL_OSGI_DAO_MIN_IDLE+x} ]; then
  export KB_org_killbill_billing_osgi_dao_minIdle=$KILLBILL_OSGI_DAO_MIN_IDLE
elif [ ! -z ${KILLBILL_DAO_MIN_IDLE+x} ]; then
  export KB_org_killbill_billing_osgi_dao_minIdle=$KILLBILL_DAO_MIN_IDLE
fi
if [ ! -z ${KILLBILL_OSGI_DAO_MYSQL_SERVER_VERSION+x} ]; then
  export KB_org_killbill_billing_osgi_dao_mysqlServerVersion=$KILLBILL_OSGI_DAO_MYSQL_SERVER_VERSION
elif [ ! -z ${KILLBILL_DAO_MYSQL_SERVER_VERSION+x} ]; then
  export KB_org_killbill_billing_osgi_dao_mysqlServerVersion=$KILLBILL_DAO_MYSQL_SERVER_VERSION
fi
if [ ! -z ${KILLBILL_OSGI_DAO_PASSWORD+x} ]; then
  export KB_org_killbill_billing_osgi_dao_password=$KILLBILL_OSGI_DAO_PASSWORD
elif [ ! -z ${KILLBILL_DAO_PASSWORD+x} ]; then
  export KB_org_killbill_billing_osgi_dao_password=$KILLBILL_DAO_PASSWORD
fi
if [ ! -z ${KILLBILL_OSGI_DAO_POOLING_TYPE+x} ]; then
  export KB_org_killbill_billing_osgi_dao_poolingType=$KILLBILL_OSGI_DAO_POOLING_TYPE
elif [ ! -z ${KILLBILL_DAO_POOLING_TYPE+x} ]; then
  export KB_org_killbill_billing_osgi_dao_poolingType=$KILLBILL_DAO_POOLING_TYPE
fi
if [ ! -z ${KILLBILL_OSGI_DAO_PREP_STMT_CACHE_SIZE+x} ]; then
  export KB_org_killbill_billing_osgi_dao_prepStmtCacheSize=$KILLBILL_OSGI_DAO_PREP_STMT_CACHE_SIZE
elif [ ! -z ${KILLBILL_DAO_PREP_STMT_CACHE_SIZE+x} ]; then
  export KB_org_killbill_billing_osgi_dao_prepStmtCacheSize=$KILLBILL_DAO_PREP_STMT_CACHE_SIZE
fi
if [ ! -z ${KILLBILL_OSGI_DAO_PREP_STMT_CACHE_SQL_LIMIT+x} ]; then
  export KB_org_killbill_billing_osgi_dao_prepStmtCacheSqlLimit=$KILLBILL_OSGI_DAO_PREP_STMT_CACHE_SQL_LIMIT
elif [ ! -z ${KILLBILL_DAO_PREP_STMT_CACHE_SQL_LIMIT+x} ]; then
  export KB_org_killbill_billing_osgi_dao_prepStmtCacheSqlLimit=$KILLBILL_DAO_PREP_STMT_CACHE_SQL_LIMIT
fi
if [ ! -z ${KILLBILL_OSGI_DAO_URL+x} ]; then
  export KB_org_killbill_billing_osgi_dao_url=$KILLBILL_OSGI_DAO_URL
elif [ ! -z ${KILLBILL_DAO_URL+x} ]; then
  export KB_org_killbill_billing_osgi_dao_url=$KILLBILL_DAO_URL
fi
if [ ! -z ${KILLBILL_OSGI_DAO_USE_SERVER_PREP_STMTS+x} ]; then
  export KB_org_killbill_billing_osgi_dao_useServerPrepStmts=$KILLBILL_OSGI_DAO_USE_SERVER_PREP_STMTS
elif [ ! -z ${KILLBILL_DAO_USE_SERVER_PREP_STMTS+x} ]; then
  export KB_org_killbill_billing_osgi_dao_useServerPrepStmts=$KILLBILL_DAO_USE_SERVER_PREP_STMTS
fi
if [ ! -z ${KILLBILL_OSGI_DAO_USER+x} ]; then
  export KB_org_killbill_billing_osgi_dao_user=$KILLBILL_OSGI_DAO_USER
elif [ ! -z ${KILLBILL_DAO_USER+x} ]; then
  export KB_org_killbill_billing_osgi_dao_user=$KILLBILL_DAO_USER
fi
if [ ! -z ${KILLBILL_SERVER_NOTIFICATIONS_RETRIES+x} ]; then
  export KB_org_killbill_billing_server_notifications_retries=$KILLBILL_SERVER_NOTIFICATIONS_RETRIES
fi
if [ ! -z ${KILLBILL_SERVER_EVENT_BULK_SUBSCRIPTION_AGGREGATE+x} ]; then
  export KB_org_killbill_billing_server_event_bulk_subscription_aggregate=$KILLBILL_SERVER_EVENT_BULK_SUBSCRIPTION_AGGREGATE
fi
if [ ! -z ${KILLBILL_SERVER_EVENT_DISPATCH_TYPE_SKIP+x} ]; then
  export KB_org_killbill_billing_server_event_dispatch_type_skip=$KILLBILL_SERVER_EVENT_DISPATCH_TYPE_SKIP
fi
if [ ! -z ${KILLBILL_SERVER_EVENT_POST_TYPE_SKIP+x} ]; then
  export KB_org_killbill_billing_server_event_post_type_skip=$KILLBILL_SERVER_EVENT_POST_TYPE_SKIP
fi
if [ ! -z ${KILLBILL_UTIL_BROADCAST_RATE+x} ]; then
  export KB_org_killbill_billing_util_broadcast_rate=$KILLBILL_UTIL_BROADCAST_RATE
fi
if [ ! -z ${KILLBILL_CACHE_CONFIG_LOCATION+x} ]; then
  export KB_org_killbill_cache_config_location=$KILLBILL_CACHE_CONFIG_LOCATION
fi
if [ ! -z ${KILLBILL_CATALOG_BUNDLE_PATH+x} ]; then
  export KB_org_killbill_catalog_bundlePath=$KILLBILL_CATALOG_BUNDLE_PATH
fi
if [ ! -z ${KILLBILL_CATALOG_LOADER_THREADS_POOL_NB+x} ]; then
  export KB_org_killbill_catalog_loader_threads_pool_nb=$KILLBILL_CATALOG_LOADER_THREADS_POOL_NB
fi
if [ ! -z ${KILLBILL_CATALOG_URI+x} ]; then
  export KB_org_killbill_catalog_uri=$KILLBILL_CATALOG_URI
fi
if [ ! -z ${KILLBILL_CURRENCY_PROVIDER_DEFAULT+x} ]; then
  export KB_org_killbill_currency_provider_default=$KILLBILL_CURRENCY_PROVIDER_DEFAULT
fi
if [ ! -z ${KILLBILL_DAO_CACHE_PREP_STMTS+x} ]; then
  export KB_org_killbill_dao_cachePrepStmts=$KILLBILL_DAO_CACHE_PREP_STMTS
fi
if [ ! -z ${KILLBILL_DAO_CONNECTION_TIMEOUT+x} ]; then
  export KB_org_killbill_dao_connectionTimeout=$KILLBILL_DAO_CONNECTION_TIMEOUT
fi
if [ ! -z ${KILLBILL_DAO_HEALTH_CHECK_CONNECTION_TIMEOUT+x} ]; then
  export KB_org_killbill_dao_healthCheckConnectionTimeout=$KILLBILL_DAO_HEALTH_CHECK_CONNECTION_TIMEOUT
fi
if [ ! -z ${KILLBILL_DAO_HEALTH_CHECK_EXPECTED99TH_PERCENTILE+x} ]; then
  export KB_org_killbill_dao_healthCheckExpected99thPercentile=$KILLBILL_DAO_HEALTH_CHECK_EXPECTED99TH_PERCENTILE
fi
if [ ! -z ${KILLBILL_DAO_IDLE_CONNECTION_TEST_PERIOD+x} ]; then
  export KB_org_killbill_dao_idleConnectionTestPeriod=$KILLBILL_DAO_IDLE_CONNECTION_TEST_PERIOD
fi
if [ ! -z ${KILLBILL_DAO_IDLE_MAX_AGE+x} ]; then
  export KB_org_killbill_dao_idleMaxAge=$KILLBILL_DAO_IDLE_MAX_AGE
fi
if [ ! -z ${KILLBILL_DAO_LOG_LEVEL+x} ]; then
  export KB_org_killbill_dao_logLevel=$KILLBILL_DAO_LOG_LEVEL
fi
if [ ! -z ${KILLBILL_DAO_MAX_ACTIVE+x} ]; then
  export KB_org_killbill_dao_maxActive=$KILLBILL_DAO_MAX_ACTIVE
fi
if [ ! -z ${KILLBILL_DAO_MAX_CONNECTION_AGE+x} ]; then
  export KB_org_killbill_dao_maxConnectionAge=$KILLBILL_DAO_MAX_CONNECTION_AGE
fi
if [ ! -z ${KILLBILL_DAO_MIN_IDLE+x} ]; then
  export KB_org_killbill_dao_minIdle=$KILLBILL_DAO_MIN_IDLE
fi
if [ ! -z ${KILLBILL_DAO_MYSQL_SERVER_VERSION+x} ]; then
  export KB_org_killbill_dao_mysqlServerVersion=$KILLBILL_DAO_MYSQL_SERVER_VERSION
fi
if [ ! -z ${KILLBILL_DAO_PASSWORD+x} ]; then
  export KB_org_killbill_dao_password=$KILLBILL_DAO_PASSWORD
fi
if [ ! -z ${KILLBILL_DAO_POOLING_TYPE+x} ]; then
  export KB_org_killbill_dao_poolingType=$KILLBILL_DAO_POOLING_TYPE
fi
if [ ! -z ${KILLBILL_DAO_PREP_STMT_CACHE_SIZE+x} ]; then
  export KB_org_killbill_dao_prepStmtCacheSize=$KILLBILL_DAO_PREP_STMT_CACHE_SIZE
fi
if [ ! -z ${KILLBILL_DAO_PREP_STMT_CACHE_SQL_LIMIT+x} ]; then
  export KB_org_killbill_dao_prepStmtCacheSqlLimit=$KILLBILL_DAO_PREP_STMT_CACHE_SQL_LIMIT
fi
if [ ! -z ${KILLBILL_DAO_URL+x} ]; then
  export KB_org_killbill_dao_url=$KILLBILL_DAO_URL
fi
if [ ! -z ${KILLBILL_DAO_USE_SERVER_PREP_STMTS+x} ]; then
  export KB_org_killbill_dao_useServerPrepStmts=$KILLBILL_DAO_USE_SERVER_PREP_STMTS
fi
if [ ! -z ${KILLBILL_DAO_USER+x} ]; then
  export KB_org_killbill_dao_user=$KILLBILL_DAO_USER
fi
if [ ! -z ${KILLBILL_DEFAULT_LOCALE+x} ]; then
  export KB_org_killbill_default_locale=$KILLBILL_DEFAULT_LOCALE
fi
if [ ! -z ${KILLBILL_INVOICE_DISABLE_USAGE_ZERO_AMOUNT+x} ]; then
  export KB_org_killbill_invoice_disable_usage_zero_amount=$KILLBILL_INVOICE_DISABLE_USAGE_ZERO_AMOUNT
fi
if [ ! -z ${KILLBILL_INVOICE_DRY_RUN_NOTIFICATION_SCHEDULE+x} ]; then
  export KB_org_killbill_invoice_dryRunNotificationSchedule=$KILLBILL_INVOICE_DRY_RUN_NOTIFICATION_SCHEDULE
fi
if [ ! -z ${KILLBILL_INVOICE_EMAIL_NOTIFICATIONS_ENABLED+x} ]; then
  export KB_org_killbill_invoice_emailNotificationsEnabled=$KILLBILL_INVOICE_EMAIL_NOTIFICATIONS_ENABLED
fi
if [ ! -z ${KILLBILL_INVOICE_ENABLED+x} ]; then
  export KB_org_killbill_invoice_enabled=$KILLBILL_INVOICE_ENABLED
fi
if [ ! -z ${KILLBILL_INVOICE_GLOBAL_LOCK_RETRIES+x} ]; then
  export KB_org_killbill_invoice_globalLock_retries=$KILLBILL_INVOICE_GLOBAL_LOCK_RETRIES
fi
if [ ! -z ${KILLBILL_INVOICE_MAX_DAILY_NUMBER_OF_ITEMS_SAFETY_BOUND+x} ]; then
  export KB_org_killbill_invoice_maxDailyNumberOfItemsSafetyBound=$KILLBILL_INVOICE_MAX_DAILY_NUMBER_OF_ITEMS_SAFETY_BOUND
fi
if [ ! -z ${KILLBILL_INVOICE_MAX_INVOICE_LIMIT+x} ]; then
  export KB_org_killbill_invoice_maxInvoiceLimit=$KILLBILL_INVOICE_MAX_INVOICE_LIMIT
fi
if [ ! -z ${KILLBILL_INVOICE_MAX_NUMBER_OF_MONTHS_IN_FUTURE+x} ]; then
  export KB_org_killbill_invoice_maxNumberOfMonthsInFuture=$KILLBILL_INVOICE_MAX_NUMBER_OF_MONTHS_IN_FUTURE
fi
if [ ! -z ${KILLBILL_INVOICE_PARK_ACCOUNTS_WITH_UNKNOWN_USAGE+x} ]; then
  export KB_org_killbill_invoice_parkAccountsWithUnknownUsage=$KILLBILL_INVOICE_PARK_ACCOUNTS_WITH_UNKNOWN_USAGE
fi
if [ ! -z ${KILLBILL_INVOICE_READ_MAX_RAW_USAGE_PREVIOUS_PERIOD+x} ]; then
  export KB_org_killbill_invoice_readMaxRawUsagePreviousPeriod=$KILLBILL_INVOICE_READ_MAX_RAW_USAGE_PREVIOUS_PERIOD
fi
if [ ! -z ${KILLBILL_INVOICE_RESCHEDULE_INTERVAL_ON_LOCK+x} ]; then
  export KB_org_killbill_invoice_rescheduleIntervalOnLock=$KILLBILL_INVOICE_RESCHEDULE_INTERVAL_ON_LOCK
fi
if [ ! -z ${KILLBILL_INVOICE_SANITY_SAFETY_BOUND_ENABLED+x} ]; then
  export KB_org_killbill_invoice_sanitySafetyBoundEnabled=$KILLBILL_INVOICE_SANITY_SAFETY_BOUND_ENABLED
fi
if [ ! -z ${KILLBILL_LOCATION_FULL_URL+x} ]; then
  export KB_org_killbill_jaxrs_location_full_url=$KILLBILL_LOCATION_FULL_URL
fi
if [ ! -z ${KILLBILL_JAXRS_LOCATION_HOST+x} ]; then
  export KB_org_killbill_jaxrs_location_host=$KILLBILL_JAXRS_LOCATION_HOST
fi
if [ ! -z ${KILLBILL_JAXRS_LOCATION_USE_FORWARD_HEADERS+x} ]; then
  export KB_org_killbill_jaxrs_location_useForwardHeaders=$KILLBILL_JAXRS_LOCATION_USE_FORWARD_HEADERS
fi
if [ ! -z ${KILLBILL_THREADS_POOL_NB+x} ]; then
  export KB_org_killbill_jaxrs_threads_pool_nb=$KILLBILL_THREADS_POOL_NB
fi
if [ ! -z ${KILLBILL_JAXRS_TIMEOUT+x} ]; then
  export KB_org_killbill_jaxrs_timeout=$KILLBILL_JAXRS_TIMEOUT
fi
if [ ! -z ${KILLBILL_JRUBY_CONTEXT_SCOPE+x} ]; then
  export KB_org_killbill_jruby_context_scope=$KILLBILL_JRUBY_CONTEXT_SCOPE
fi
if [ ! -z ${KILLBILL_MANUAL_PAY_TEMPLATE_NAME+x} ]; then
  export KB_org_killbill_manualPayTemplate_name=$KILLBILL_MANUAL_PAY_TEMPLATE_NAME
fi
if [ ! -z ${KILLBILL_METRICS_GRAPHITE_HOST+x} ]; then
  export KB_org_killbill_metrics_graphite_host=$KILLBILL_METRICS_GRAPHITE_HOST
fi
if [ ! -z ${KILLBILL_METRICS_GRAPHITE_INTERVAL+x} ]; then
  export KB_org_killbill_metrics_graphite_interval=$KILLBILL_METRICS_GRAPHITE_INTERVAL
fi
if [ ! -z ${KILLBILL_METRICS_GRAPHITE_PORT+x} ]; then
  export KB_org_killbill_metrics_graphite_port=$KILLBILL_METRICS_GRAPHITE_PORT
fi
if [ ! -z ${KILLBILL_METRICS_GRAPHITE_PREFIX+x} ]; then
  export KB_org_killbill_metrics_graphite_prefix=$KILLBILL_METRICS_GRAPHITE_PREFIX
fi
if [ ! -z ${KILLBILL_METRICS_GRAPHITE+x} ]; then
  export KB_org_killbill_metrics_graphite=$KILLBILL_METRICS_GRAPHITE
fi
if [ ! -z ${KILLBILL_METRICS_INFLUXDB_DATABASE+x} ]; then
  export KB_org_killbill_metrics_influxDb_database=$KILLBILL_METRICS_INFLUXDB_DATABASE
fi
if [ ! -z ${KILLBILL_METRICS_INFLUXDB_HOST+x} ]; then
  export KB_org_killbill_metrics_influxDb_host=$KILLBILL_METRICS_INFLUXDB_HOST
fi
if [ ! -z ${KILLBILL_METRICS_INFLUXDB_INTERVAL+x} ]; then
  export KB_org_killbill_metrics_influxDb_interval=$KILLBILL_METRICS_INFLUXDB_INTERVAL
fi
if [ ! -z ${KILLBILL_METRICS_INFLUXDB_PORT+x} ]; then
  export KB_org_killbill_metrics_influxDb_port=$KILLBILL_METRICS_INFLUXDB_PORT
fi
if [ ! -z ${KILLBILL_METRICS_INFLUXDB_PREFIX+x} ]; then
  export KB_org_killbill_metrics_influxDb_prefix=$KILLBILL_METRICS_INFLUXDB_PREFIX
fi
if [ ! -z ${KILLBILL_METRICS_INFLUXDB_SENDER_TYPE+x} ]; then
  export KB_org_killbill_metrics_influxDb_senderType=$KILLBILL_METRICS_INFLUXDB_SENDER_TYPE
fi
if [ ! -z ${KILLBILL_METRICS_INFLUXDB_SOCKET_TIMEOUT+x} ]; then
  export KB_org_killbill_metrics_influxDb_socketTimeout=$KILLBILL_METRICS_INFLUXDB_SOCKET_TIMEOUT
fi
if [ ! -z ${KILLBILL_METRICS_INFLUXDB+x} ]; then
  export KB_org_killbill_metrics_influxDb=$KILLBILL_METRICS_INFLUXDB
fi
if [ ! -z ${KILLBILL_NOTIFICATIONQ_ANALYTICS_CLAIMED+x} ]; then
  export KB_org_killbill_notificationq_analytics_claimed=$KILLBILL_NOTIFICATIONQ_ANALYTICS_CLAIMED
fi
if [ ! -z ${KILLBILL_NOTIFICATIONQ_ANALYTICS_HISTORY_TABLE_NAME+x} ]; then
  export KB_org_killbill_notificationq_analytics_historyTableName=$KILLBILL_NOTIFICATIONQ_ANALYTICS_HISTORY_TABLE_NAME
fi
if [ ! -z ${KILLBILL_NOTIFICATIONQ_ANALYTICS_IN_MEMORY+x} ]; then
  export KB_org_killbill_notificationq_analytics_inMemory=$KILLBILL_NOTIFICATIONQ_ANALYTICS_IN_MEMORY
fi
if [ ! -z ${KILLBILL_MAX_FAILURE_RETRY+x} ]; then
  export KB_org_killbill_notificationq_analytics_max_failure_retry=$KILLBILL_MAX_FAILURE_RETRY
fi
if [ ! -z ${KILLBILL_ANALYTICS_NOTIFICATION_NB_THREADS+x} ]; then
  export KB_org_killbill_notificationq_analytics_notification_nbThreads=$KILLBILL_ANALYTICS_NOTIFICATION_NB_THREADS
fi
if [ ! -z ${KILLBILL_ANALYTICS_LIFECYCLE_DISPATCH_NBTHREADS+x} ]; then
  export KB_org_killbill_notificationq_analytics_lifecycle_dispatch_nbThreads=$KILLBILL_ANALYTICS_LIFECYCLE_DISPATCH_NBTHREADS
fi
if [ ! -z ${KILLBILL_ANALYTICS_LIFECYCLE_COMPLETE_NBTHREADS+x} ]; then
  export KB_org_killbill_notificationq_analytics_lifecycle_complete_nbThreads=$KILLBILL_ANALYTICS_LIFECYCLE_COMPLETE_NBTHREADS
fi
if [ ! -z ${KILLBILL_ANALYTICS_QUEUE_CAPACITY+x} ]; then
  export KB_org_killbill_notificationq_analytics_queue_capacity=$KILLBILL_ANALYTICS_QUEUE_CAPACITY
fi
if [ ! -z ${KILLBILL_ANALYTICS_REAP_THRESHOLD+x} ]; then
  export KB_org_killbill_notificationq_analytics_reapThreshold=$KILLBILL_ANALYTICS_REAP_THRESHOLD
fi
if [ ! -z ${KILLBILL_ANALYTICS_MAX_REDISPATCH_COUNT+x} ]; then
  export KB_org_killbill_notificationq_analytics_maxReDispatchCount=$KILLBILL_ANALYTICS_MAX_REDISPATCH_COUNT
fi
if [ ! -z ${KILLBILL_ANALYTICS_REAP_SCHEDULE+x} ]; then
  export KB_org_killbill_notificationq_analytics_reapSchedule=$KILLBILL_ANALYTICS_REAP_SCHEDULE
fi
if [ ! -z ${KILLBILL_NOTIFICATIONQ_ANALYTICS_SLEEP+x} ]; then
  export KB_org_killbill_notificationq_analytics_sleep=$KILLBILL_NOTIFICATIONQ_ANALYTICS_SLEEP
fi
if [ ! -z ${KILLBILL_NOTIFICATIONQ_ANALYTICS_TABLE_NAME+x} ]; then
  export KB_org_killbill_notificationq_analytics_tableName=$KILLBILL_NOTIFICATIONQ_ANALYTICS_TABLE_NAME
fi
if [ ! -z ${KILLBILL_NOTIFICATIONQ_ANALYTICS_SHUTDOWN_TIMEOUT+x} ]; then
  export KB_org_killbill_notificationq_analytics_shutdownTimeout=$KILLBILL_NOTIFICATIONQ_ANALYTICS_SHUTDOWN_TIMEOUT
fi
if [ ! -z ${KILLBILL_MAIN_CLAIM_TIME+x} ]; then
  export KB_org_killbill_notificationq_main_claim_time=$KILLBILL_MAIN_CLAIM_TIME
fi
if [ ! -z ${KILLBILL_NOTIFICATIONQ_MAIN_CLAIMED+x} ]; then
  export KB_org_killbill_notificationq_main_claimed=$KILLBILL_NOTIFICATIONQ_MAIN_CLAIMED
fi
if [ ! -z ${KILLBILL_NOTIFICATIONQ_MAIN_HISTORY_TABLE_NAME+x} ]; then
  export KB_org_killbill_notificationq_main_historyTableName=$KILLBILL_NOTIFICATIONQ_MAIN_HISTORY_TABLE_NAME
fi
if [ ! -z ${KILLBILL_NOTIFICATIONQ_MAIN_IN_MEMORY+x} ]; then
  export KB_org_killbill_notificationq_main_inMemory=$KILLBILL_NOTIFICATIONQ_MAIN_IN_MEMORY
fi
if [ ! -z ${KILLBILL_MAX_FAILURE_RETRY+x} ]; then
  export KB_org_killbill_notificationq_main_max_failure_retry=$KILLBILL_MAX_FAILURE_RETRY
fi
if [ ! -z ${KILLBILL_MAIN_NOTIFICATION_NB_THREADS+x} ]; then
  export KB_org_killbill_notificationq_main_notification_nbThreads=$KILLBILL_MAIN_NOTIFICATION_NB_THREADS
fi
if [ ! -z ${KILLBILL_MAIN_NOTIFICATION_OFF+x} ]; then
  export KB_org_killbill_notificationq_main_notification_off=$KILLBILL_MAIN_NOTIFICATION_OFF
fi
if [ ! -z ${KILLBILL_MAIN_LIFECYCLE_DISPATCH_NBTHREADS+x} ]; then
  export KB_org_killbill_notificationq_main_lifecycle_dispatch_nbThreads=$KILLBILL_MAIN_LIFECYCLE_DISPATCH_NBTHREADS
fi
if [ ! -z ${KILLBILL_MAIN_LIFECYCLE_COMPLETE_NBTHREADS+x} ]; then
  export KB_org_killbill_notificationq_main_lifecycle_complete_nbThreads=$KILLBILL_MAIN_LIFECYCLE_COMPLETE_NBTHREADS
fi
if [ ! -z ${KILLBILL_MAIN_QUEUE_CAPACITY+x} ]; then
  export KB_org_killbill_notificationq_main_queue_capacity=$KILLBILL_MAIN_QUEUE_CAPACITY
fi
if [ ! -z ${KILLBILL_MAIN_REAP_THRESHOLD+x} ]; then
  export KB_org_killbill_notificationq_main_reapThreshold=$KILLBILL_MAIN_REAP_THRESHOLD
fi
if [ ! -z ${KILLBILL_MAIN_MAX_REDISPATCH_COUNT+x} ]; then
  export KB_org_killbill_notificationq_main_maxReDispatchCount=$KILLBILL_MAIN_MAX_REDISPATCH_COUNT
fi
if [ ! -z ${KILLBILL_MAIN_REAP_SCHEDULE+x} ]; then
  export KB_org_killbill_notificationq_main_reapSchedule=$KILLBILL_MAIN_REAP_SCHEDULE
fi
if [ ! -z ${KILLBILL_MAIN_QUEUE_MODE+x} ]; then
  export KB_org_killbill_notificationq_main_queue_mode=$KILLBILL_MAIN_QUEUE_MODE
fi
if [ ! -z ${KILLBILL_NOTIFICATIONQ_MAIN_SLEEP+x} ]; then
  export KB_org_killbill_notificationq_main_sleep=$KILLBILL_NOTIFICATIONQ_MAIN_SLEEP
fi
if [ ! -z ${KILLBILL_NOTIFICATIONQ_MAIN_TABLE_NAME+x} ]; then
  export KB_org_killbill_notificationq_main_tableName=$KILLBILL_NOTIFICATIONQ_MAIN_TABLE_NAME
fi
if [ ! -z ${KILLBILL_NOTIFICATIONQ_MAIN_SHUTDOWN_TIMEOUT+x} ]; then
  export KB_org_killbill_notificationq_main_shutdownTimeout=$KILLBILL_NOTIFICATIONQ_MAIN_SHUTDOWN_TIMEOUT
fi
if [ ! -z ${KILLBILL_BUNDLE_CACHE_NAME+x} ]; then
  export KB_org_killbill_osgi_bundle_cache_name=$KILLBILL_BUNDLE_CACHE_NAME
fi
if [ ! -z ${KILLBILL_BUNDLE_INSTALL_DIR+x} ]; then
  export KB_org_killbill_osgi_bundle_install_dir=$KILLBILL_BUNDLE_INSTALL_DIR
fi
if [ ! -z ${KILLBILL_BUNDLE_PROPERTY_NAME+x} ]; then
  export KB_org_killbill_osgi_bundle_property_name=$KILLBILL_BUNDLE_PROPERTY_NAME
fi
if [ ! -z ${KILLBILL_OSGI_ROOT_DIR+x} ]; then
  export KB_org_killbill_osgi_root_dir=$KILLBILL_OSGI_ROOT_DIR
fi
if [ ! -z ${KILLBILL_EXPORT_PACKAGES_API+x} ]; then
  export KB_org_killbill_osgi_system_bundle_export_packages_api=$KILLBILL_EXPORT_PACKAGES_API
fi
if [ ! -z ${KILLBILL_EXPORT_PACKAGES_EXTRA+x} ]; then
  export KB_org_killbill_osgi_system_bundle_export_packages_extra=$KILLBILL_EXPORT_PACKAGES_EXTRA
fi
if [ ! -z ${KILLBILL_EXPORT_PACKAGES_JAVA+x} ]; then
  export KB_org_killbill_osgi_system_bundle_export_packages_java=$KILLBILL_EXPORT_PACKAGES_JAVA
fi
if [ ! -z ${KILLBILL_OVERDUE_URI+x} ]; then
  export KB_org_killbill_overdue_uri=$KILLBILL_OVERDUE_URI
fi
if [ ! -z ${KILLBILL_RETRY_MAX_ATTEMPTS+x} ]; then
  export KB_org_killbill_payment_failure_retry_max_attempts=$KILLBILL_RETRY_MAX_ATTEMPTS
fi
if [ ! -z ${KILLBILL_FAILURE_RETRY_MULTIPLIER+x} ]; then
  export KB_org_killbill_payment_failure_retry_multiplier=$KILLBILL_FAILURE_RETRY_MULTIPLIER
fi
if [ ! -z ${KILLBILL_RETRY_START_SEC+x} ]; then
  export KB_org_killbill_payment_failure_retry_start_sec=$KILLBILL_RETRY_START_SEC
fi
if [ ! -z ${KILLBILL_PAYMENT_GLOBAL_LOCK_RETRIES+x} ]; then
  export KB_org_killbill_payment_globalLock_retries=$KILLBILL_PAYMENT_GLOBAL_LOCK_RETRIES
fi
if [ ! -z ${KILLBILL_PAYMENT_INVOICE_PLUGIN+x} ]; then
  export KB_org_killbill_payment_invoice_plugin=$KILLBILL_PAYMENT_INVOICE_PLUGIN
fi
if [ ! -z ${KILLBILL_JANITOR_ATTEMPTS_DELAY+x} ]; then
  export KB_org_killbill_payment_janitor_attempts_delay=$KILLBILL_JANITOR_ATTEMPTS_DELAY
fi
if [ ! -z ${KILLBILL_JANITOR_PENDING_RETRIES+x} ]; then
  export KB_org_killbill_payment_janitor_pending_retries=$KILLBILL_JANITOR_PENDING_RETRIES
fi
if [ ! -z ${KILLBILL_PAYMENT_JANITOR_RATE+x} ]; then
  export KB_org_killbill_payment_janitor_rate=$KILLBILL_PAYMENT_JANITOR_RATE
fi
if [ ! -z ${KILLBILL_JANITOR_UNKNOWN_RETRIES+x} ]; then
  export KB_org_killbill_payment_janitor_unknown_retries=$KILLBILL_JANITOR_UNKNOWN_RETRIES
fi
if [ ! -z ${KILLBILL_PLUGIN_THREADS_NB+x} ]; then
  export KB_org_killbill_payment_plugin_threads_nb=$KILLBILL_PLUGIN_THREADS_NB
fi
if [ ! -z ${KILLBILL_PAYMENT_PLUGIN_TIMEOUT+x} ]; then
  export KB_org_killbill_payment_plugin_timeout=$KILLBILL_PAYMENT_PLUGIN_TIMEOUT
fi
if [ ! -z ${KILLBILL_PAYMENT_PROVIDER_DEFAULT+x} ]; then
  export KB_org_killbill_payment_provider_default=$KILLBILL_PAYMENT_PROVIDER_DEFAULT
fi
if [ ! -z ${KILLBILL_PAYMENT_RETRY_DAYS+x} ]; then
  export KB_org_killbill_payment_retry_days=$KILLBILL_PAYMENT_RETRY_DAYS
fi
if [ ! -z ${KILLBILL_EXTERNAL_CLAIM_TIME+x} ]; then
  export KB_org_killbill_persistent_bus_external_claim_time=$KILLBILL_EXTERNAL_CLAIM_TIME
fi
if [ ! -z ${KILLBILL_BUS_EXTERNAL_HISTORY_TABLE_NAME+x} ]; then
  export KB_org_killbill_persistent_bus_external_historyTableName=$KILLBILL_BUS_EXTERNAL_HISTORY_TABLE_NAME
fi
if [ ! -z ${KILLBILL_BUS_EXTERNAL_IN_MEMORY+x} ]; then
  export KB_org_killbill_persistent_bus_external_inMemory=$KILLBILL_BUS_EXTERNAL_IN_MEMORY
fi
if [ ! -z ${KILLBILL_EXTERNAL_INFLIGHT_CLAIMED+x} ]; then
  export KB_org_killbill_persistent_bus_external_inflight_claimed=$KILLBILL_EXTERNAL_INFLIGHT_CLAIMED
fi
if [ ! -z ${KILLBILL_MAX_FAILURE_RETRY+x} ]; then
  export KB_org_killbill_persistent_bus_external_max_failure_retry=$KILLBILL_MAX_FAILURE_RETRY
fi
if [ ! -z ${KILLBILL_BUS_EXTERNAL_NB_THREADS+x} ]; then
  export KB_org_killbill_persistent_bus_external_nbThreads=$KILLBILL_BUS_EXTERNAL_NB_THREADS
fi
if [ ! -z ${KILLBILL_BUS_EXTERNAL_LIFECYCLE_DISPATCH_NBTHREADS+x} ]; then
  export KB_org_killbill_persistent_bus_external_lifecycle_dispatch_nbThreads=$KILLBILL_BUS_EXTERNAL_LIFECYCLE_DISPATCH_NBTHREADS
fi
if [ ! -z ${KILLBILL_BUS_EXTERNAL_LIFECYCLE_COMPLETE_NBTHREADS+x} ]; then
  export KB_org_killbill_persistent_bus_external_lifecycle_complete_nbThreads=$KILLBILL_BUS_EXTERNAL_LIFECYCLE_COMPLETE_NBTHREADS
fi
if [ ! -z ${KILLBILL_EXTERNAL_QUEUE_CAPACITY+x} ]; then
  export KB_org_killbill_persistent_bus_external_queue_capacity=$KILLBILL_EXTERNAL_QUEUE_CAPACITY
fi
if [ ! -z ${KILLBILL_BUS_EXTERNAL_REAP_THRESHOLD+x} ]; then
  export KB_org_killbill_persistent_bus_external_reapThreshold=$KILLBILL_BUS_EXTERNAL_REAP_THRESHOLD
fi
if [ ! -z ${KILLBILL_BUS_EXTERNAL_MAX_REDISPATCH_COUNT+x} ]; then
  export KB_org_killbill_persistent_bus_external_maxReDispatchCount=$KILLBILL_BUS_EXTERNAL_MAX_REDISPATCH_COUNT
fi
if [ ! -z ${KILLBILL_BUS_EXTERNAL_REAP_SCHEDULE+x} ]; then
  export KB_org_killbill_persistent_bus_external_reapSchedule=$KILLBILL_BUS_EXTERNAL_REAP_SCHEDULE
fi
if [ ! -z ${KILLBILL_BUS_EXTERNAL_SLEEP+x} ]; then
  export KB_org_killbill_persistent_bus_external_sleep=$KILLBILL_BUS_EXTERNAL_SLEEP
fi
if [ ! -z ${KILLBILL_BUS_EXTERNAL_TABLE_NAME+x} ]; then
  export KB_org_killbill_persistent_bus_external_tableName=$KILLBILL_BUS_EXTERNAL_TABLE_NAME
fi
if [ ! -z ${KILLBILL_BUS_EXTERNAL_USE_INFLIGHT_Q+x} ]; then
  export KB_org_killbill_persistent_bus_external_useInflightQ=$KILLBILL_BUS_EXTERNAL_USE_INFLIGHT_Q
fi
if [ ! -z ${KILLBILL_BUS_EXTERNAL_SHUTDOWN_TIMEOUT+x} ]; then
  export KB_org_killbill_persistent_bus_external_shutdownTimeout=$KILLBILL_BUS_EXTERNAL_SHUTDOWN_TIMEOUT
fi
if [ ! -z ${KILLBILL_MAIN_CLAIM_TIME+x} ]; then
  export KB_org_killbill_persistent_bus_main_claim_time=$KILLBILL_MAIN_CLAIM_TIME
fi
if [ ! -z ${KILLBILL_BUS_MAIN_CLAIMED+x} ]; then
  export KB_org_killbill_persistent_bus_main_claimed=$KILLBILL_BUS_MAIN_CLAIMED
fi
if [ ! -z ${KILLBILL_BUS_MAIN_HISTORY_TABLE_NAME+x} ]; then
  export KB_org_killbill_persistent_bus_main_historyTableName=$KILLBILL_BUS_MAIN_HISTORY_TABLE_NAME
fi
if [ ! -z ${KILLBILL_BUS_MAIN_IN_MEMORY+x} ]; then
  export KB_org_killbill_persistent_bus_main_inMemory=$KILLBILL_BUS_MAIN_IN_MEMORY
fi
if [ ! -z ${KILLBILL_MAX_FAILURE_RETRY+x} ]; then
  export KB_org_killbill_persistent_bus_main_max_failure_retry=$KILLBILL_MAX_FAILURE_RETRY
fi
if [ ! -z ${KILLBILL_BUS_MAIN_NB_THREADS+x} ]; then
  export KB_org_killbill_persistent_bus_main_nbThreads=$KILLBILL_BUS_MAIN_NB_THREADS
fi
if [ ! -z ${KILLBILL_BUS_MAIN_OFF+x} ]; then
  export KB_org_killbill_persistent_bus_main_off=$KILLBILL_BUS_MAIN_OFF
fi
if [ ! -z ${KILLBILL_BUS_MAIN_LIFECYCLE_DISPATCH_NBTHREADS+x} ]; then
  export KB_org_killbill_persistent_bus_main_lifecycle_dispatch_nbThreads=$KILLBILL_BUS_MAIN_LIFECYCLE_DISPATCH_NBTHREADS
fi
if [ ! -z ${KILLBILL_BUS_MAIN_LIFECYCLE_COMPLETE_NBTHREADS+x} ]; then
  export KB_org_killbill_persistent_bus_main_lifecycle_complete_nbThreads=$KILLBILL_BUS_MAIN_LIFECYCLE_COMPLETE_NBTHREADS
fi
if [ ! -z ${KILLBILL_MAIN_QUEUE_CAPACITY+x} ]; then
  export KB_org_killbill_persistent_bus_main_queue_capacity=$KILLBILL_MAIN_QUEUE_CAPACITY
fi
if [ ! -z ${KILLBILL_BUS_MAIN_REAP_THRESHOLD+x} ]; then
  export KB_org_killbill_persistent_bus_main_reapThreshold=$KILLBILL_BUS_MAIN_REAP_THRESHOLD
fi
if [ ! -z ${KILLBILL_BUS_MAIN_MAX_REDISPATCH_COUNT+x} ]; then
  export KB_org_killbill_persistent_bus_main_maxReDispatchCount=$KILLBILL_BUS_MAIN_MAX_REDISPATCH_COUNT
fi
if [ ! -z ${KILLBILL_BUS_MAIN_REAP_SCHEDULE+x} ]; then
  export KB_org_killbill_persistent_bus_main_reapSchedule=$KILLBILL_BUS_MAIN_REAP_SCHEDULE
fi
if [ ! -z ${KILLBILL_MAIN_QUEUE_MODE+x} ]; then
  export KB_org_killbill_persistent_bus_main_queue_mode=$KILLBILL_MAIN_QUEUE_MODE
fi
if [ ! -z ${KILLBILL_BUS_MAIN_SLEEP+x} ]; then
  export KB_org_killbill_persistent_bus_main_sleep=$KILLBILL_BUS_MAIN_SLEEP
fi
if [ ! -z ${KILLBILL_BUS_MAIN_TABLE_NAME+x} ]; then
  export KB_org_killbill_persistent_bus_main_tableName=$KILLBILL_BUS_MAIN_TABLE_NAME
fi
if [ ! -z ${KILLBILL_BUS_MAIN_SHUTDOWN_TIMEOUT+x} ]; then
  export KB_org_killbill_persistent_bus_main_shutdownTimeout=$KILLBILL_BUS_MAIN_SHUTDOWN_TIMEOUT
fi
if [ ! -z ${KILLBILL_RBAC_GLOBAL_SESSION_TIMEOUT+x} ]; then
  export KB_org_killbill_rbac_globalSessionTimeout=$KILLBILL_RBAC_GLOBAL_SESSION_TIMEOUT
fi
if [ ! -z ${KILLBILL_SECURITY_SHIRO_NB_HASH_ITERATIONS+x} ]; then
  export KB_org_killbill_security_shiroNbHashIterations=$KILLBILL_SECURITY_SHIRO_NB_HASH_ITERATIONS
fi
if [ ! -z ${KILLBILL_SECURITY_SHIRO_RESOURCE_PATH+x} ]; then
  export KB_org_killbill_security_shiroResourcePath=$KILLBILL_SECURITY_SHIRO_RESOURCE_PATH
fi
if [ ! -z ${KILLBILL_SECURITY_AUTH0_URL+x} ]; then
  export KB_org_killbill_security_auth0_url=$KILLBILL_SECURITY_AUTH0_URL
fi
if [ ! -z ${KILLBILL_SECURITY_AUTH0_CLIENT_ID+x} ]; then
  export KB_org_killbill_security_auth0_clientId=$KILLBILL_SECURITY_AUTH0_CLIENT_ID
fi
if [ ! -z ${KILLBILL_SECURITY_AUTH0_CLIENT_SECRET+x} ]; then
  export KB_org_killbill_security_auth0_clientSecret=$KILLBILL_SECURITY_AUTH0_CLIENT_SECRET
fi
if [ ! -z ${KILLBILL_SECURITY_AUTH0_API_IDENTIFIER+x} ]; then
  export KB_org_killbill_security_auth0_apiIdentifier=$KILLBILL_SECURITY_AUTH0_API_IDENTIFIER
fi
if [ ! -z ${KILLBILL_SECURITY_AUTH0_ISSUER+x} ]; then
  export KB_org_killbill_security_auth0_issuer=$KILLBILL_SECURITY_AUTH0_ISSUER
fi
if [ ! -z ${KILLBILL_SECURITY_AUTH0_AUDIENCE+x} ]; then
  export KB_org_killbill_security_auth0_audience=$KILLBILL_SECURITY_AUTH0_AUDIENCE
fi
if [ ! -z ${KILLBILL_SECURITY_AUTH0_USERNAME_CLAIM+x} ]; then
  export KB_org_killbill_security_auth0_usernameClaim=$KILLBILL_SECURITY_AUTH0_USERNAME_CLAIM
fi
if [ ! -z ${KILLBILL_SECURITY_AUTH0_DATABASE_CONNECTION_NAME+x} ]; then
  export KB_org_killbill_security_auth0_databaseConnectionName=$KILLBILL_SECURITY_AUTH0_DATABASE_CONNECTION_NAME
fi
if [ ! -z ${KILLBILL_SECURITY_AUTH0_CONNECT_TIMEOUT+x} ]; then
  export KB_org_killbill_security_auth0_connectTimeout=$KILLBILL_SECURITY_AUTH0_CONNECT_TIMEOUT
fi
if [ ! -z ${KILLBILL_SECURITY_AUTH0_READ_TIMEOUT+x} ]; then
  export KB_org_killbill_security_auth0_readTimeout=$KILLBILL_SECURITY_AUTH0_READ_TIMEOUT
fi
if [ ! -z ${KILLBILL_SECURITY_AUTH0_REQUEST_TIMEOUT+x} ]; then
  export KB_org_killbill_security_auth0_requestTimeout=$KILLBILL_SECURITY_AUTH0_REQUEST_TIMEOUT
fi
if [ ! -z ${KILLBILL_SECURITY_AUTH0_ALLOWED_CLOCK_SKEW+x} ]; then
  export KB_org_killbill_security_auth0_allowedClockSkew=$KILLBILL_SECURITY_AUTH0_ALLOWED_CLOCK_SKEW
fi
if [ ! -z ${KILLBILL_SERVER_BASE_URL+x} ]; then
  export KB_org_killbill_server_baseUrl=$KILLBILL_SERVER_BASE_URL
fi
if [ ! -z ${KILLBILL_SERVER_HTTP_GZIP+x} ]; then
  export KB_org_killbill_server_http_gzip=$KILLBILL_SERVER_HTTP_GZIP
fi
if [ ! -z ${KILLBILL_SERVER_MULTITENANT+x} ]; then
  export KB_org_killbill_server_multitenant=$KILLBILL_SERVER_MULTITENANT
fi
if [ ! -z ${KILLBILL_SERVER_REGION+x} ]; then
  export KB_org_killbill_server_region=$KILLBILL_SERVER_REGION
fi
if [ ! -z ${KILLBILL_SERVER_SHUTDOWN_DELAY+x} ]; then
  export KB_org_killbill_server_shutdownDelay=$KILLBILL_SERVER_SHUTDOWN_DELAY
fi
if [ ! -z ${KILLBILL_SERVER_TEST_MODE+x} ]; then
  export KB_org_killbill_server_test_mode=$KILLBILL_SERVER_TEST_MODE
fi
if [ ! -z ${KILLBILL_TEMPLATE_BUNDLE_PATH+x} ]; then
  export KB_org_killbill_template_bundlePath=$KILLBILL_TEMPLATE_BUNDLE_PATH
fi
if [ ! -z ${KILLBILL_TEMPLATE_INVOICE_FORMATTER_FACTORY_CLASS+x} ]; then
  export KB_org_killbill_template_invoiceFormatterFactoryClass=$KILLBILL_TEMPLATE_INVOICE_FORMATTER_FACTORY_CLASS
fi
if [ ! -z ${KILLBILL_TEMPLATE_NAME+x} ]; then
  export KB_org_killbill_template_name=$KILLBILL_TEMPLATE_NAME
fi
if [ ! -z ${KILLBILL_TENANT_BROADCAST_RATE+x} ]; then
  export KB_org_killbill_tenant_broadcast_rate=$KILLBILL_TENANT_BROADCAST_RATE
fi
if [ ! -z ${KILLBILL_ANALYTICS_REFRESH_DELAY+x} ]; then
  export KB_org_killbill_billing_plugin_analytics_refreshDelay=$KILLBILL_ANALYTICS_REFRESH_DELAY
fi
if [ ! -z ${KILLBILL_ANALYTICS_BLACKLIST+x} ]; then
  export KB_org_killbill_billing_plugin_analytics_blacklist=$KILLBILL_ANALYTICS_BLACKLIST
fi
if [ ! -z ${KILLBILL_ANALYTICS_IGNORED_GROUP+x} ]; then
  export KB_org_killbill_billing_plugin_analytics_ignoredGroups=$KILLBILL_ANALYTICS_IGNORED_GROUP
fi
if [ ! -z ${KILLBILL_ANALYTICS_LOCK_SLEEP_MILLISECONDS+x} ]; then
  export KB_org_killbill_billing_plugin_analytics_lockSleepMilliSeconds=$KILLBILL_ANALYTICS_LOCK_SLEEP_MILLISECONDS
fi
if [ ! -z ${KILLBILL_KPM_USERNAME+x} ]; then
  export KB_org_killbill_billing_plugin_kpm_adminUsername=$KILLBILL_KPM_USERNAME
fi
if [ ! -z ${KILLBILL_KPM_PASSWORD+x} ]; then
  export KB_org_killbill_billing_plugin_kpm_adminPassword=$KILLBILL_KPM_PASSWORD
fi
if [ ! -z ${KILLBILL_KPM_PATH+x} ]; then
  export KB_org_killbill_billing_plugin_kpm_kpmPath=$KILLBILL_KPM_PATH
fi
if [ ! -z ${KILLBILL_KPM_BUNDLES_PATH+x} ]; then
  export KB_org_killbill_billing_plugin_kpm_bundlesPath=$KILLBILL_KPM_BUNDLES_PATH
fi
if [ ! -z ${KILLBILL_KPM_NEXUS_URL+x} ]; then
  export KB_org_killbill_billing_plugin_kpm_nexusUrl=$KILLBILL_KPM_NEXUS_URL
fi
if [ ! -z ${KILLBILL_KPM_NEXUS_REPOSITORY+x} ]; then
  export KB_org_killbill_billing_plugin_kpm_nexusRepository=$KILLBILL_KPM_NEXUS_REPOSITORY
fi
if [ ! -z ${KILLBILL_KPM_STRICT_SSL+x} ]; then
  export KB_org_killbill_billing_plugin_kpm_strictSSL=$KILLBILL_KPM_STRICT_SSL
fi
if [ ! -z ${KILLBILL_KPM_READ_TIMEOUT_SEC+x} ]; then
  export KB_org_killbill_billing_plugin_kpm_readTimeoutSec=$KILLBILL_KPM_READ_TIMEOUT_SEC
fi
if [ ! -z ${KILLBILL_KPM_CONNECT_TIMEOUT_SEC+x} ]; then
  export KB_org_killbill_billing_plugin_kpm_connectTimeoutSec=$KILLBILL_KPM_CONNECT_TIMEOUT_SEC
fi
if [ ! -z ${KILLBILL_CACHE_CONFIG_REDIS+x} ]; then
  export KB_org_killbill_cache_config_redis=$KILLBILL_CACHE_CONFIG_REDIS
fi
if [ ! -z ${KILLBILL_CACHE_CONFIG_REDIS_URL+x} ]; then
  export KB_org_killbill_cache_config_redis_url=$KILLBILL_CACHE_CONFIG_REDIS_URL
fi
if [ ! -z ${KILLBILL_CACHE_CONFIG_REDIS_PASSWORD+x} ]; then
  export KB_org_killbill_cache_config_redis_password=$KILLBILL_CACHE_CONFIG_REDIS_PASSWORD
fi
if [ ! -z ${KILLBILL_CACHE_CONFIG_REDIS_CONNECTION_MINIMUM_IDLE_SIZE+x} ]; then
  export KB_org_killbill_cache_config_redis_connectionMinimumIdleSize=$KILLBILL_CACHE_CONFIG_REDIS_CONNECTION_MINIMUM_IDLE_SIZE
fi
