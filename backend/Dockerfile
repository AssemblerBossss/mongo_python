# syntax=docker/dockerfile:1
FROM python:3.12-slim AS builder

WORKDIR /install

RUN pip install --no-cache-dir --target=/install \
    fastapi==0.115.0 \
    "uvicorn[standard]==0.30.6" \
    pymongo==4.6.0 \
    pydantic==2.9.2 \
    pydantic-settings==2.5.2

FROM python:3.12-slim

RUN useradd --create-home appuser
WORKDIR /app

ENV PYTHONPATH=/usr/local/lib/python3.12/site-packages
COPY --from=builder /install /usr/local/lib/python3.12/site-packages
COPY app ./app

USER appuser

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
