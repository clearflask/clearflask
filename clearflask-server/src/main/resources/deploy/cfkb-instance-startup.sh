#!/bin/bash
set -ex

aws s3 cp s3://clearflask-secret/clearflask-server-0.1.war /var/lib/tomcat/webapps/150clearflask/ROOT.war &
aws s3 cp s3://clearflask-secret/config-prod.v2.cfg /opt/clearflask/config-prod.cfg &
aws s3 cp s3://clearflask-secret/clearflask-frontend-0.1-connect.tar.gz /srv/clearflask-frontend-0.1-connect.tar.gz &
aws s3 cp s3://clearflask-secret/connect.config.json /opt/clearflask/connect.config.json &
aws s3 cp s3://killbill-secret/killbill.v2.properties /var/lib/killbill/killbill.properties &
aws s3 cp s3://killbill-secret/killbill.conf /etc/tomcat/conf.d/killbill.conf &
wait

chmod go-rwx /var/lib/tomcat/webapps/150clearflask/ROOT.war
chown tomcat:tomcat /var/lib/tomcat/webapps/150clearflask/ROOT.war

chmod go-rwx /srv/clearflask-frontend-0.1-connect.tar.gz
chown connect:connect /srv/clearflask-frontend-0.1-connect.tar.gz
tar -xzf /srv/clearflask-frontend-0.1-connect.tar.gz -C /srv/clearflask-connect
chmod go-rwx -R /srv/clearflask-connect
chown connect:connect -R /srv/clearflask-connect

chmod go-rwx /opt/clearflask/config-prod.cfg
chown tomcat:tomcat /opt/clearflask/config-prod.cfg

chmod go-rwx /opt/clearflask/connect.config.json
chown connect:connect /opt/clearflask/connect.config.json

sudo service mariadb start
sudo service connect start
sudo service tomcat start
