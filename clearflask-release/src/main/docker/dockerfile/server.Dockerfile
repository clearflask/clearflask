FROM tomcat:9.0-jdk17-temurin
EXPOSE 8080
# JMX is intentionally not enabled here. Unauthenticated remote JMX exposes every config value (including
# signing keys and credentials) and lets anyone who can reach the port change config and log levels. For local
# development docker-compose.local.yml sets CATALINA_OPTS with JMX on; production operators who need JMX
# should enable it with authentication and SSL, bound to localhost.
ENV CATALINA_OPTS="-Dlog4j2.formatMsgNoLookups=true \
 --add-opens java.base/java.lang=ALL-UNNAMED \
 --add-opens java.base/java.util=ALL-UNNAMED \
 --add-opens java.base/java.lang.reflect=ALL-UNNAMED \
 --add-opens java.base/sun.reflect.generics.reflectiveObjects=ALL-UNNAMED \
 --add-opens java.base/java.security.cert=ALL-UNNAMED"
RUN apt-get update && \
    apt-get install -y procps iputils-ping telnet less curl vim mc
HEALTHCHECK --start-period=30s --interval=5s --timeout=1m --retries=3 \
    CMD wget --spider http://localhost:8080/api/health || exit 1
RUN rm -fr /usr/local/tomcat/webapps/*
ADD logging.properties /usr/local/tomcat/conf/logging.properties
ADD ROOT/ /usr/local/tomcat/webapps/ROOT
# BouncyCastle is 'provided' (not in the WAR) so it lives on Tomcat's shared classloader,
# keeping the JCE provider off the reloadable webapp classloader (see clearflask-server/pom.xml).
# Staged into the build context by clearflask-release's copy-bouncycastle-to-docker-context.
ADD lib/bc*-jdk*on-*.jar /usr/local/tomcat/lib/
ADD logback.xml /usr/local/tomcat/webapps/ROOT/WEB-INF/classes/logback.xml
