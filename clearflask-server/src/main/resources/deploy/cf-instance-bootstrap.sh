#!/bin/bash
aws s3 cp s3://clearflask-secret/cf-instance-startup.sh ~/cf-instance-startup.sh
chmod 755 ~/cf-instance-startup.sh
~/cf-instance-startup.sh
