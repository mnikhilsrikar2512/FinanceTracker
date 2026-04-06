from app.core import db_init


def test_init_database_schema_calls_create_all(monkeypatch):
    captured = {}

    def fake_create_all(*, bind):
        captured["bind"] = bind

    monkeypatch.setattr(db_init.Base.metadata, "create_all", fake_create_all)

    db_init.init_database_schema()

    assert captured["bind"] is db_init.engine
