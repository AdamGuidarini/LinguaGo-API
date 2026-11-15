.PHONY: build up down stop start logs dev-build dev

POD := linguago-api

build:
	podman build -t linguago-api -f app/Containerfile app
	podman build -t linguago-apy -f apy/Containerfile apy

up: build
	podman kube play --replace pod.yaml

down:
	-podman pod rm -f -t 0 $(POD)
	
dev-build:
	podman build -t linguago-api-dev -f app/Containerfile.dev app

dev: dev-build
	-podman pod rm -f -t 0 $(POD)
	podman pod create --name $(POD) -p 3000:3000
	podman run -d --pod $(POD) --name $(POD)-lt --memory 8g \
	  -v lt-data:/home/libretranslate/.local \
	  docker.io/libretranslate/libretranslate:latest
	podman run -d --pod $(POD) --name $(POD)-apy --memory 2g \
	  localhost/linguago-apy:latest
	podman run -d --pod $(POD) --name $(POD)-app \
	  -e APY_URL=http://localhost:2737 \
	  -e LT_URL=http://localhost:5000 \
	  -v $(CURDIR)/app/src:/app/src:Z \
	  localhost/linguago-api-dev:latest

stop:
	-podman pod stop -t 0 $(POD)

start:
	podman pod start $(POD)

logs:
	podman pod logs -f $(POD)