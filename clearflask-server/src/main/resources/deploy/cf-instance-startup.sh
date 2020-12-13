#!/bin/bash
set -ex
aws s3 cp s3://clearflask-secret/clearflask-server-0.1.war /var/lib/tomcat/webapps/ROOT.war
aws s3 cp s3://clearflask-secret/clearflask-connect-0.1-connect.tar.gz /srv/clearflask-connect-0.1-connect.tar.gz
tar -xzf /srv/clearflask-connect-0.1-connect.tar.gz -C /srv/clearflask-connect
chown ec2-user:ec2-user -R /srv/clearflask-connect
mkdir -p /opt/clearflask
aws s3 cp s3://clearflask-secret/config-prod.cfg /opt/clearflask/config-prod.cfg
sudo service tomcat start
