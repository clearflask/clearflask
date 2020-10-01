#!/bin/bash
set -ex
sudo yum install -y mc telnet
sudo amazon-linux-extras install -y tomcat8.5
echo 'CLEARFLASK_ENVIRONMENT=PRODUCTION_AWS' | sudo tee -a /usr/share/tomcat/conf/tomcat.conf
