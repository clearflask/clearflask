#!/bin/bash
set -ex

# Run as ec2-user
[ "$(whoami)" == 'ec2-user' ]
sudo mkdir -p /opt/clearflask

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

sudo mkdir -p /srv/clearflask-connect
sudo adduser connect
sudo chown connect:connect /srv/clearflask-connect
ln -s /srv/clearflask-connect ~/connect
sudo su - connect <<'EOF'
set -ex
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.37.2/install.sh | bash
. ~/.nvm/nvm.sh
nvm install 14.15.1
nvm use --lts
nvm alias default
EOF
sudo tee /etc/systemd/system/connect.service <<"EOF"
[Unit]
Description=ClearFlask Connect
After=syslog.target
After=network.target
[Service]
Environment=NODE_ENV=production
Environment=NODE_VERSION=14.15.1
Environment=PATH=/usr/bin:/usr/local/bin
ExecStart=/home/connect/.nvm/nvm-exec npm start --prefix /srv/clearflask-connect
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=Connect
Type=simple
Restart=always
KillMode=control-group
User=connect
Group=connect
WorkingDirectory=/srv/clearflask-connect
[Install]
WantedBy=multi-user.target
EOF
sudo systemctl daemon-reload
sudo systemctl disable connect
sudo tee /etc/rsyslog.d/00-connect.conf <<"EOF"
if $programname == 'Connect' then /var/log/clearflask-connect.log
& ~
EOF
sudo service rsyslog restart
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
