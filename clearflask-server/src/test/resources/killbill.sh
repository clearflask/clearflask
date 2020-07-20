#!/bin/bash

set -ex

$KPM_INSTALL_CMD

# Install plugins
for PLUGIN_FILE_PATH in /var/lib/killbill/bundles/autoload/*; do
  if [[ ${PLUGIN_FILE_PATH} =~ .*/(([^/]+)-([0-9\.]+)\.jar) ]]; then
    PLUGIN_NAME=${BASH_REMATCH[2]}
    PLUGIN_VER=${BASH_REMATCH[3]}
    kpm install_java_plugin $PLUGIN_NAME $PLUGIN_VER --from-source-file=$PLUGIN_FILE_PATH --destination=/var/lib/killbill/bundles
  fi
done

exec /usr/share/tomcat/bin/catalina.sh run
