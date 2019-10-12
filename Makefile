
help:
	@echo "\tmake run-dev-frontend\n\tmake build-no-test && make run-dev\n\tmake build && make publish-jar && make prod-rolling-restart"

build:
	mvn install

build-no-test:
	mvn install -DskipTests

build-server-no-test:
	cd clearflask-server && mvn install -DskipTests

run-dev:
	@$(MAKE) _run-dev -j 10
_run-dev: tomcat-run-dev nginx-run

run-dev-frontend:
	@$(MAKE) _run-dev-frontend -j 10
_run-dev-frontend: npm-run-dev-frontend nginx-run

npm-run-dev-frontend:
	cd clearflask-frontend && npm start

tomcat-run-dev:
	docker run --rm --name clearflask-webserver \
	-e CLEARFLASK_ENVIRONMENT=DEVELOPMENT_LOCAL \
	-p 80:8080 \
	-v `pwd`/clearflask-server/target/clearflask-server-0.1:/usr/local/tomcat/webapps/ROOT \
	-v `pwd`/clearflask-server/src/test/resources/logback-dev.xml:/usr/local/tomcat/webapps/ROOT/WEB-INF/classes/logback.xml \
	-v /var/run/docker.sock:/var/run/docker.sock \
	tomcat:9-jre10-slim

nginx-run: .nginx/key.pem .nginx/cert.pem .nginx/nginx.conf
	docker run --rm --name clearflask-webserver-ssl-reverse-proxy \
	-p 8300:8300 \
	-p 443:8443 \
	-v `pwd`/.nginx:/etc/nginx/conf.d \
	nginx

.nginx:
	mkdir -p .nginx
.nginx/%.pem: | .nginx
	./self-signed-tls  -c=US -s=California -l="San Francisco" -o="Smotana" -u="IT" -n="localhost" -e="admin@localhost" -p="./.nginx/" -v
	mv .nginx/localhost.crt .nginx/cert.pem;
	mv .nginx/localhost.key .nginx/key.pem;
.ONESHELL:
.nginx/nginx.conf: | .nginx
	cat <<- EOF > $@
	server {
	  listen 8443 ssl;
	  ssl_certificate /etc/nginx/conf.d/cert.pem;
	  ssl_certificate_key /etc/nginx/conf.d/key.pem;
	  location / {
	     proxy_pass http://host.docker.internal:80;
	     proxy_http_version 1.1;
	     proxy_set_header Upgrade $http_upgrade;
	     proxy_set_header Connection "upgrade";
	     proxy_read_timeout 86400;
	  }
	}
	server {
	  listen 8300 ssl;
	  ssl_certificate /etc/nginx/conf.d/cert.pem;
	  ssl_certificate_key /etc/nginx/conf.d/key.pem;
	  location / {
	     proxy_pass http://host.docker.internal:3000;
	  }
	}
	EOF

.PHONY: \
	build \
	build-no-test \
	run-dev \
	_run-dev \
	run-dev-frontend \
	_run-dev-frontend \
	npm-run-dev-frontend \
	tomcat-run-dev \
	nginx-run \
