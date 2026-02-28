FROM python:3.11-slim

WORKDIR /app

# Install system dependencies for reportlab and pdfplumber
RUN apt-get update && apt-get install -y \
    build-essential \
    libfreetype6-dev \
    libjpeg-dev \
    libxml2-dev \
    libxslt-dev \
    tesseract-ocr \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Create necessary directories
RUN mkdir -p /app/data/raw /app/data/curated /app/data/features /app/models

# Copy source code
COPY . .

# In production, data comes from Databricks integrations.
# Ensure that synthetic generation is entirely removed for production release.
EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
