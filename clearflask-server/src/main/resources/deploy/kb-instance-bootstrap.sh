#!/bin/bash
aws s3 cp s3://killbill-secret/kb-instance-startup.sh ~/kb-instance-startup.sh
chmod 755 ~/kb-instance-startup.sh
~/kb-instance-startup.sh
