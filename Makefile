SHELL := /bin/bash

.PHONY: eigen-bootstrap eigen-seed eigen-seed-sql eigen-smoke eigen-bootstrap-sql eigen-eval eigen-sources-public eigen-sources-eigenx

eigen-seed:
	./scripts/eigen-seed.sh

eigen-seed-sql:
	./scripts/eigen-seed-sql.sh

eigen-smoke:
	./scripts/eigen-smoke.sh

eigen-bootstrap: eigen-seed eigen-smoke

eigen-bootstrap-sql: eigen-seed-sql eigen-smoke

eigen-eval:
	./scripts/eigen-eval.sh

eigen-sources-public:
	./scripts/eigen-sources.sh public

eigen-sources-eigenx:
	./scripts/eigen-sources.sh eigenx
