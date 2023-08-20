#!/bin/bash
set -ex

# Run as ec2-user
[ "$(whoami)" == 'ec2-user' ]

if false; then # If working off of existing ClearFlask AMI, skip these as they're already done

# Clearflask
sudo mkdir -p /opt/clearflask

sudo yum install -y mc telnet
sudo yum install -y java-11-amazon-corretto

sudo amazon-linux-extras install -y tomcat8.5
ln -s /usr/share/tomcat ~/tomcat
sudo ln -s /usr/share/tomcat ~/tomcat
sudo tee /etc/tomcat/conf.d/jmx.conf <<"EOF"
CATALINA_OPTS="$CATALINA_OPTS
               -Dcom.sun.management.jmxremote
               -Dcom.sun.management.jmxremote.port=9050
               -Dcom.sun.management.jmxremote.ssl=false
               -Dlog4j2.formatMsgNoLookups=true
               -Dcom.sun.management.jmxremote.authenticate=false
               -Dcom.sun.management.jmxremote.local.only=false
               -Djava.rmi.server.hostname=localhost
               -Dcom.sun.management.jmxremote.rmi.port=9051"
EOF
echo 'CLEARFLASK_ENVIRONMENT=PRODUCTION_AWS' | sudo tee -a /usr/share/tomcat/conf/tomcat.conf

sudo mkdir -p /srv/clearflask-connect
sudo adduser connect
sudo chown connect:connect /srv/clearflask-connect
ln -s /srv/clearflask-connect ~/connect
sudo su - connect <<'EOF'
set -ex
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.37.2/install.sh | bash
. ~/.nvm/nvm.sh
nvm install 14.15.1
nvm use 14.15.1
nvm alias default
EOF
sudo tee /etc/systemd/system/connect.service <<"EOF"
[Unit]
Description=ClearFlask Connect
After=syslog.target
After=network.target
[Service]
Environment=ENV=production
Environment=NODE_ENV=production
Environment=NODE_VERSION=14.15.1
Environment=PATH=/usr/bin:/usr/local/bin
ExecStart=/home/connect/.nvm/nvm-exec ./start.sh
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=Connect
Type=simple
Restart=always
KillMode=control-group
User=connect
Group=connect
WorkingDirectory=/srv/clearflask-connect
[Install]
WantedBy=multi-user.target
EOF
sudo systemctl daemon-reload
sudo systemctl disable connect
sudo tee /etc/rsyslog.d/00-connect.conf <<"EOF"
if $programname == 'Connect' then /var/log/clearflask-connect.log
& ~
EOF
sudo service rsyslog restart
sudo tee /etc/logrotate.d/connect <<"EOF"
/var/log/clearflask-connect.log {
    copytruncate
    weekly
    size 5m
    rotate 7
    compress
    missingok
    create 0644 ec2-user ec2-user
}
EOF

fi # If working off of existing ClearFlask AMI, skip until here

sudo mkdir -p /var/lib/tomcat/webapps/300clearflask
sudo chown -R tomcat:tomcat /var/lib/tomcat/webapps

# Killbill

sudo amazon-linux-extras install -y ruby2.6 tomcat8.5
sudo yum install -y gcc ruby-devel
sudo gem update --system 2.7.5 --install-dir=/usr/share/gems --bindir /usr/local/bin
sudo gem install io-console
sudo gem install kpm
sudo mkdir -p /var/lib/killbill
sudo chown -R ec2-user:ec2-user /var/lib/killbill
cat > /var/lib/killbill/kpm.yml <<"EOF"
killbill:
  version: 0.22.20
  plugins:
    java:
      - name: analytics
        version: 7.0.8
      - name: stripe
        version: 7.0.4
  webapp_path: /var/lib/tomcat/webapps/100killbill/ROOT.war
  plugins_dir: /var/lib/killbill/bundles
kaui:
  version: 2.0.8
  plugins_dir: /var/lib/killbill # Used for sha1.yml
  webapp_path: /var/lib/tomcat/webapps/200kaui/ROOT.war
EOF
sudo kpm install /var/lib/killbill/kpm.yml
sudo mkdir -p /var/lib/killbill/bundles/plugins/ruby

sudo unzip -od /var/lib/tomcat/webapps/100killbill/ROOT /var/lib/tomcat/webapps/100killbill/ROOT.war
sudo unzip -od /var/lib/tomcat/webapps/200kaui/ROOT /var/lib/tomcat/webapps/200kaui/ROOT.war

sudo aws s3 cp s3://killbill-secret/clearflask-logging-0.1-standalone.jar /var/lib/killbill/clearflask-logging-0.1-standalone.jar
sudo cp /var/lib/killbill/clearflask-logging-0.1-standalone.jar /usr/share/tomcat/webapps/200kaui/ROOT/WEB-INF/lib
sudo mv /var/lib/killbill/clearflask-logging-0.1-standalone.jar /usr/share/tomcat/webapps/100killbill/ROOT/WEB-INF/lib

sudo tee /usr/share/tomcat/webapps/200kaui/ROOT/WEB-INF/classes/logback.xml <<"EOF"
<?xml version="1.0" encoding="UTF-8"?>
<configuration debug="true" scan="true" scanPeriod="60 seconds">
    <jmxConfigurator />
    <contextName>Kaui</contextName>

    <appender name="STDOUT" class="ch.qos.logback.core.ConsoleAppender">
        <encoder>
            <pattern>%d{HH:mm:ss.SSS} %-5level %X{rails.actionName} [%thread] %msg</pattern>
        </encoder>
    </appender>

    <appender name="MAIN" class="ch.qos.logback.core.rolling.RollingFileAppender">
        <file>${LOGS_DIR:-./logs}/kaui.log</file>
        <rollingPolicy class="ch.qos.logback.core.rolling.TimeBasedRollingPolicy">
            <!-- rollover daily -->
            <fileNamePattern>${LOGS_DIR:-./logs}/kaui-%d{yyyy-MM-dd}.%i.log.gz</fileNamePattern>
            <maxHistory>3</maxHistory>
            <cleanHistoryOnStart>true</cleanHistoryOnStart>
            <timeBasedFileNamingAndTriggeringPolicy class="ch.qos.logback.core.rolling.SizeAndTimeBasedFNATP">
                <!-- or whenever the file size reaches 10MB -->
                <maxFileSize>10MB</maxFileSize>
            </timeBasedFileNamingAndTriggeringPolicy>
        </rollingPolicy>
        <encoder>
            <pattern>%msg</pattern>
        </encoder>
    </appender>

    <appender name="EMAIL_SES" class="com.smotana.clearflask.logging.EmailSesAppender">
        <To>ops@clearflask.com</To>
        <From>no-reply@clearflask.com</From>
        <Subject>[ClearFlask Logs] [Kaui] ${HOSTNAME}</Subject>
        <evaluator class="com.smotana.clearflask.logging.RateLimitBasedEvaluator">
            <param name="OncePerSeconds" value="600"/>
        </evaluator>
        <layout class="com.smotana.clearflask.logging.HTMLLayout">
            <pattern>%d{yyyy-MM-dd HH:mm:ss.SSS,UTC}%level%logger%thread%maskedMsg%n</pattern>
        </layout>
    </appender>
    <appender name="ASYNC_EMAIL_SES" class="ch.qos.logback.classic.AsyncAppender">
        <param name="IncludeCallerData" value="true"/>
        <appender-ref ref="EMAIL_SES"/>
        <filter class="ch.qos.logback.classic.filter.ThresholdFilter">
            <level>WARN</level>
        </filter>
    </appender>

    <logger name="com.dmurph" level="OFF"/>
    <logger name="jdbc" level="OFF"/>
    <logger name="org.jooq.Constants" level="OFF"/>
    <logger name="org.eclipse" level="WARN"/>
    <logger name="org.killbill.commons.jdbi.guice.DBIProvider" level="OFF"/>

    <root level="INFO">
        <appender-ref ref="MAIN"/>
        <appender-ref ref="ASYNC_EMAIL_SES"/>
        <!-- <appender-ref ref="STDOUT"/>-->
    </root>
</configuration>
EOF

sudo tee /usr/share/tomcat/webapps/100killbill/ROOT/WEB-INF/classes/logback.xml <<"EOF"
<?xml version="1.0" encoding="UTF-8"?>
<configuration debug="true" scan="true" scanPeriod="60 seconds">
    <jmxConfigurator/>
    <contextName>KillBill</contextName>

    <conversionRule conversionWord="maskedMsg"
                    converterClass="org.killbill.billing.server.log.obfuscators.ObfuscatorConverter"/>

    <appender name="STDOUT" class="ch.qos.logback.core.ConsoleAppender">
        <encoder>
            <pattern>%d{HH:mm:ss.SSS} %-5level %X{rails.actionName} [%thread] %maskedMsg%n</pattern>
        </encoder>
    </appender>

    <appender name="MAIN" class="ch.qos.logback.core.rolling.RollingFileAppender">
        <file>${LOGS_DIR:-./logs}/killbill.log</file>
        <rollingPolicy class="ch.qos.logback.core.rolling.TimeBasedRollingPolicy">
            <!-- rollover daily -->
            <fileNamePattern>${LOGS_DIR:-./logs}/killbill-%d{yyyy-MM-dd}.%i.log.gz</fileNamePattern>
            <maxHistory>3</maxHistory>
            <cleanHistoryOnStart>true</cleanHistoryOnStart>
            <timeBasedFileNamingAndTriggeringPolicy class="ch.qos.logback.core.rolling.SizeAndTimeBasedFNATP">
                <!-- or whenever the file size reaches 100MB -->
                <maxFileSize>100MB</maxFileSize>
            </timeBasedFileNamingAndTriggeringPolicy>
        </rollingPolicy>
        <encoder>
            <pattern>%d{HH:mm:ss.SSS} %-5level %X{rails.actionName} [%thread] %maskedMsg%n</pattern>
        </encoder>
    </appender>

    <!-- JDBC appenders -->
    <appender name="SIFT-jdbc-sqlonly" class="ch.qos.logback.classic.sift.SiftingAppender">
        <discriminator class="org.killbill.billing.server.log.ThreadNameBasedDiscriminator"/>
        <sift>
            <appender name="jdbc-sqlonly-${threadName}" class="ch.qos.logback.core.rolling.RollingFileAppender">
                <file>${LOGS_DIR:-./logs}/jdbc-sqlonly.${threadName}.out</file>
                <rollingPolicy class="ch.qos.logback.core.rolling.TimeBasedRollingPolicy">
                    <!-- rollover daily -->
                    <fileNamePattern>${LOGS_DIR:-./logs}/jdbc-sqlonly-%d{yyyy-MM-dd}.%i.${threadName}.out.gz
                    </fileNamePattern>
                    <maxHistory>3</maxHistory>
                    <cleanHistoryOnStart>true</cleanHistoryOnStart>
                    <timeBasedFileNamingAndTriggeringPolicy class="ch.qos.logback.core.rolling.SizeAndTimeBasedFNATP">
                        <!-- or whenever the file size reaches 100MB -->
                        <maxFileSize>100MB</maxFileSize>
                    </timeBasedFileNamingAndTriggeringPolicy>
                </rollingPolicy>
                <encoder>
                  <pattern>%d{HH:mm:ss.SSS} %-5level %X{rails.actionName} [%thread] %maskedMsg%n</pattern>
                </encoder>
            </appender>
        </sift>
    </appender>
    <appender name="SIFT-jdbc-sqltiming" class="ch.qos.logback.classic.sift.SiftingAppender">
        <discriminator class="org.killbill.billing.server.log.ThreadNameBasedDiscriminator"/>
        <sift>
            <appender name="jdbc-sqltiming-${threadName}" class="ch.qos.logback.core.rolling.RollingFileAppender">
                <file>${LOGS_DIR:-./logs}/jdbc-sqltiming.${threadName}.out</file>
                <rollingPolicy class="ch.qos.logback.core.rolling.TimeBasedRollingPolicy">
                    <!-- rollover daily -->
                    <fileNamePattern>${LOGS_DIR:-./logs}/jdbc-sqltiming-%d{yyyy-MM-dd}.%i.${threadName}.out.gz
                    </fileNamePattern>
                    <maxHistory>3</maxHistory>
                    <cleanHistoryOnStart>true</cleanHistoryOnStart>
                    <timeBasedFileNamingAndTriggeringPolicy class="ch.qos.logback.core.rolling.SizeAndTimeBasedFNATP">
                        <!-- or whenever the file size reaches 100MB -->
                        <maxFileSize>100MB</maxFileSize>
                    </timeBasedFileNamingAndTriggeringPolicy>
                </rollingPolicy>
                <encoder>
                  <pattern>%d{HH:mm:ss.SSS} %-5level %X{rails.actionName} [%thread] %maskedMsg%n</pattern>
                </encoder>
            </appender>
        </sift>
    </appender>
    <appender name="SIFT-jdbc-audit" class="ch.qos.logback.classic.sift.SiftingAppender">
        <discriminator class="org.killbill.billing.server.log.ThreadNameBasedDiscriminator"/>
        <sift>
            <appender name="jdbc-audit-${threadName}" class="ch.qos.logback.core.rolling.RollingFileAppender">
                <file>${LOGS_DIR:-./logs}/jdbc-audit.${threadName}.out</file>
                <rollingPolicy class="ch.qos.logback.core.rolling.TimeBasedRollingPolicy">
                    <!-- rollover daily -->
                    <fileNamePattern>${LOGS_DIR:-./logs}/jdbc-audit-%d{yyyy-MM-dd}.%i.${threadName}.out.gz
                    </fileNamePattern>
                    <maxHistory>3</maxHistory>
                    <cleanHistoryOnStart>true</cleanHistoryOnStart>
                    <timeBasedFileNamingAndTriggeringPolicy class="ch.qos.logback.core.rolling.SizeAndTimeBasedFNATP">
                        <!-- or whenever the file size reaches 100MB -->
                        <maxFileSize>100MB</maxFileSize>
                    </timeBasedFileNamingAndTriggeringPolicy>
                </rollingPolicy>
                <encoder>
                  <pattern>%d{HH:mm:ss.SSS} %-5level %X{rails.actionName} [%thread] %maskedMsg%n</pattern>
                </encoder>
            </appender>
        </sift>
    </appender>
    <appender name="SIFT-jdbc-resultset" class="ch.qos.logback.classic.sift.SiftingAppender">
        <discriminator class="org.killbill.billing.server.log.ThreadNameBasedDiscriminator"/>
        <sift>
            <appender name="jdbc-resultset-${threadName}" class="ch.qos.logback.core.rolling.RollingFileAppender">
                <file>${LOGS_DIR:-./logs}/jdbc-resultset.${threadName}.out</file>
                <rollingPolicy class="ch.qos.logback.core.rolling.TimeBasedRollingPolicy">
                    <!-- rollover daily -->
                    <fileNamePattern>${LOGS_DIR:-./logs}/jdbc-resultset-%d{yyyy-MM-dd}.%i.${threadName}.out.gz
                    </fileNamePattern>
                    <maxHistory>3</maxHistory>
                    <cleanHistoryOnStart>true</cleanHistoryOnStart>
                    <timeBasedFileNamingAndTriggeringPolicy class="ch.qos.logback.core.rolling.SizeAndTimeBasedFNATP">
                        <!-- or whenever the file size reaches 100MB -->
                        <maxFileSize>100MB</maxFileSize>
                    </timeBasedFileNamingAndTriggeringPolicy>
                </rollingPolicy>
                <encoder>
                  <pattern>%d{HH:mm:ss.SSS} %-5level %X{rails.actionName} [%thread] %maskedMsg%n</pattern>
                </encoder>
            </appender>
        </sift>
    </appender>
    <appender name="SIFT-jdbc-resultsettable" class="ch.qos.logback.classic.sift.SiftingAppender">
        <discriminator class="org.killbill.billing.server.log.ThreadNameBasedDiscriminator"/>
        <sift>
            <appender name="jdbc-resultsettable-${threadName}" class="ch.qos.logback.core.rolling.RollingFileAppender">
                <file>${LOGS_DIR:-./logs}/jdbc-resultsettable.${threadName}.out</file>
                <rollingPolicy class="ch.qos.logback.core.rolling.TimeBasedRollingPolicy">
                    <!-- rollover daily -->
                    <fileNamePattern>${LOGS_DIR:-./logs}/jdbc-resultsettable-%d{yyyy-MM-dd}.%i.${threadName}.out.gz
                    </fileNamePattern>
                    <maxHistory>3</maxHistory>
                    <cleanHistoryOnStart>true</cleanHistoryOnStart>
                    <timeBasedFileNamingAndTriggeringPolicy class="ch.qos.logback.core.rolling.SizeAndTimeBasedFNATP">
                        <!-- or whenever the file size reaches 100MB -->
                        <maxFileSize>100MB</maxFileSize>
                    </timeBasedFileNamingAndTriggeringPolicy>
                </rollingPolicy>
                <encoder>
                  <pattern>%d{HH:mm:ss.SSS} %-5level %X{rails.actionName} [%thread] %maskedMsg%n</pattern>
                </encoder>
            </appender>
        </sift>
    </appender>
    <appender name="SIFT-jdbc-connection" class="ch.qos.logback.classic.sift.SiftingAppender">
        <discriminator class="org.killbill.billing.server.log.ThreadNameBasedDiscriminator"/>
        <sift>
            <appender name="jdbc-connection-${threadName}" class="ch.qos.logback.core.rolling.RollingFileAppender">
                <file>${LOGS_DIR:-./logs}/jdbc-connection.${threadName}.out</file>
                <rollingPolicy class="ch.qos.logback.core.rolling.TimeBasedRollingPolicy">
                    <!-- rollover daily -->
                    <fileNamePattern>${LOGS_DIR:-./logs}/jdbc-connection-%d{yyyy-MM-dd}.%i.${threadName}.out.gz
                    </fileNamePattern>
                    <maxHistory>3</maxHistory>
                    <cleanHistoryOnStart>true</cleanHistoryOnStart>
                    <timeBasedFileNamingAndTriggeringPolicy class="ch.qos.logback.core.rolling.SizeAndTimeBasedFNATP">
                        <!-- or whenever the file size reaches 100MB -->
                        <maxFileSize>100MB</maxFileSize>
                    </timeBasedFileNamingAndTriggeringPolicy>
                </rollingPolicy>
                <encoder>
                  <pattern>%d{HH:mm:ss.SSS} %-5level %X{rails.actionName} [%thread] %maskedMsg%n</pattern>
                </encoder>
            </appender>
        </sift>
    </appender>

    <appender name="EMAIL_SES" class="com.smotana.clearflask.logging.EmailSesAppender">
        <To>ops@clearflask.com</To>
        <From>no-reply@clearflask.com</From>
        <Subject>[ClearFlask Logs] [KillBill] ${HOSTNAME}</Subject>
        <evaluator class="com.smotana.clearflask.logging.RateLimitBasedEvaluator">
            <param name="OncePerSeconds" value="600"/>
        </evaluator>
        <layout class="com.smotana.clearflask.logging.HTMLLayout">
            <pattern>%d{yyyy-MM-dd HH:mm:ss.SSS,UTC}%level%logger%thread%maskedMsg%n</pattern>
        </layout>
    </appender>
    <appender name="ASYNC_EMAIL_SES" class="ch.qos.logback.classic.AsyncAppender">
        <param name="IncludeCallerData" value="true"/>
        <appender-ref ref="EMAIL_SES"/>
        <filter class="ch.qos.logback.classic.filter.ThresholdFilter">
            <level>WARN</level>
        </filter>
    </appender>

    <!-- Logs only SQL. SQL executed within a prepared statement is automatically shown with its bind arguments replaced with the data bound at that position, for greatly increased readability. -->
    <logger name="jdbc.sqlonly" level="OFF" additivity="false">
        <appender-ref ref="SIFT-jdbc-sqlonly"/>
    </logger>
    <!-- Logs the SQL, post-execution, including timing statistics on how long the SQL took to execute. -->
    <logger name="jdbc.sqltiming" level="OFF" additivity="false">
        <appender-ref ref="SIFT-jdbc-sqltiming"/>
    </logger>
    <!-- Logs ALL JDBC calls except for ResultSets. This is a very voluminous output, and is not normally needed unless tracking down a specific JDBC problem. -->
    <logger name="jdbc.audit" level="OFF" additivity="false">
        <appender-ref ref="SIFT-jdbc-audit"/>
    </logger>
    <!-- Even more voluminous, because all calls to ResultSet objects are logged. -->
    <logger name="jdbc.resultset" level="OFF" additivity="false">
        <appender-ref ref="SIFT-jdbc-resultset"/>
    </logger>
    <!-- Log the jdbc results as a table. Level debug will fill in unread values in the result set. -->
    <logger name="jdbc.resultsettable" level="OFF" additivity="false">
        <appender-ref ref="SIFT-jdbc-resultsettable"/>
    </logger>
    <!-- Logs connection open and close events as well as dumping all open connection numbers. This is very useful for hunting down connection leak problems. -->
    <logger name="jdbc.connection" level="OFF" additivity="false">
        <appender-ref ref="SIFT-jdbc-connection"/>
    </logger>

    <!-- See https://github.com/jOOQ/jOOQ/issues/4019 -->
    <logger name="org.jooq.Constants" level="OFF"/>

    <!-- Silence verbose loggers in DEBUG mode -->
    <logger name="com.dmurph" level="OFF"/>
    <logger name="org.eclipse" level="INFO"/>
    <logger name="org.killbill.billing.server.updatechecker" level="INFO"/>
    <!-- Useful loggers for debugging -->
    <logger name="org.killbill.billing.jaxrs.resources" level="INFO"/>
    <logger name="org.killbill.notificationq" level="INFO"/>
    <logger name="org.killbill.queue" level="INFO"/>
    <!-- Suppress "Putting host in rotation" -->
    <logger name="org.killbill.billing.server.healthchecks.KillbillHealthcheck" level="ERROR"/>

    <root level="INFO">
        <appender-ref ref="MAIN"/>
        <appender-ref ref="ASYNC_EMAIL_SES"/>
        <!-- <appender-ref ref="STDOUT"/>-->
    </root>
</configuration>
EOF

sudo chown -R tomcat:tomcat /var/lib/tomcat/webapps

# THE BELOW FILES HAVE SECRETS
# When you modify them, replace the secrets and upload to s3://killbill-secret

sudo aws s3 cp s3://killbill-secret/killbill.properties /var/lib/killbill/killbill.properties
#sudo tee /var/lib/killbill/killbill.properties <<"EOF"
#org.killbill.billing.osgi.bundles.jruby.conf.dir=/var/lib/killbill/config
#org.killbill.billing.osgi.dao.password=$DB_PASSWORD
#org.killbill.billing.osgi.dao.url=jdbc:mysql:://localhost:3306/killbill
#org.killbill.billing.osgi.dao.user=killbill
#org.killbill.dao.password=$DB_PASSWORD
#org.killbill.dao.url=jdbc:mysql://localhost:3306/killbill
#org.killbill.dao.user=killbill
#org.killbill.notificationq.analytics.historyTableName=analytics_notifications_history
#org.killbill.notificationq.analytics.tableName=analytics_notifications
#org.killbill.osgi.bundle.install.dir=/var/lib/killbill/bundles
#org.killbill.server.baseUrl=http://localhost:8080
#org.killbill.server.test.mode=false
#org.killbill.billing.plugin.kpm.kpmPath=/usr/local/bin/kpm
#org.killbill.billing.plugin.kpm.bundlesPath=/var/lib/killbill/bundles
#org.killbill.dao.healthCheckExpected99thPercentile=0ms
#EOF

sudo aws s3 cp s3://killbill-secret/killbill.conf /etc/tomcat/conf.d/killbill.conf
#sudo tee /etc/tomcat/conf.d/killbill.conf <<"EOF"
#JAVA_HOME=${JAVA_HOME-"/usr/lib/jvm/jre-1.8.0"}
#CATALINA_OPTS="-server
#               -showversion
#               -XX:+PrintCommandLineFlags
#               -XX:+UseCodeCacheFlushing
#               -Xms512m
#               -Xmx1024m
#               -Dcom.sun.management.jmxremote
#               -Dcom.sun.management.jmxremote.port=9050
#               -Dcom.sun.management.jmxremote.ssl=false
#               -Dlog4j2.formatMsgNoLookups=true
#               -Dcom.sun.management.jmxremote.authenticate=false
#               -Dcom.sun.management.jmxremote.local.only=false
#               -Djava.rmi.server.hostname=localhost
#               -Dcom.sun.management.jmxremote.rmi.port=9051
#               -XX:-OmitStackTraceInFastThrow
#               -XX:NewSize=100m
#               -XX:MaxNewSize=256m
#               -XX:SurvivorRatio=10
#               -XX:+DisableExplicitGC"
#CATALINA_OPTS="$CATALINA_OPTS
#                      -Dkaui.url=http://127.0.0.1:8082
#                      -Dkaui.db.url=jdbc:mysql://localhost:3306/killbill
#                      -Dkaui.db.password=$DB_PASSWORD
#                      -Dkaui.db.username=killbill
#                      -Dkaui.db.adapter=jdbcmysql
#                      -Dkaui.root_username=admin
#                      -Dorg.killbill.server.properties=file:///var/lib/killbill/killbill.properties
#                      -Dcom.sun.xml.bind.v2.bytecode.ClassTailor.noOptimize=true
#                      -Djava.security.egd=file:/dev/./urandom
#                      -Djruby.compile.invokedynamic=false
#                      -Dlog4jdbc.sqltiming.error.threshold=1000"
#EOF





# Combined ClearFlask and Killbill Tomcat configuration

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
               port="8081"
               address="0.0.0.0"
               protocol="HTTP/1.1"
               useIPVHosts="true"
               connectionTimeout="20000" />

    <Engine name="Catalina" defaultHost="localhost">
      <Host name="localhost"
            appBase="webapps/100killbill"
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
               port="8082"
               address="0.0.0.0"
               protocol="HTTP/1.1"
               useIPVHosts="true"
               connectionTimeout="20000" />

    <Engine name="Catalina" defaultHost="localhost">
      <Host name="localhost"
            appBase="webapps/200kaui"
            unpackWARs="true"
            autoDeploy="true">

        <Valve className="org.apache.catalina.valves.RemoteIpValve"
               protocolHeader="x-forwarded-proto"
               portHeader="x-forwarded-port" />
      </Host>
    </Engine>
  </Service>

  <Service name="clearflask">
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
            appBase="webapps/300clearflask"
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




# MariaDB

sudo amazon-linux-extras enable mariadb10.5
sudo yum install -y mariadb

