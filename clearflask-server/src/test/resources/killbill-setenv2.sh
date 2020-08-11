# Java Properties
export CATALINA_OPTS="$CATALINA_OPTS
                      -Dorg.killbill.queue.creator.name=localhost
                      -Dlogback.configurationFile=/var/lib/killbill/logback.xml
                      -Dorg.killbill.server.properties=file:///var/lib/killbill/killbill.properties
                      "
