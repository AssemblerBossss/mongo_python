import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    mongo_host: str = os.getenv("MONGO_HOST", "localhost")
    mongo_port: int = int(os.getenv("MONGO_PORT", "27017"))
    mongo_username: str = os.getenv("MONGO_USERNAME", "admin")
    mongo_password: str = os.getenv("MONGO_PASSWORD", "admin")
    mongo_db: str = os.getenv("MONGO_DB", "datasets")


settings = Settings()
