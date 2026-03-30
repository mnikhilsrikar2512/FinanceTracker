.PHONY: dev test

dev:
	@echo "Starting local development workflow: install deps, seed data, run server"
	@pip install -r requirements.txt
	@python3 seed_data.py
	@uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

test:
	@pytest -q
