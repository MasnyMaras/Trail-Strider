import os

from sqlalchemy import URL, create_engine

engine = create_engine(
    URL.create(
        "postgresql+psycopg",               # Use psycopg driver for PostgreSQL
        host=os.environ["PGHOST"],
        port=int(os.environ["PGPORT"]),
        database=os.environ["PGDATABASE"],
        username=os.environ["PGUSER"],
        password=os.environ["PGPASSWORD"],
    ),
    pool_pre_ping=True,
)
