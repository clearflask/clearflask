 
help:
	@echo "\tmake run-dev-frontend\n\tmake build-no-test && make run-dev\n\tmake build && make publish-jar && make prod-rolling-restart"

build:
	mvn install

build-no-test:
	mvn install -DskipTests

build-no-it:
	mvn install -DskipITs

build-server-no-test:
	cd clearflask-server && mvn install -DskipTests

clearflask-release/target/run-docker-compose-local/docker-compose.yml: clearflask-release/target/clearflask-release-0.1-docker-compose-local.tar.gz
	rm -fr clearflask-release/target/run-docker-compose-local
	mkdir clearflask-release/target/run-docker-compose-local
	tar -xzf clearflask-release/target/clearflask-release-0.1-docker-compose-local.tar.gz -C clearflask-release/target/run-docker-compose-local

# local-up local-down local-rm
local-%: clearflask-release/target/run-docker-compose-local/docker-compose.yml
	cd clearflask-release/target/run-docker-compose-local && docker-compose $*

killbill-sleep-%:
	curl -v \
         -u admin:password \
         -H "X-Killbill-ApiKey: bob" \
         -H 'X-Killbill-ApiSecret: lazar' \
         -H "Content-Type: application/json" \
         -H 'X-Killbill-CreatedBy: admin' \
         -X PUT \
         "http://127.0.0.1:8082/1.0/kb/test/clock?days=$*"

deploy:
	make deploy-server
	make deploy-connect
	make deploy-rotate-instances
	make deploy-cloudfront-invalidate-all

deploy-server: ./clearflask-server/target/clearflask-server-0.1.war
	aws s3 cp ./clearflask-server/target/clearflask-server-0.1.war s3://clearflask-secret/clearflask-server-0.1.war

deploy-logging: ./clearflask-logging/target/clearflask-logging-0.1-standalone.jar
	aws s3 cp ./clearflask-logging/target/clearflask-logging-0.1-standalone.jar s3://killbill-secret/clearflask-logging-0.1-standalone.jar

deploy-connect: ./clearflask-frontend/target/clearflask-frontend-0.1-connect.tar.gz
	aws s3 cp ./clearflask-frontend/target/clearflask-frontend-0.1-connect.tar.gz s3://clearflask-secret/clearflask-frontend-0.1-connect.tar.gz

deploy-static: ./clearflask-server/target/war-include/ROOT deploy-manifest deploy-files

deploy-rotate-instances:
	tools/instance-refresh-and-wait.sh clearflask-server

deploy-cloudfront-invalidate:
	aws cloudfront create-invalidation --distribution-id EQHBQLQZXVKCU --paths /index.html /service-worker.js /sw.js /asset-manifest.json

deploy-cloudfront-invalidate-all:
	aws cloudfront create-invalidation --distribution-id EQHBQLQZXVKCU --paths "/*"

.PHONY: \
	build \
	build-no-test \
	killbill-sleep-%
