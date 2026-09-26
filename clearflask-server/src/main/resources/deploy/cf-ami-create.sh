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
               -Dlog4j2.formatMsgNoLookups=true
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
nvm use 14.15.1
nvm alias default
EOF
sudo tee /etc/systemd/system/connect.service <<"EOF"
[Unit]
Description=ClearFlask Connect
After=syslog.target
After=network.target
[Service]
Environment=ENV=production
Environment=NODE_ENV=production
Environment=NODE_VERSION=14.15.1
Environment=PATH=/usr/bin:/usr/local/bin
ExecStart=/home/connect/.nvm/nvm-exec ./start.sh
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

# BEGIN connect-watchdog
# Connect answers 80/443 directly, so if it stops responding the site is down
# even though systemd still sees a running process. Probe it from outside the
# process every 30s and restart it after three consecutive failures. A stopped
# service is left alone: that is a deploy in progress, not a hang.
sudo tee /usr/local/bin/connect-watchdog <<"EOF"
#!/bin/bash
state=/run/connect-watchdog.failures
code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 -H 'Host: clearflask.com' http://127.0.0.1:44380/robots.txt)
if [[ "$code" =~ ^(200|301|302)$ ]]; then
  echo 0 > "$state"
  exit 0
fi
failures=$(( $(cat "$state" 2>/dev/null || echo 0) + 1 ))
echo "$failures" > "$state"
logger -t connect-watchdog "connect not answering (http=$code), $failures consecutive failure(s)"
if (( failures >= 3 )) && systemctl is-active --quiet connect; then
  logger -t connect-watchdog "restarting connect.service"
  echo 0 > "$state"
  systemctl restart connect
fi
EOF
sudo chmod 755 /usr/local/bin/connect-watchdog
sudo tee /etc/systemd/system/connect-watchdog.service <<"EOF"
[Unit]
Description=Restart ClearFlask Connect when it stops answering

[Service]
Type=oneshot
ExecStart=/usr/local/bin/connect-watchdog
EOF
sudo tee /etc/systemd/system/connect-watchdog.timer <<"EOF"
[Unit]
Description=Probe ClearFlask Connect every 30s

[Timer]
OnBootSec=2min
OnUnitActiveSec=30s
AccuracySec=5s

[Install]
WantedBy=timers.target
EOF
sudo systemctl daemon-reload
sudo systemctl enable --now connect-watchdog.timer
# END connect-watchdog

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
