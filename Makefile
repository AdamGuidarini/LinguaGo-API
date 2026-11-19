.PHONY: build build-lt up down stop start logs dev-build dev

POD := linguago-api
APY_URL := http://localhost:2737
LT_URL  := http://localhost:5000

build: build-lt
	podman build -t linguago-api -f app/Containerfile app
	podman build -t linguago-apy -f apy/Containerfile apy

# Downloads every Argos model at build time; the first build is slow and
# needs tens of GB of disk. Later builds reuse the cached layer.
build-lt:
	podman build -t linguago-lt -f lt/Containerfile lt

up: build
	podman kube play --replace pod.yaml

down:
	-podman pod rm -f -t 0 $(POD)
	
dev-build:
	podman build -t linguago-api-dev -f app/Containerfile.dev app

dev: dev-build build-lt
	-podman pod rm -f -t 0 $(POD)
	podman pod create --name $(POD) -p 3000:3000
	podman run -d --pod $(POD) --name $(POD)-lt --memory 8g \
	  -v lt-data:/home/libretranslate/.local \
	  localhost/linguago-lt:latest
	podman run -d --pod $(POD) --name $(POD)-apy --memory 2g \
	  localhost/linguago-apy:latest
	podman run -d --pod $(POD) --name $(POD)-app \
	  -e APY_URL=$(APY_URL) \
	  -e LT_URL=$(LT_URL) \
		-e LC_ALL=C \
	  -v $(CURDIR)/app/src:/app/src:Z \
	  localhost/linguago-api-dev:latest

stop:
	-podman pod stop -t 0 $(POD)

start:
	podman pod start $(POD)

logs:
	podman pod logs -f $(POD)