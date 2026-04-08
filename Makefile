SHELL := /bin/bash

.PHONY: eigen-bootstrap eigen-seed eigen-smoke

eigen-seed:
	./scripts/eigen-seed.sh

eigen-smoke:
	./scripts/eigen-smoke.sh

eigen-bootstrap: eigen-seed eigen-smoke
