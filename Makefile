
help:
	@echo "\tmake run-dev-frontend\n\tmake build-no-test && make run-dev\n\tmake build && make publish-jar && make prod-rolling-restart"

build:
	mvn install

build-no-test:
	mvn install -DskipTests

build-server-no-test:
	cd clearflask-server && mvn install -DskipTests

run-dev:
	@$(MAKE) _run-dev -j 50
_run-dev: killbill-run kaui-run tomcat-run-dev nginx-run dynamo-run ses-run elastic-run kibana-run

run-dev-frontend:
	@$(MAKE) _run-dev-frontend -j 50
_run-dev-frontend: npm-run-dev-frontend nginx-run

run-it-services:
	@$(MAKE) _run-dev -j 50
_run-dev: elastic-run killbill-run

npm-run-dev-frontend:
	cd clearflask-frontend && node/node_modules/npm/bin/npm-cli.js start

tomcat-run-dev:
	rm -fr `pwd`/clearflask-server/target/ROOT
	unzip `pwd`/clearflask-server/target/clearflask-server-0.1.war -d `pwd`/clearflask-server/target/ROOT
	docker run --rm --name clearflask-webserver \
	-e CLEARFLASK_ENVIRONMENT=DEVELOPMENT_LOCAL \
	-e CATALINA_OPTS="-Dcom.sun.management.jmxremote \
		-Dcom.sun.management.jmxremote.authenticate=false \
		-Dcom.sun.management.jmxremote.ssl=false \
		-Dcom.sun.management.jmxremote.port=9950 \
		-Dcom.sun.management.jmxremote.rmi.port=9951 \
		-Djava.rmi.server.hostname=0.0.0.0" \
	-p 80:8080 \
	-p 9950:9950 \
	-p 9951:9951 \
	-v `pwd -P`/clearflask-server/target/ROOT:/usr/local/tomcat/webapps/ROOT \
	-v `pwd -P`/clearflask-server/src/test/resources/logback-dev.xml:/usr/local/tomcat/webapps/ROOT/WEB-INF/classes/logback.xml \
	-v `pwd -P`/clearflask-server/src/test/resources/logging-dev.properties:/usr/local/tomcat/conf/logging.properties \
	tomcat:8.5-jdk11-openjdk-slim

elastic-run:
	docker run --rm --name clearflask-elastic \
	-p 9200:9200 \
	-m 4g \
	-e "ES_JAVA_OPTS=-Xms2g -Xmx2g" \
	-e "discovery.type=single-node" \
	docker.elastic.co/elasticsearch/elasticsearch:7.4.2

kibana-run:
	docker run --rm --name clearflask-kibana \
	-p 5601:5601 \
	-e "ELASTICSEARCH_URL=http://host.docker.internal:9200" \
	-e "ELASTICSEARCH_HOSTS=http://host.docker.internal:9200" \
	docker.elastic.co/kibana/kibana:7.4.2

dynamo-run:
	docker run --rm --name clearflask-dynamo \
	-p 7000:8000 \
	amazon/dynamodb-local

ses-run:
	docker run --rm --name clearflask-ses \
	-p 9001:9001 \
	jdelibas/aws-ses-local

killbill-run:
	@$(MAKE) _killbill-run -j 50
_killbill-run: killbill-engine-run killbill-db-run

killbill-engine-run:
	docker run --rm --name clearflask-killbill-engine \
	-e KILLBILL_DAO_URL=jdbc:mysql://host.docker.internal:8306/killbill \
	-e KILLBILL_DAO_USER=root \
	-e KILLBILL_DAO_PASSWORD=killbill \
	-e KILLBILL_SERVER_TEST_MODE=true \
	-e KILLBILL_NOTIFICATIONQ_ANALYTICS_TABLE_NAME=analytics_notifications \
	-e KILLBILL_NOTIFICATIONQ_ANALYTICS_HISTORY_TABLE_NAME=analytics_notifications_history \
	-v $(shell pwd -P)/clearflask-server/src/test/resources/killbill-setenv2.sh:/var/lib/tomcat/bin/setenv2.sh \
	-v $(shell pwd -P)/clearflask-server/src/test/resources/logging-dev.properties:/var/lib/tomcat/conf/logging.properties \
	-v $(shell pwd -P)/clearflask-server/src/test/resources/logback-killbill-engine.xml:/var/lib/killbill/logback.xml \
	-v $(shell pwd -P)/clearflask-server/src/test/resources/killbill.sh:/var/lib/killbill/killbill.sh \
	-v $(shell pwd -P)/clearflask-server/target/kb-plugins:/var/lib/killbill/bundles/autoload \
	-p 8082:8080 \
	killbill/killbill:0.22.10

kaui-run:
	docker run --rm --name clearflask-killbill-kaui \
	-e KAUI_CONFIG_DAO_URL=jdbc:mysql://host.docker.internal:8306/kaui \
	-e KAUI_CONFIG_DAO_USER=root \
	-e KAUI_CONFIG_DAO_PASSWORD=killbill \
	-e KAUI_KILLBILL_URL=http://host.docker.internal:8082 \
	-p 8081:8080 \
	killbill/kaui:2.0.5

killbill-db-run:
	docker run --rm --name clearflask-killbill-db \
	-e MYSQL_ROOT_PASSWORD=killbill \
	-p 8306:3306 \
	-v $(shell pwd -P)/clearflask-server/target/kb-ddl/plugins.sql:/docker-entrypoint-initdb.d/050-plugins.sql \
	killbill/mariadb:0.22

killbill-sleep-%:
	curl -v \
         -u admin:password \
         -H "X-Killbill-ApiKey: bob" \
         -H 'X-Killbill-ApiSecret: lazar' \
         -H "Content-Type: application/json" \
         -H 'X-Killbill-CreatedBy: admin' \
         -X PUT \
         "http://127.0.0.1:8082/1.0/kb/test/clock?days=$*"

nginx-run: .nginx/key.pem .nginx/cert.pem .nginx/nginx.conf
	docker run --rm --name clearflask-webserver-ssl-reverse-proxy \
	-p 8300:8300 \
	-p 443:8443 \
	-p 8083:8082 \
	-v $(shell pwd -P)/.nginx:/etc/nginx/conf.d \
	nginx

deploy-war: ./clearflask-server/target/clearflask-server-0.1.war
	aws s3 cp ./clearflask-server/target/clearflask-server-0.1.war s3://clearflask-secret/clearflask-server-0.1.war

deploy-static: ./clearflask-server/target/war-include/ROOT
	aws s3 sync ./clearflask-server/target/war-include/ROOT/ s3://clearflask-static --cache-control "max-age=604800" --exclude index.html --exclude service-worker.js --exclude sw.js --exclude asset-manifest.json
	aws s3 sync ./clearflask-server/target/war-include/ROOT/ s3://clearflask-static --cache-control "max-age=600" --exclude "*" --include index.html --include service-worker.js --include sw.js --include asset-manifest.json

deploy-rotate-instances:
	aws autoscaling start-instance-refresh --auto-scaling-group-name clearflask-server

deploy-cloudfront-invalidate:
	aws cloudfront create-invalidation --distribution-id EQHBQLQZXVKCU --paths /index.html /service-worker.js /sw.js /asset-manifest.json

deploy-cloudfront-invalidate-all:
	aws cloudfront create-invalidation --distribution-id EQHBQLQZXVKCU --paths "/*"

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
	killbill-sleep-%
