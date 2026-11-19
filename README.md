# LinguaGo API

A simple API for LinguaGo, managing its translators all in one place.

It runs as a single Podman pod with three containers:

| Container | Purpose | Port (pod-local) |
|---|---|---|
| `app` | Node.js + Express API, written in TypeScript (the only public entry point) | 3000 (published) |
| `apy` | [Apertium](https://apertium.org) via APY, with all language pairs | 2737 |
| `lt` | [LibreTranslate](https://libretranslate.com) (official image + all models baked in) | 5000 |

All containers share `localhost` inside the pod. Only port 3000 is published to the host, so APY and LibreTranslate are not reachable from outside.

## Repository layout

```
LinguaGo-Server/
├── app/
│   ├── Containerfile        # production image (compiles with tsc)
│   ├── Containerfile.dev    # dev image (tsc --watch + node --watch)
│   ├── package.json
│   ├── yarn.lock
│   ├── tsconfig.json
│   └── src/
├── apy/
│   └── Containerfile
├── lt/
│   └── Containerfile        # official LibreTranslate image + all Argos models baked in
├── pod.yaml                 # production-style pod
├── pod.dev.yaml             # dev pod (bind-mounts app/src)
├── Makefile
└── README.md
```

## Requirements

- [Podman](https://podman.io) 4.x or newer
- GNU Make (optional; the raw commands are listed below)
- Several GB of free disk space and enough RAM for LibreTranslate's language models (see [Resource usage](#resource-usage))
- Yarn on the host, only if you want to add or update dependencies outside a container (`sudo dnf install yarnpkg` on Fedora)
- On macOS/Windows: `podman machine init && podman machine start`

## Quick start

```bash
make dev    # development: hot reload
make up     # production-style build
```

Both use the same pod name (`linguago-api`) and both publish port 3000, so only one can run at a time. Starting one replaces the other.

The first `make build-lt` is slow: it downloads every Argos Translate model into the `linguago-lt` image (tens of GB of disk, so run it once and let Podman cache the layer). After that, pod starts are fast and no model is ever downloaded at runtime.

## Development workflow

```bash
make dev
```

This builds the dev image and starts the pod from `pod.dev.yaml`. In the `app` container:

- `app/src` on your host is bind-mounted into the container, so edits show up immediately.
- `tsc --watch` recompiles into `dist/` (inside the container) on every save.
- `node --watch` restarts the server whenever `dist/` changes.

It uses the same compiler, `tsconfig.json`, and entry point (`dist/index.js`) as production. Only the watching differs.

Follow the app's output with:

```bash
podman logs -f linguago-api-app
```

You should see tsc's "Watching for file changes" followed by "Server running at http://localhost:3000".

Run `make dev` again when you:

- add or change a dependency (`node_modules` is baked into the dev image),
- change `app/Containerfile.dev`, `tsconfig.json`, or `pod.dev.yaml`.

Type errors appear in the tsc output in the logs. Run `yarn typecheck` in `app/` to check types on the host without emitting files.

## Production-style build

```bash
make up
```

This builds both images and starts the pod from `pod.yaml`. The app image is a multi-stage build: one stage runs `tsc`, and the final stage contains only production dependencies and the compiled `dist/`. There are no bind mounts and no file watching, so rebuild with `make up` after any change.

Without make:

```bash
podman build -t linguago-lt -f lt/Containerfile lt   # slow on first run: downloads all models
podman build -t linguago-api -f app/Containerfile app
podman build -t linguago-apy -f apy/Containerfile apy
podman kube play --replace pod.yaml
```

## Commands

| Command | Description |
|---|---|
| `make dev` | Build the dev image and start the dev pod (hot reload) |
| `make up` | Build both images and start the production-style pod |
| `make build` | Build the `app`, `apy`, and `lt` images |
| `make build-lt` | Build only the `lt` image (downloads all LibreTranslate models; slow on first run) |
| `make down` | Remove the pod immediately (keeps the `lt-data` volume) |
| `make stop` | Stop the pod without removing it |
| `make start` | Start a stopped pod (reuses existing containers) |
| `make logs` | Follow logs from all containers |
| `podman pod restart linguago-api` | Restart without rebuilding |

`make start` reuses the old containers, so it won't pick up changes to `pod.yaml` or `pod.dev.yaml`. Use `make down` followed by `make dev` or `make up` for that.

To stop every pod on the machine, not just this project's:

```bash
podman pod stop -a -t 0
```

## Dependencies

Add packages from `app/` so `package.json` and `yarn.lock` stay in sync (the images install with `--frozen-lockfile`):

```bash
cd app
yarn add <package>        # runtime dependency
yarn add -D <package>     # dev dependency
```

Then run `make dev` or `make up` to rebuild with the new packages.

## Configuration

The app reads these environment variables (set in the pod files):

| Variable | Default in pod | Description |
|---|---|---|
| `APY_URL` | `http://localhost:2737` | Apertium APY base URL |
| `LT_URL` | `http://localhost:5000` | LibreTranslate base URL |
| `PORT` | `3000` | Port the Express server listens on |

Memory limits for each container are set in `pod.yaml` under `resources.limits.memory`.

## API

| Endpoint | Description |
|---|---|
| `GET /` | Service name and status |
| `GET /health` | Health check |
| `GET /translators` | List available translation backends (`apertium`, `libretranslate`) |
| `POST /translate` | Unified translation — routes to the backend named in `translator` |
| `GET /apertium/languages` | Apertium languages and pairs |
| `POST /apertium/translate` | Translate via Apertium |
| `GET /libretranslate/languages` | LibreTranslate languages |
| `POST /libretranslate/translate` | Translate via LibreTranslate |

### Unified translation

`POST /translate` accepts a JSON body with non-empty `source`, `target`, `text`
strings and a `translator` field naming the backend:

```bash
curl -X POST http://localhost:3000/translate \
  -H 'Content-Type: application/json' \
  -d '{"translator":"libretranslate","source":"auto","target":"es","text":"Hello world"}'
```

`source` may be `"auto"` for LibreTranslate to detect the language.
Language pairs depend on the chosen backend. Invalid request fields return
HTTP 400; an upstream translation failure returns HTTP 502 (504 on timeout).

The per-backend endpoints (`/apertium/translate`, `/libretranslate/translate`)
take the same body minus the `translator` field.

## Verifying the setup

```bash
podman pod ps                      # pod should be Running
podman ps --pod                    # three containers listed
podman pod logs -f linguago-api    # logs from all containers
curl -i http://localhost:3000/health
```

APY and LibreTranslate are not published to the host, so test them from inside the pod:

```bash
podman exec linguago-api-app node -e "fetch('http://localhost:2737/listPairs').then(r=>r.text()).then(console.log)"
podman exec linguago-api-app node -e "fetch('http://localhost:5000/languages').then(r=>r.text()).then(console.log)"
```

## Resource usage

- **Apertium:** pairs are small rule-based dictionaries and use little RAM until a translation runs.
- **LibreTranslate:** each language is a neural model. All models are baked into the `linguago-lt` image at build time (the image is tens of GB on disk), so no downloads happen at runtime and the first translation of any pair is as fast as any other. Models still load into RAM on demand; use `--load-only` (see below) to cap that.
- To reduce memory use, load fewer languages by adding `args: ["--load-only", "en,es,fr"]` to the `lt` container in both pod files.

## Troubleshooting

- **`lt` exits with code 137:** it was OOM-killed. Raise its memory limit in the pod files or load fewer languages.
- **Permission errors on `lt-data` (rootless Podman):** check the container's UID with `podman exec linguago-api-lt id`, then fix ownership with `podman unshare chown -R <uid>:<gid> $(podman volume inspect lt-data -f '{{.Mountpoint}}')`.
- **`apy` fails to start:** check `podman logs linguago-api-apy`. Usually a wrong `apertium-apy` flag or the package missing from the repo.
- **Image not found on `kube play`:** confirm the builds succeeded and the image names in the pod files match `podman images` (`linguago-api`, `linguago-api-dev`, `linguago-apy`, `linguago-lt`).
- **Port 3000 in use:** a leftover pod or `rootlessport` process may be holding it. Check with `ss -ltnp | grep ':3000'` and `podman pod ps`, then `make down`. Otherwise change `hostPort` in the pod files.
- **Dev app doesn't reload on save:** check `podman logs -f linguago-api-app` to confirm `tsc --watch` is running. On macOS/Windows (podman machine), file events over bind mounts can be unreliable, so enable polling in `tsconfig.json` with `"watchOptions": {"watchFile": "fixedPollingInterval"}`.
- **"Permission denied" reading `/app/src` in dev (SELinux):** the bind mount needs relabeling. Use an absolute `hostPath` and check podman's SELinux labelling for the mount.
- **`yarn: command not found` on the host:** install it with `sudo dnf install yarnpkg`, or add dependencies in a throwaway container.

## Cleanup

```bash
make down                  # remove the pod
podman volume rm lt-data   # runtime state only; models live in the linguago-lt image
```