# Rocket.Chat.App-Hue

Interact with your Hue lights.

# Deprecated

This project will no longer be maintained by me, I have retired my Rocket.Chat server in favor of a Matrix Synapse server.

## Configuration

> Create a Hue application at https://developers.meethue.com

Other Settings include:

### Client Id
Client Id of your created Hue Application.
### Client Secret
Client Secret of your created Hue Application.
### Client AppId
App Id of your created Hue Application.
### Client DeviceId
Device Id of your created Hue Application. Can be anything.
### Client DeviceName
Device Name of your created Hue Application. Can be anything.

## Docker
A Dockerfile and docker-compose are provided.

Build the docker image and run it to deploy to your server:
`docker build -t rocketchatapp_hue . && docker run -it --rm -e URL=YOUR_SERVER -e USERNAME=YOUR_USERNAME -e PASSWORD=YOUR_PASSWORD rocketchatapp_hue`

Build the docker image and run docker-compose to deploy to your server:
`docker build -t rocketchatapp_hue . && docker-compose run --rm -e URL=YOUR_SERVER -e USERNAME=YOUR_USERNAME -e PASSWORD=YOUR_PASSWORD rocketchatapp_hue`
