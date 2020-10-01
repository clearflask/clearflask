#!/bin/bash

set -ex
sudo yum install -y mc telnet
sudo amazon-linux-extras install -y ruby2.6 tomcat8.5
sudo yum install -y java-1.8.0-openjdk gcc ruby-devel
sudo gem update --system
sudo gem install io-console kpm
sudo mkdir -p /var/lib/killbill
sudo chown -R ec2-user:ec2-user /var/lib/killbill
cat > /var/lib/killbill/kpm.yml <<"EOF"
killbill:
  version: 0.22.10
  plugins:
    java:
      - name: analytics
        version: 7.0.8
      - name: email-notifications
        version: 0.6.1
      - name: stripe
        version: 7.0.4
  webapp_path: /var/lib/tomcat/webapps/killbill/ROOT.war
  plugins_dir: /var/lib/killbill/bundles
kaui:
  version: 2.0.5
  plugins_dir: /var/lib/killbill # Used for sha1.yml
  webapp_path: /var/lib/tomcat/webapps/kaui/ROOT.war
EOF
sudo $(which kpm) install /var/lib/killbill/kpm.yml
sudo chown -R tomcat:tomcat /var/lib/tomcat/webapps

sudo tee /etc/tomcat/server.xml <<"EOF"
<?xml version='1.0' encoding='utf-8'?>
<Server port="8005" shutdown="SHUTDOWN">
  <Listener className="org.apache.catalina.startup.VersionLoggerListener" />
  <!-- APR library loader. Documentation at /docs/apr.html -->
  <Listener className="org.apache.catalina.core.AprLifecycleListener" SSLEngine="on" />
  <!-- Prevent memory leaks due to use of particular java/javax APIs-->
  <Listener className="org.apache.catalina.core.JreMemoryLeakPreventionListener" />
  <Listener className="org.apache.catalina.mbeans.GlobalResourcesLifecycleListener" />
  <Listener className="org.apache.catalina.core.ThreadLocalLeakPreventionListener" />

  <Service name="killbill">
    <Executor name="tomcatThreadPool"
              namePrefix="catalina-exec-"
              maxThreads="20"
              maxIdleTime="30000"
              minSpareThreads="4"
              prestartminSpareThreads="true" />

    <Connector executor="tomcatThreadPool"
               port="8080"
               address="0.0.0.0"
               protocol="HTTP/1.1"
               useIPVHosts="true"
               connectionTimeout="20000" />

    <Engine name="Catalina" defaultHost="localhost">
      <Host name="localhost"
            appBase="webapps/killbill"
            unpackWARs="true"
            autoDeploy="true">

        <Valve className="org.apache.catalina.valves.RemoteIpValve"
               protocolHeader="x-forwarded-proto"
               portHeader="x-forwarded-port" />
      </Host>
    </Engine>
  </Service>

  <Service name="kaui">
    <Executor name="tomcatThreadPool"
              namePrefix="catalina-exec-"
              maxThreads="20"
              maxIdleTime="30000"
              minSpareThreads="4"
              prestartminSpareThreads="true" />

    <Connector executor="tomcatThreadPool"
               port="8081"
               address="0.0.0.0"
               protocol="HTTP/1.1"
               useIPVHosts="true"
               connectionTimeout="20000" />

    <Engine name="Catalina" defaultHost="localhost">
      <Host name="localhost"
            appBase="webapps/kaui"
            unpackWARs="true"
            autoDeploy="true">

        <Valve className="org.apache.catalina.valves.RemoteIpValve"
               protocolHeader="x-forwarded-proto"
               portHeader="x-forwarded-port" />
      </Host>
    </Engine>
  </Service>
</Server>
EOF

sudo tee /var/lib/killbill/logback.xml <<"EOF"
<configuration scan="false">
  <!-- <appender name="CLOUD" class="com.google.cloud.logging.logback.LoggingAppender">
    <log>killbill.log</log>
    <flushLevel>WARN</flushLevel>
  </appender> -->
  <appender name="STDOUT" class="ch.qos.logback.core.ConsoleAppender">
    <encoder>
      <pattern>%-4relative [%thread] %-5level %logger{35} - %msg %n</pattern>
    </encoder>
  </appender>

  <!-- Silence verbose loggers -->
  <logger name="com.dmurph" level="OFF"/>
  <logger name="jdbc" level="OFF"/>
  <logger name="org.jooq.Constants" level="OFF"/>
  <logger name="org.eclipse" level="WARN"/>
  <logger name="org.killbill.commons.jdbi.guice.DBIProvider" level="OFF"/>

  <root level="INFO">
    <!-- <appender-ref ref="CLOUD" /> -->
    <appender-ref ref="STDOUT" />
  </root>
</configuration>
EOF


# THE BELOW FILES ARE ONLY A TEMPLATE
# THEY CONTAIN PASSWORDS AND ARE LOCATED
# IN killbill-secret S3 BUCKET
DB_PASSWORD=this-is-not-the-right-password

sudo tee /var/lib/killbill/killbill.properties <<"EOF"
org.killbill.billing.osgi.bundles.jruby.conf.dir=/var/lib/killbill/config
org.killbill.billing.osgi.dao.password=$DB_PASSWORD
org.killbill.billing.osgi.dao.url=jdbc:mysql://killbill.cluster-cobdzpzyvu7i.us-east-1.rds.amazonaws.com:3306/killbill
org.killbill.billing.osgi.dao.user=killbill
org.killbill.dao.password=$DB_PASSWORD
org.killbill.dao.url=jdbc:mysql://killbill.cluster-cobdzpzyvu7i.us-east-1.rds.amazonaws.com:3306/killbill
org.killbill.dao.user=killbill
org.killbill.notificationq.analytics.historyTableName=analytics_notifications_history
org.killbill.notificationq.analytics.tableName=analytics_notifications
org.killbill.osgi.bundle.install.dir=/var/lib/killbill/bundles
org.killbill.server.baseUrl=http://localhost:8080
org.killbill.server.test.mode=false
org.killbill.billing.plugin.kpm.kpmPath=/usr/local/bin/kpm
org.killbill.billing.plugin.kpm.bundlesPath=/var/lib/killbill/bundles
EOF

sudo tee /etc/tomcat/conf.d/killbill.conf <<"EOF"
JAVA_HOME=${JAVA_HOME-"/usr/lib/jvm/jre-1.8.0"}
CATALINA_OPTS="-server
               -showversion
               -XX:+PrintCommandLineFlags
               -XX:+UseCodeCacheFlushing
               -Xms512m
               -Xmx1024m
               -XX:+CMSClassUnloadingEnabled
               -XX:-OmitStackTraceInFastThrow
               -XX:+UseParNewGC
               -XX:+UseConcMarkSweepGC
               -XX:+CMSConcurrentMTEnabled
               -XX:+ScavengeBeforeFullGC
               -XX:+CMSScavengeBeforeRemark
               -XX:+CMSParallelRemarkEnabled
               -XX:+UseCMSInitiatingOccupancyOnly
               -XX:CMSInitiatingOccupancyFraction=50
               -XX:NewSize=100m
               -XX:MaxNewSize=256m
               -XX:SurvivorRatio=10
               -XX:+DisableExplicitGC"
CATALINA_OPTS="$CATALINA_OPTS
                      -Dkaui.url=http://127.0.0.1:8080
                      -Dkaui.db.url=jdbc:mysql://killbill.cluster-cobdzpzyvu7i.us-east-1.rds.amazonaws.com:3306/killbill
                      -Dkaui.db.password=$DB_PASSWORD
                      -Dkaui.db.username=killbill
                      -Dkaui.root_username=admin
                      -Dlogback.configurationFile=/var/lib/killbill/logback.xml
                      -Dorg.killbill.server.properties=file:///var/lib/killbill/killbill.properties
                      -Dcom.sun.xml.bind.v2.bytecode.ClassTailor.noOptimize=true
                      -Djava.security.egd=file:/dev/./urandom
                      -Djruby.compile.invokedynamic=false
                      -Dlog4jdbc.sqltiming.error.threshold=1000"
EOF

