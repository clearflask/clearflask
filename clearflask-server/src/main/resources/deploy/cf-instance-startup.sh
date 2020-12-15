#!/bin/bash
set -ex

aws s3 cp s3://clearflask-secret/clearflask-server-0.1.war /var/lib/tomcat/webapps/ROOT.war &
aws s3 cp s3://clearflask-secret/config-prod.cfg /opt/clearflask/config-prod.cfg &
aws s3 cp s3://clearflask-secret/clearflask-connect-0.1-connect.tar.gz /srv/clearflask-connect-0.1-connect.tar.gz &
aws s3 cp s3://clearflask-secret/connect.config.ts /opt/clearflask/connect.config.ts &
wait

tar -xzf /srv/clearflask-connect-0.1-connect.tar.gz -C /srv/clearflask-connect
chown ec2-user:ec2-user -R /srv/clearflask-connect

chmod 600 /opt/clearflask/config-prod.cfg
chown tomcat:tomcat /opt/clearflask/config-prod.cfg

chmod 600 /opt/clearflask/connect.config.ts
chown tomcat:tomcat /opt/clearflask/connect.config.ts

sudo service tomcat start
sudo service connect start
