
sudo amazon-linux-extras install tomcat8.5 -y

echo 'CLEARFLASK_ENVIRONMENT=PRODUCTION_AWS' | sudo tee -a /usr/share/tomcat/conf/tomcat.conf

sudo service tomcat restart

# upload cfg file 

# upload war file

 