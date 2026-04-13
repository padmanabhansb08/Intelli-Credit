FROM python:3.11-slim AS builder

WORKDIR /app

# Install system dependencies for PDF parsing, OCR, and graph processing
RUN apt-get update && apt-get install -y \
    build-essential \
    libfreetype6-dev \
    libjpeg-dev \
    libxml2-dev \
    libxslt-dev \
    tesseract-ocr \
    libgl1 \
    libglib2.0-0 \
    poppler-utils \
    python3-dev \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Create necessary directories
RUN mkdir -p /app/data/raw /app/data/curated /app/data/features /app/models

# Copy source code
COPY . .

EXPOSE 8006

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8006"]
