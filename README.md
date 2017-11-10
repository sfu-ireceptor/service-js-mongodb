# service-js-mongodb

iReceptor API with JavaScript implementation for MongoDB repository.

## Configuration setup

Create and update environment file with appropriate settings. These
settings get passed to the docker container.

```
cp .env.defaults .env
```

## Development setup

Normally you do not build the docker image directly but instead use
docker-compose at the higher-level to compose all the services
together.
