
.EXPORT_ALL_VARIABLES:
AWS_PROFILE=clearflask

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
	cd clearflask-frontend && node/node_modules/pnpm/bin/pnpm.cjs start

connect-start:
	cd clearflask-frontend && node/node_modules/pnpm/bin/pnpm.cjs run start:connect

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
	docker-compose -f clearflask-release/target/run-docker-compose-local/docker-compose.yml --profile with-elasticsearch up -d
	docker-compose -f clearflask-release/target/run-docker-compose-local/docker-compose.yml --profile with-elasticsearch logs -f
local-down: clearflask-release/target/run-docker-compose-local/docker-compose.yml
	docker-compose -f clearflask-release/target/run-docker-compose-local/docker-compose.yml --profile with-elasticsearch down -t 0
	docker-compose -f clearflask-release/target/run-docker-compose-local/docker-compose.yml --profile with-elasticsearch rm
local-full-up: clearflask-release/target/run-docker-compose-local/docker-compose.yml
	docker-compose -f clearflask-release/target/run-docker-compose-local/docker-compose.yml --profile with-elasticsearch,with-kaui,with-kabana up -d
	docker-compose -f clearflask-release/target/run-docker-compose-local/docker-compose.yml --profile with-elasticsearch,with-kaui,with-kabana logs -f
local-full-down: clearflask-release/target/run-docker-compose-local/docker-compose.yml
	docker-compose -f clearflask-release/target/run-docker-compose-local/docker-compose.yml --profile with-elasticsearch,with-kaui,with-kabana down -t 0
	docker-compose -f clearflask-release/target/run-docker-compose-local/docker-compose.yml --profile with-elasticsearch,with-kaui,with-kabana rm

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
	    --batch-mode -Dresume=false -DskipITs -Darguments=-DskipITs release:prepare
	make release-perform
	make release-github-release

release-minor:
	mvn build-helper:parse-version \
	    -DreleaseVersion=\$${parsedVersion.majorVersion}.\$${parsedVersion.nextMinorVersion}.0 \
	    -DdevelopmentVersion=\$${parsedVersion.majorVersion}.\$${parsedVersion.nextMinorVersion}.0-SNAPSHOT \
	    --batch-mode -Dresume=false -DskipITs -Darguments=-DskipITs release:prepare
	make release-perform
	make release-github-release

release-major:
	mvn build-helper:parse-version \
	    -DreleaseVersion=\$${parsedVersion.nextMajorVersion}.0.0 \
	    -DdevelopmentVersion=\$${parsedVersion.nextMajorVersion}.0.0-SNAPSHOT \
	    --batch-mode -Dresume=false -DskipITs -Darguments=-DskipITs release:prepare
	make release-perform
	make release-github-release

release-perform:
	mvn -DskipTests -Darguments=-DskipTests --batch-mode release:perform

release-github-release:
	mvn build-helper:parse-version \
		-DgithubReleaseVersion=\$${parsedVersion.majorVersion}.\$${parsedVersion.minorVersion}.\$${parsedVersion.incrementalVersion} \
		-Dgithub.draft=true --non-recursive github-release:release

deploy-reload:
	make $(foreach server, \
		$(shell aws ec2 describe-instances --no-paginate --output text \
			--instance-ids $(shell aws ec2 describe-instances --filters 'Name=tag:Name,Values=cf-kb' --output text --query 'Reservations[*].Instances[*].InstanceId') \
			--query "Reservations[].Instances[].{Host:PublicDnsName}"), \
		deploy-reload-server-$(server) )

deploy-reload-server-%: get-project-version
	echo "Deploying to $*"
	scp ./clearflask-server/target/clearflask-server-$(PROJECT_VERSION).war $*:/home/ec2-user/clearflask-server-0.1.war
	ssh $* "sudo cp /home/ec2-user/clearflask-server-0.1.war /var/lib/tomcat/webapps/150clearflask/ROOT.war && sudo service tomcat start"

deploy-restart:
	make $(foreach server, \
		$(shell aws ec2 describe-instances --no-paginate --output text \
			--instance-ids $(shell aws ec2 describe-instances --filters 'Name=tag:Name,Values=cf-kb' --output text --query 'Reservations[*].Instances[*].InstanceId') \
			--query "Reservations[].Instances[].{Host:PublicDnsName}"), \
		deploy-restart-server-$(server) )

deploy-restart-server-%: get-project-version
	echo "Deploying to $*"
	scp ./clearflask-server/target/clearflask-server-$(PROJECT_VERSION).war $*:/home/ec2-user/clearflask-server-0.1.war
	ssh $* "sudo service tomcat stop && sudo rm -fr /var/lib/tomcat/webapps/150clearflask/ROOT.war /var/lib/tomcat/webapps/150clearflask/ROOT && sudo cp /home/ec2-user/clearflask-server-0.1.war /var/lib/tomcat/webapps/150clearflask/ROOT.war && sudo service tomcat start"

deploy-autoscale:
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

deploy-running-configs:
	make $(foreach server, \
		$(shell aws ec2 describe-instances --no-paginate --output text \
			--instance-ids $(shell aws autoscaling describe-auto-scaling-instances --output text --query "AutoScalingInstances[?AutoScalingGroupName=='clearflask-server'].InstanceId") \
			--query "Reservations[].Instances[].{Host:PublicDnsName}"), \
		deploy-running-config-$(server) )

deploy-running-config-%:
	echo "Syncing config to $*"
	ssh $* "sudo aws s3 cp s3://clearflask-secret/config-prod.cfg /opt/clearflask/config-prod.cfg && sudo aws s3 cp s3://clearflask-secret/connect.config.json /opt/clearflask/connect.config.json && sudo service connect restart"

deploy-running-servers:
	make $(foreach server, \
		$(shell aws ec2 describe-instances --no-paginate --output text \
			--instance-ids $(shell aws autoscaling describe-auto-scaling-instances --output text --query "AutoScalingInstances[?AutoScalingGroupName=='clearflask-server'].InstanceId") \
			--query "Reservations[].Instances[].{Host:PublicDnsName}"), \
		deploy-running-server-$(server) )

deploy-running-server-%: get-project-version
	echo "Deploying to $*"
	scp ./clearflask-server/target/clearflask-server-$(PROJECT_VERSION).war $*:/home/ec2-user/clearflask-server-0.1.war
	ssh $* "sudo service tomcat stop && sudo rm -fr /var/lib/tomcat/webapps/ROOT.war /var/lib/tomcat/webapps/ROOT && sudo cp /home/ec2-user/clearflask-server-0.1.war /var/lib/tomcat/webapps/ROOT.war && sudo service tomcat start"


deploy-running-connects:
	make $(foreach server, \
		$(shell aws ec2 describe-instances --no-paginate --output text \
			--instance-ids $(shell aws autoscaling describe-auto-scaling-instances --output text --query "AutoScalingInstances[?AutoScalingGroupName=='clearflask-server'].InstanceId") \
			--query "Reservations[].Instances[].{Host:PublicDnsName}"), \
		deploy-running-connect-$(server) )

deploy-running-connect-%: get-project-version
	echo "Deploying to $*"
	scp ./clearflask-frontend/target/clearflask-frontend-$(PROJECT_VERSION)-connect.tar.gz $*:/home/ec2-user/clearflask-frontend-0.1-connect.tar.gz
	ssh $* "sudo service connect stop && sudo rm -fr /srv/clearflask-connect/* && sudo tar -xzf /home/ec2-user/clearflask-frontend-0.1-connect.tar.gz -C /srv/clearflask-connect && sudo chmod go-rwx -R /srv/clearflask-connect && sudo chown connect:connect -R /srv/clearflask-connect && sudo service connect start"

deploy-cloudfront-invalidate:
	aws cloudfront create-invalidation --distribution-id EQHBQLQZXVKCU --paths /index.html /service-worker.js /sw.js /asset-manifest.json

deploy-cloudfront-invalidate-all:
	aws cloudfront create-invalidation --distribution-id EQHBQLQZXVKCU --paths "/*"

deploy-emergency:
	make deploy-running-configs
	make deploy-running-servers
	make deploy-running-connects
	make deploy-cloudfront-invalidate-all
	make deploy-server
	make deploy-connect

autoscale-server-suspend:
	aws autoscaling suspend-processes --auto-scaling-group-name clearflask-server --scaling-processes Launch Terminate

autoscale-server-resume:
	aws autoscaling resume-processes --auto-scaling-group-name clearflask-server --scaling-processes Launch Terminate

autoscale-killbill-suspend:
	aws autoscaling suspend-processes --auto-scaling-group-name killbill-webserver --scaling-processes Launch Terminate

autoscale-killbill-resume:
	aws autoscaling resume-processes --auto-scaling-group-name killbill-webserver --scaling-processes Launch Terminate

list-instances-cf-kb:
	aws ec2 describe-instances --no-paginate --output table \
		--instance-ids $(shell aws ec2 describe-instances --filters 'Name=tag:Name,Values=cf-kb' --output text --query 'Reservations[*].Instances[*].InstanceId') \
		--query "Reservations[].Instances[].{Host:PublicDnsName,Id:InstanceId,AZ:Placement.AvailabilityZone,Type:InstanceType,State:State.Name,Name:Tags[?Key=='Name']|[0].Value}"

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
