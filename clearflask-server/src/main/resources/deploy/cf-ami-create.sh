#!/bin/bash
set -ex

# Run as ec2-user
[ "$(whoami)" == 'ec2-user' ]
mkdir -p /opt/clearflask

sudo yum install -y mc telnet

sudo amazon-linux-extras install -y tomcat8.5
ln -s /usr/share/tomcat ~/tomcat
sudo ln -s /usr/share/tomcat ~/tomcat
sudo tee /etc/tomcat/conf.d/jmx.conf <<"EOF"
CATALINA_OPTS="$CATALINA_OPTS
               -Dcom.sun.management.jmxremote
               -Dcom.sun.management.jmxremote.port=9050
               -Dcom.sun.management.jmxremote.ssl=false
               -Dcom.sun.management.jmxremote.ssl=false
               -Dcom.sun.management.jmxremote.authenticate=false
               -Dcom.sun.management.jmxremote.local.only=false
               -Djava.rmi.server.hostname=localhost
               -Dcom.sun.management.jmxremote.rmi.port=9051"
EOF
echo 'CLEARFLASK_ENVIRONMENT=PRODUCTION_AWS' | sudo tee -a /usr/share/tomcat/conf/tomcat.conf

curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.37.2/install.sh | bash
. ~/.nvm/nvm.sh
nvm install 14.15.1
nvm use --lts
nvm alias default
sudo mkdir /srv/clearflask-connect
sudo chown ec2-user:ec2-user /srv/clearflask-connect
ln -s /srv/clearflask-connect ~/connect
sudo tee /etc/systemd/system/connect.service <<"EOF"
[Unit]
Description=ClearFlask Connect
[Service]
ExecStart=/usr/bin/screen -dmL /var/log/clearflask-connect.log -S clearflask-connect /home/ec2-user/.nvm/nvm-exec npm start /srv/clearflask-connect/start.js
Restart=always
KillMode=control-group
User=ec2-user
Group=nobody
Environment=PATH=/usr/bin:/usr/local/bin
Environment=NODE_ENV=production
WorkingDirectory=/srv/clearflask-connect
[Install]
WantedBy=multi-user.target
EOF
sudo tee /etc/logrotate.d/connect <<"EOF"
/var/log/clearflask-connect.log {
    copytruncate
    weekly
    size 5m
    rotate 7
    compress
    missingok
    create 0644 ec2-user ec2-user
}
EOF
sudo systemctl daemon-reload
