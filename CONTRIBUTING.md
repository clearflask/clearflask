# Contributing

## Architecture

Look at our [architecture page](ARCHITECTURE.md) to better understand the layout of this project.

## Environment

Development has been done under Mac, Linux, and Windows (with WSL)

The following requirements are a minimum:

- Java 11
- Maven
- Makefile (for local and production deployment)
- Docker (for local deployment)

## Building

Building is straightforward and can be done by running:

```shell
mvn install
```

## Local instance

Ensure Docker is running locally and the project is successfully compiled. Then run:

```shell
make run-dev
```

Point your browser at https://localhost

It is recommended to add a `hosts` entry `127.0.0.1 localhost.com` and point your browser to https://localhost.com.
Although this should be solved in a better way, it helps with cookies, subdomain detection, and a few other quirks.

## Code style

Java:

- Generally following the [Google Java Style Guide](https://google.github.io/styleguide/javaguide.html)
- **IntelliJ** Recommended: Code style formatting is in `.idea` folder

JS/TS:

- **VisualCode** recommended: code formatting and properties are defined in `.vscode` folder

## Testing

For **Java** code, it is generally expected a test is written for each change.

For **JS/TS**, we are yet to establish a proper test framework. A proposal would be welcome.
