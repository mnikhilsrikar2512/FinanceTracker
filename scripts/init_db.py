from app.core.db_init import init_database_schema


def main() -> None:
    init_database_schema()
    print("Finly database schema is ready.")


if __name__ == "__main__":
    main()
