.PHONY: dev seed-demo test share

dev:
	@echo "Starting Finly locally on port 8000"
	@pip install -r requirements.txt
	@uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

seed-demo:
	@echo "Reseeding Finly demo data"
	@python3 seed_data.py

test:
	@pytest -q

share:
	@echo "Starting ngrok for the Finly web app on port 8000"
	@ngrok http 8000
