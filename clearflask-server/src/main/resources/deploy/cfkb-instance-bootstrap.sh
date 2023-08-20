#!/bin/bash
aws s3 cp s3://clearflask-secret/cfkb-instance-startup.sh ~/cfkb-instance-startup.sh
chmod 755 ~/cfkb-instance-startup.sh
~/cfkb-instance-startup.sh
