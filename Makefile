.PHONY: init-db dev share

PYTHON := $(shell if [ -x venv/bin/python ]; then echo venv/bin/python; else echo python3; fi)
PIP := $(shell if [ -x venv/bin/pip ]; then echo venv/bin/pip; else echo pip; fi)
UVICORN := $(shell if [ -x venv/bin/uvicorn ]; then echo venv/bin/uvicorn; else echo uvicorn; fi)
HOST ?= 127.0.0.1
PORT ?= 8000

init-db:
	@echo "Preparing Finly database schema"
	@$(PYTHON) -c "from app.core.db_init import init_database_schema; init_database_schema()"

dev:
	@echo "Starting Finly locally on $(HOST):$(PORT)"
	@$(PIP) install -r requirements.txt
	@docker-compose up -d sqlserver
	@$(MAKE) init-db
	@$(UVICORN) app.main:app --host $(HOST) --port $(PORT) --reload

share:
	@echo "Starting ngrok for the Finly web app on port $(PORT)"
	@ngrok http $(PORT)
