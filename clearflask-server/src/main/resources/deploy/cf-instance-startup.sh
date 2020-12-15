#!/bin/bash
set -ex

aws s3 cp s3://clearflask-secret/clearflask-server-0.1.war /var/lib/tomcat/webapps/ROOT.war &
aws s3 cp s3://clearflask-secret/config-prod.cfg /opt/clearflask/config-prod.cfg &
aws s3 cp s3://clearflask-secret/clearflask-connect-0.1-connect.tar.gz /srv/clearflask-connect-0.1-connect.tar.gz &
aws s3 cp s3://clearflask-secret/connect.config.ts /opt/clearflask/connect.config.ts &
wait

chmod go-rwx /var/lib/tomcat/webapps/ROOT.war
chown tomcat:tomcat /var/lib/tomcat/webapps/ROOT.war

chmod go-rwx /srv/clearflask-connect-0.1-connect.tar.gz
chown connect:connect /srv/clearflask-connect-0.1-connect.tar.gz
tar -xzf /srv/clearflask-connect-0.1-connect.tar.gz -C /srv/clearflask-connect
chmod go-rwx -R /srv/clearflask-connect
chown connect:connect -R /srv/clearflask-connect

chmod go-rwx /opt/clearflask/config-prod.cfg
chown tomcat:tomcat /opt/clearflask/config-prod.cfg

chmod go-rwx /opt/clearflask/connect.config.ts
chown connect:connect /opt/clearflask/connect.config.ts

sudo service tomcat start
sudo service connect start
