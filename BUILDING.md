# Contributing

## Environment

Development has been done under Mac, Linux, and Windows (with WSL)

The following requirements are a minimum:

- Java 11
- Maven
- Makefile (for local and production deployment)
- Docker
- ffmpeg and ffprobe (For `babel-plugin-transform-media-imports`)
- openssl (For local deployment)

```shell
brew install maven ffmpeg make openssl
```

Please let us know if we missed anything.

## Building

Building is straightforward and can be done by running:

```shell
mvn clean install
```

## Development instance

Ensure Docker is running locally and the project is successfully compiled. Then run:

```shell
make local-up
```

Point your browser at https://localhost

It is recommended to add a `hosts` entry `127.0.0.1 localhost.com` and point your browser to https://localhost.com.
Although this should be solved in a better way, it helps with cookies, subdomain detection, and a few other quirks.
