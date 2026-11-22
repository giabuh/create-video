.PHONY: app dev stop restart test push pull sync

# App (http://127.0.0.1:5317), production build: smooth preview; studio/src edits rebuild (~2 s) and offer a reload.
app:
	cd app && npm start

# Dev mode for working on the app itself: HMR, and the API restarts itself when server code changes.
dev:
	cd app && npm run dev

# Stop the app wherever it runs (another terminal too): frees the API (5316) and UI (5317) ports.
stop:
	-fuser -k 5316/tcp 5317/tcp

restart: stop
	@sleep 1
	$(MAKE) app

test:
	uv run --with pytest python -m pytest tools/tests -q
	cd studio && npx tsc --noEmit
	cd app && npm test && npx tsc --noEmit

# Google Drive media sync (tools/sync.sh). Preview first with: make push ARGS=--dry-run
push:
	tools/sync.sh push $(ARGS)

pull:
	tools/sync.sh pull $(ARGS)

# Pull what is new on Drive, then push local changes
sync: pull push
