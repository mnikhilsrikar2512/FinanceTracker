.PHONY: init-db dev seed-demo test share

PYTHON := $(shell if [ -x venv/bin/python ]; then echo venv/bin/python; else echo python3; fi)
PIP := $(shell if [ -x venv/bin/pip ]; then echo venv/bin/pip; else echo pip; fi)
UVICORN := $(shell if [ -x venv/bin/uvicorn ]; then echo venv/bin/uvicorn; else echo uvicorn; fi)

init-db:
	@echo "Preparing Finly database schema"
	@$(PYTHON) scripts/init_db.py

dev:
	@echo "Starting Finly locally on port 8000"
	@$(PIP) install -r requirements.txt
	@$(MAKE) init-db
	@$(UVICORN) app.main:app --host 0.0.0.0 --port 8000 --reload

seed-demo:
	@echo "Reseeding Finly demo data"
	@$(PYTHON) seed_data.py

test:
	@$(PYTHON) -m pytest -q

share:
	@echo "Starting ngrok for the Finly web app on port 8000"
	@ngrok http 8000
