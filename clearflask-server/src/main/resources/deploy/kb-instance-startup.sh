#!/bin/bash
set -ex
aws s3 cp s3://killbill-secret/killbill.properties /var/lib/killbill/killbill.properties
aws s3 cp s3://killbill-secret/killbill.conf /etc/tomcat/conf.d/killbill.conf
sudo service tomcat start
