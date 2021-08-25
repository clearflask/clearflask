FROM tomcat:8.5-jdk11-openjdk-slim
EXPOSE 8080
# JMX
EXPOSE 9950
EXPOSE 9951
ENV CATALINA_OPTS="-Dcom.sun.management.jmxremote \
 -Dcom.sun.management.jmxremote.authenticate=false \
 -Dcom.sun.management.jmxremote.ssl=false \
 -Dcom.sun.management.jmxremote.port=9950 \
 -Dcom.sun.management.jmxremote.rmi.port=9951 \
 -Djava.rmi.server.hostname=0.0.0.0"
RUN apt-get update && \
    apt-get install -y iputils-ping telnet less curl vim mc
HEALTHCHECK --start-period=30s --interval=5s --timeout=1m --retries=3 \
    CMD wget --spider http://localhost:8080/api/health || exit 1
RUN rm -fr /usr/local/tomcat/webapps/*
ADD logging.properties /usr/local/tomcat/conf/logging.properties
ADD ROOT/ /usr/local/tomcat/webapps/ROOT
ADD logback.xml /usr/local/tomcat/webapps/ROOT/WEB-INF/classes/logback.xml
