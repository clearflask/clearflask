# RELEASE

This guide is for making a release of ClearFlask to create Docker images and Maven artifacts.

## Prerequisites

You need credentials for uploading to GitHub Packages repository for both Docker and Maven.

In GitHub personal settings create a PAT with `read:packages`, `write:packages`, and `delete:packages` scopes.

For Docker registry, run this command and input your PAT as password:

```shell
docker login ghcr.io -u USERNAME
```

Then fill out the following with your PAT and put it under `~/.m2/settings.xml`:

```xml

<settings xmlns="http://maven.apache.org/SETTINGS/1.0.0"
          xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
          xsi:schemaLocation="http://maven.apache.org/SETTINGS/1.0.0
                          https://maven.apache.org/xsd/settings-1.0.0.xsd">

    <servers>
        <server>
            <id>github</id>
            <username>matusfaro</username>
            <password>~~INSERT PAT TOKEN~~</password>
        </server>
    </servers>

    <profiles>
        <profile>
            <id>github</id>
            <repositories>
                <repository>
                    <id>central</id>
                    <url>https://repo1.maven.org/maven2</url>
                </repository>
                <repository>
                    <id>github</id>
                    <url>https://maven.pkg.github.com/OWNER/*</url>
                    <snapshots>
                        <enabled>true</enabled>
                    </snapshots>
                </repository>
            </repositories>
        </profile>
    </profiles>

    <activeProfiles>
        <activeProfile>github</activeProfile>
    </activeProfiles>

</settings>
```

## Perform release

To perform a release, decide which version to increment and run the following Makefile target:

```shell
make release-<patch|minor|major>
```

### Continuing a failed release

If the `perform:prepare` Maven target failed, you can re-run the whole release again from beginning.

If the `perform:release` Maven target failed, you can resume it by:

```shell
cd target/checkout
mvn deploy -P docker-images-push -rf clearflask-<module-to-resume>
```