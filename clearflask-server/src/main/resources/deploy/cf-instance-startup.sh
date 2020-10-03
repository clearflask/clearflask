#!/bin/bash
set -ex
aws s3 cp s3://clearflask-secret/clearflask-server-0.1.war /var/lib/tomcat/webapps/ROOT.war
mkdir -p /opt/clearflask
aws s3 cp s3://clearflask-secret/config-prod.cfg /opt/clearflask/config-prod.cfg
sudo service tomcat start
