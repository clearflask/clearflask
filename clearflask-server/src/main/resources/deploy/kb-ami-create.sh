#!/bin/bash

DB_PASSWORD=CC26FFAE-DA49-45B2-B6E9-53F7E655E426
KAUI_API_SECRET=36ABD422-4401-41D5-AF8D-20ADE79478C0

set -ex
sudo yum install -y mc telnet
sudo yum install -y java-1.8.0-openjdk gcc ruby-devel
sudo amazon-linux-extras install -y ruby2.6 tomcat8.5
gem install io-console kpm
sudo mkdir -p /var/lib/killbill
sudo chown -R ec2-user:ec2-user /var/lib/killbill
cat > /var/lib/killbill/kpm.yml << "EOF"
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
kpm install /var/lib/killbill/kpm.yml

sudo tee /var/lib/killbill/killbill.properties << "EOF"
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

sudo tee /usr/share/tomcat/bin/setenv.sh << "EOF"
export CATALINA_OPTS="$CATALINA_OPTS
                      -Dkaui.api_key=clearflask
                      -Dkaui.api_secret=KAUI_API_SECRET
                      -Dkaui.url=http://127.0.0.1:8081
                      -Dkaui.db.url=jdbc:mysql://killbill.cluster-cobdzpzyvu7i.us-east-1.rds.amazonaws.com:3306/killbill
                      -Dkaui.db.password=$DB_PASSWORD
                      -Dkaui.db.username=killbill
                      -Dkaui.root_username=admin
                      -Dorg.killbill.server.properties=file:///var/lib/killbill/killbill.properties
                      -Dcom.sun.xml.bind.v2.bytecode.ClassTailor.noOptimize=true
                      -Djava.security.egd=file:/dev/./urandom
                      -Djruby.compile.invokedynamic=false
                      -Dlog4jdbc.sqltiming.error.threshold=1000"
EOF

sudo tee /etc/tomcat/server.xml << "EOF"
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
            appBase="killbill"
            unpackWARs="true"
            autoDeploy="false">

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
            appBase="kaui"
            unpackWARs="true"
            autoDeploy="false">

        <Valve className="org.apache.catalina.valves.RemoteIpValve"
               protocolHeader="x-forwarded-proto"
               portHeader="x-forwarded-port" />
      </Host>
    </Engine>
  </Service>
</Server>
EOF



# Below are experimental
gem install rails
npm install
#sudo amazon-linux-extras install -y tomcat8.5


gem install rubygems-update
update_rubygems
sudo /usr/local/bin/update_rubygems
gem update --system



### and let's try again...


### Let's start again

sudo yum install -y mc telnet
sudo yum install -y git
sudo amazon-linux-extras install -y ansible2

# https://github.com/killbill/killbill-cloud/tree/master/ansible
mkdir -p ~/ansible
cd ~/ansible
cat > ansible.cfg << "EOF"
[defaults]
roles_path = ~/.ansible/roles/
library = ~/.ansible/roles/killbill-cloud/ansible/library
EOF
cat > requirements.yml << "EOF"
- src: https://github.com/killbill/killbill-cloud
EOF
ansible-galaxy install -r requirements.yml

sudo yum install -y java
ansible-playbook killbill-cloud/ansible/roles/kpm

