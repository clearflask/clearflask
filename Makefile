 
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
	cp -n clearflask-release/target/run-docker-compose-local/server/config-local-template.cfg ./config-local.cfg \
		&& echo IMPORTANT: Created config-local.cfg please adjust settings for local deployment || true
	cp ./config-local.cfg clearflask-release/target/run-docker-compose-local/server/config-local.cfg
	cp -n clearflask-release/target/run-docker-compose-local/connect/connect.config.template.json ./connect.config.json \
		&& echo IMPORTANT: Created connect.config.json please adjust settings for local deployment || true
	cp ./connect.config.json clearflask-release/target/run-docker-compose-local/connect/connect.config.json

local-up: clearflask-release/target/run-docker-compose-local/docker-compose.yml
	docker-compose -f clearflask-release/target/run-docker-compose-local/docker-compose.yml up -d
	docker-compose -f clearflask-release/target/run-docker-compose-local/docker-compose.yml logs -f

local-down: clearflask-release/target/run-docker-compose-local/docker-compose.yml
	docker-compose -f clearflask-release/target/run-docker-compose-local/docker-compose.yml down -t 0
	docker-compose -f clearflask-release/target/run-docker-compose-local/docker-compose.yml rm

killbill-sleep-%:
	curl -v \
         -u admin:password \
         -H "X-Killbill-ApiKey: bob" \
         -H 'X-Killbill-ApiSecret: lazar' \
         -H "Content-Type: application/json" \
         -H 'X-Killbill-CreatedBy: admin' \
         -X PUT \
         "http://127.0.0.1:8082/1.0/kb/test/clock?days=$*"

get-project-version:
	$(eval PROJECT_VERSION := $(shell mvn -q -Dexec.executable=echo -Dexec.args='$${project.version}' --non-recursive exec:exec))

release-patch:
	mvn build-helper:parse-version -B release:prepare \
	    -DreleaseVersion=\$${parsedVersion.majorVersion}.\$${parsedVersion.minorVersion}.\$${parsedVersion.nextIncrementalVersion} \
	    -DdevelopmentVersion=\$${parsedVersion.majorVersion}.\$${parsedVersion.minorVersion}.\$${parsedVersion.nextIncrementalVersion}-SNAPSHOT \
        release:perform

release-minor:
	mvn build-helper:parse-version -B release:prepare \
	    -DreleaseVersion=\$${parsedVersion.majorVersion}.\$${parsedVersion.nextMinorVersion}.0 \
	    -DdevelopmentVersion=\$${parsedVersion.majorVersion}.\$${parsedVersion.nextMinorVersion}.0-SNAPSHOT \
        release:perform

release-major:
	mvn build-helper:parse-version -B release:prepare \
	    -DreleaseVersion=\$${parsedVersion.nextMajorVersion}.0.0 \
	    -DdevelopmentVersion=\$${parsedVersion.nextMajorVersion}.0.0-SNAPSHOT \
        release:perform

deploy:
	make deploy-server
	make deploy-connect
	make deploy-rotate-instances
	make deploy-cloudfront-invalidate-all

deploy-server: get-project-version
	aws s3 cp ./clearflask-server/target/clearflask-server-$(PROJECT_VERSION).war s3://clearflask-secret/clearflask-server-0.1.war

deploy-logging: get-project-version
	aws s3 cp ./clearflask-logging/target/clearflask-logging-$(PROJECT_VERSION)-standalone.jar s3://killbill-secret/clearflask-logging-0.1-standalone.jar

deploy-connect: get-project-version
	aws s3 cp ./clearflask-frontend/target/clearflask-frontend-$(PROJECT_VERSION)-connect.tar.gz s3://clearflask-secret/clearflask-frontend-0.1-connect.tar.gz

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
	killbill-sleep-% \
	get-project-version
