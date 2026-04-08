SHELL := /bin/bash

.PHONY: eigen-bootstrap eigen-seed eigen-seed-sql eigen-smoke eigen-bootstrap-sql eigen-eval eigen-eval-public-core eigen-eval-public-leakage eigen-eval-eigenx-core eigen-sources-public eigen-sources-eigenx eigen-site-bootstrap eigen-ingest-bulk eigen-ingest-sync

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

eigen-eval-public-core:
	EIGEN_EVAL_GROUP=public_core ./scripts/eigen-eval.sh

eigen-eval-public-leakage:
	EIGEN_EVAL_GROUP=public_leakage ./scripts/eigen-eval.sh

eigen-eval-eigenx-core:
	EIGEN_EVAL_GROUP=eigenx_core ./scripts/eigen-eval.sh

eigen-sources-public:
	./scripts/eigen-sources.sh public

eigen-sources-eigenx:
	./scripts/eigen-sources.sh eigenx

eigen-site-bootstrap:
	./scripts/eigen-site-bootstrap.sh

eigen-ingest-bulk:
	./scripts/eigen-ingest-bulk.sh

eigen-ingest-sync:
	./scripts/eigen-ingest-sync.sh
