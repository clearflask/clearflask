# Java Properties
export CATALINA_OPTS="$CATALINA_OPTS
                      -Dorg.killbill.queue.creator.name=localhost
                      -Dlogback.configurationFile=/var/lib/killbill/logback.xml
                      -Dorg.killbill.server.properties=file:///var/lib/killbill/killbill.properties
                      "

# Strip newlines (https://bz.apache.org/bugzilla/show_bug.cgi?id=63815)
export CATALINA_OPTS="$(echo $CATALINA_OPTS)"
