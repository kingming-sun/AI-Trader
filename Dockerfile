# Multi-stage build for AI-Trader
FROM python:3.10-slim

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install additional dependencies that might be needed
RUN pip install --no-cache-dir \
    requests \
    python-dotenv

# Copy application code
COPY . .

# Create necessary directories
RUN mkdir -p logs data configs logs

# Set environment variables
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app

# Expose port (Render will use PORT environment variable)
EXPOSE 8080

# Health check (simple Python script)
RUN echo '#!/usr/bin/env python3\n\
import urllib.request\n\
import sys\n\
try:\n\
    port = sys.argv[1] if len(sys.argv) > 1 else "8080"\n\
    urllib.request.urlopen(f"http://localhost:{port}/health", timeout=5)\n\
    sys.exit(0)\n\
except:\n\
    sys.exit(1)' > /app/healthcheck.py && \
    chmod +x /app/healthcheck.py

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD python /app/healthcheck.py ${PORT:-8080}

# Default command
CMD ["python", "startup.py"]
