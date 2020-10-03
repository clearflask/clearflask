#!/bin/bash
set -ex
sudo aws s3 cp s3://killbill-secret/killbill.properties /var/lib/killbill/killbill.properties
sudo aws s3 cp s3://killbill-secret/killbill.conf /etc/tomcat/conf.d/killbill.conf
sudo service tomcat start
