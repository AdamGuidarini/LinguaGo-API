.PHONY: build up down stop start logs dev-build dev

build:
	podman build -t linguago-api -f app/Containerfile app
	podman build -t linguago-apy -f apy/Containerfile apy

up: build
	podman kube play --replace pod.yaml

down:
	-podman pod rm -f -t 0 linguago-api

dev-build:
	podman build -t linguago-api-dev -f app/Containerfile.dev app

dev: dev-build
	podman kube play --replace pod.dev.yaml

stop:
	-podman pod stop -t 0 linguago-api

start:
	podman pod start linguago-api

logs:
	podman pod logs -f linguago-api