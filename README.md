# LinguaGo API
A simple API for LinguaGo, managing its translators all in one place.

## Requirements

- [Podman](https://podman.io) 4.x or newer
- GNU Make (optional; the raw commands are listed below)
- Several GB of free disk space and enough RAM for LibreTranslate's language models (see [Resource usage](#resource-usage))
- On macOS/Windows: `podman machine init && podman machine start`

## Quick start

```bash
make up
```

This builds both local images and starts the pod with `podman kube play`. Without make:

```bash
podman build -t translate-app -f app/Containerfile app
podman build -t translate-apy -f apy/Containerfile apy
podman kube play --replace pod.yaml
```

The first start is slow: the APY image installs all Apertium packages, and LibreTranslate downloads its models into the `lt-data` volume. Watch progress with `podman logs -f linguago-api-lt`.

## Commands

| Command | Description |
|---|---|
| `make build` | Build the `app` and `apy` images |
| `make up` | Build and (re)start the pod |
| `make down` | Stop and remove the pod (keeps the `lt-data` volume) |
| `make logs` | Follow logs from all containers |
| `podman pod restart linguago-api` | Restart without rebuilding |

After changing code, run `make up` again. `--replace` swaps in the new pod.

## Configuration

The app reads these environment variables (set in `pod.yaml`):

| Variable | Default in pod | Description |
|---|---|---|
| `APY_URL` | `http://localhost:2737` | Apertium APY base URL |
| `LT_URL` | `http://localhost:5000` | LibreTranslate base URL |

Memory limits for each container are set in `pod.yaml` under `resources.limits.memory`.

## API

> TODO: document the endpoints once the routing layer is finalized.

## Verifying the setup

```bash
podman pod ps               # pod should be Running
podman ps --pod             # three containers listed
podman pod logs -f linguago-api    # logs from all containers
curl http://localhost:3000/
```

APY and LibreTranslate are not published to the host, so test them from inside the pod:

```bash
podman exec linguago-api-app node -e "fetch('http://localhost:2737/listPairs').then(r=>r.text()).then(console.log)"
podman exec linguago-api-app node -e "fetch('http://localhost:5000/languages').then(r=>r.text()).then(console.log)"
```

## Resource usage

- **Apertium:** pairs are small rule-based dictionaries and use little RAM until a translation runs.
- **LibreTranslate:** each language is a neural model. Loading all of them needs several GB of disk and a lot of RAM, and the first start downloads everything. Models are cached in the `lt-data` volume, so later starts are faster.
- To reduce memory use, load fewer languages by adding `args: ["--load-only", "en,es,fr"]` to the `lt` container in `pod.yaml`.

## Troubleshooting

- **`lt` exits with code 137:** it was OOM-killed. Raise its memory limit in `pod.yaml` or load fewer languages.
- **Permission errors on `lt-data` (rootless Podman):** check the container's UID with `podman exec linguago-api-lt id`, then fix ownership with `podman unshare chown -R <uid>:<gid> $(podman volume inspect lt-data -f '{{.Mountpoint}}')`.
- **`apy` fails to start:** check `podman logs linguago-api-apy`. Usually a wrong `apertium-apy` flag or the package missing from the repo.
- **Image not found on `kube play`:** confirm the builds succeeded and the names match with `podman images`.
- **Port 3000 in use:** change `hostPort` in `pod.yaml`.

## Cleanup

```bash
make down                  # remove the pod
podman volume rm lt-data   # also delete cached LibreTranslate models
```