 
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

frontend-start:
	cd clearflask-frontend && node/npm start

connect-start:
	cd clearflask-frontend && node/npm run start:connect

clearflask-release/target/run-docker-compose-local/docker-compose.yml: get-project-version
	test -f clearflask-release/target/clearflask-release-$(PROJECT_VERSION)-docker-compose-local.tar.gz
	rm -fr clearflask-release/target/run-docker-compose-local
	mkdir clearflask-release/target/run-docker-compose-local
	tar -xzf clearflask-release/target/clearflask-release-$(PROJECT_VERSION)-docker-compose-local.tar.gz -C clearflask-release/target/run-docker-compose-local
	cp -n clearflask-release/target/run-docker-compose-local/server/config-local-template.cfg ./config-local.cfg \
		&& echo IMPORTANT: Created config-local.cfg please adjust settings for local deployment || true
	cp ./config-local.cfg clearflask-release/target/run-docker-compose-local/server/config-local.cfg
	cp -n clearflask-release/target/run-docker-compose-local/connect/connect.config.local-template.json ./connect.config-local.json \
		&& echo IMPORTANT: Created connect.config.json please adjust settings for local deployment || true
	cp ./connect.config-local.json clearflask-release/target/run-docker-compose-local/connect/connect.config.json
local-up: clearflask-release/target/run-docker-compose-local/docker-compose.yml
	docker-compose -f clearflask-release/target/run-docker-compose-local/docker-compose.yml up -d
	docker-compose -f clearflask-release/target/run-docker-compose-local/docker-compose.yml logs -f
local-down: clearflask-release/target/run-docker-compose-local/docker-compose.yml
	docker-compose -f clearflask-release/target/run-docker-compose-local/docker-compose.yml down -t 0
	docker-compose -f clearflask-release/target/run-docker-compose-local/docker-compose.yml rm

clearflask-release/target/run-docker-compose-selfhost/docker-compose.yml: get-project-version
	test -f clearflask-release/target/clearflask-release-$(PROJECT_VERSION)-docker-compose-self-host.tar.gz
	rm -fr clearflask-release/target/run-docker-compose-selfhost
	mkdir clearflask-release/target/run-docker-compose-selfhost
	tar -xzf clearflask-release/target/clearflask-release-$(PROJECT_VERSION)-docker-compose-self-host.tar.gz -C clearflask-release/target/run-docker-compose-selfhost
	sed -i'.original' 's,ghcr.io/clearflask,clearflask,g' clearflask-release/target/run-docker-compose-selfhost/docker-compose.yml
selfhost-up: clearflask-release/target/run-docker-compose-selfhost/docker-compose.yml
	docker-compose -f clearflask-release/target/run-docker-compose-selfhost/docker-compose.yml --profile with-deps up -d
	docker-compose -f clearflask-release/target/run-docker-compose-selfhost/docker-compose.yml --profile with-deps logs -f
selfhost-down: clearflask-release/target/run-docker-compose-selfhost/docker-compose.yml
	docker-compose -f clearflask-release/target/run-docker-compose-selfhost/docker-compose.yml --profile with-deps down -t 0
	docker-compose -f clearflask-release/target/run-docker-compose-selfhost/docker-compose.yml --profile with-deps rm

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
	mvn build-helper:parse-version \
	    -DreleaseVersion=\$${parsedVersion.majorVersion}.\$${parsedVersion.minorVersion}.\$${parsedVersion.nextIncrementalVersion} \
	    -DdevelopmentVersion=\$${parsedVersion.majorVersion}.\$${parsedVersion.minorVersion}.\$${parsedVersion.nextIncrementalVersion}-SNAPSHOT \
	    --batch-mode -Dresume=false release:prepare
	make release-perform
	make release-github-release

release-minor:
	mvn build-helper:parse-version \
	    -DreleaseVersion=\$${parsedVersion.majorVersion}.\$${parsedVersion.nextMinorVersion}.0 \
	    -DdevelopmentVersion=\$${parsedVersion.majorVersion}.\$${parsedVersion.nextMinorVersion}.0-SNAPSHOT \
	    --batch-mode -Dresume=false release:prepare
	make release-perform
	make release-github-release

release-major:
	mvn build-helper:parse-version \
	    -DreleaseVersion=\$${parsedVersion.nextMajorVersion}.0.0 \
	    -DdevelopmentVersion=\$${parsedVersion.nextMajorVersion}.0.0-SNAPSHOT \
	    --batch-mode -Dresume=false release:prepare
	make release-perform
	make release-github-release

release-perform:
	mvn -DskipTests -Darguments=-DskipTests --batch-mode release:perform

release-github-release:
	mvn build-helper:parse-version \
		-DgithubReleaseVersion=\$${parsedVersion.majorVersion}.\$${parsedVersion.minorVersion}.\$${parsedVersion.incrementalVersion} \
		--non-recursive github-release:release -Dgithub.draft=true

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
	aws autoscaling describe-auto-scaling-instances --no-paginate --output table --query "AutoScalingInstances[?AutoScalingGroupName=='clearflask-server']"

deploy-cloudfront-invalidate:
	aws cloudfront create-invalidation --distribution-id EQHBQLQZXVKCU --paths /index.html /service-worker.js /sw.js /asset-manifest.json

deploy-cloudfront-invalidate-all:
	aws cloudfront create-invalidation --distribution-id EQHBQLQZXVKCU --paths "/*"

autoscale-server-suspend:
	aws autoscaling suspend-processes --auto-scaling-group-name clearflask-server --scaling-processes Launch Terminate

autoscale-server-resume:
	aws autoscaling resume-processes --auto-scaling-group-name clearflask-server --scaling-processes Launch Terminate

autoscale-killbill-suspend:
	aws autoscaling suspend-processes --auto-scaling-group-name killbill-webserver --scaling-processes Launch Terminate

autoscale-killbill-resume:
	aws autoscaling resume-processes --auto-scaling-group-name killbill-webserver --scaling-processes Launch Terminate

list-instances-clearflask:
	aws ec2 describe-instances --no-paginate --output table \
		--instance-ids $(shell aws autoscaling describe-auto-scaling-instances --output text --query "AutoScalingInstances[?AutoScalingGroupName=='clearflask-server'].InstanceId") \
		--query "Reservations[].Instances[].{Host:PublicDnsName,Id:InstanceId,AZ:Placement.AvailabilityZone,Type:InstanceType,State:State.Name,Name:Tags[?Key=='Name']|[0].Value}"

list-instances-killbill:
	aws ec2 describe-instances --no-paginate --output table \
		--instance-ids $(shell aws autoscaling describe-auto-scaling-instances --output text --query "AutoScalingInstances[?AutoScalingGroupName=='killbill-webserver'].InstanceId") \
		--query "Reservations[].Instances[].{Host:PublicDnsName,Id:InstanceId,AZ:Placement.AvailabilityZone,Type:InstanceType,State:State.Name,Name:Tags[?Key=='Name']|[0].Value}"

.PHONY: \
	build \
	build-no-test \
	killbill-sleep-% \
	get-project-version
