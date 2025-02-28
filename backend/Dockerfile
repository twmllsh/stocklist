FROM python:3.12-slim
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    libnss3 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-glib-1-2 \
    libgdk-pixbuf2.0-0 \
    libglib2.0-0 \
    libnspr4 \
    libx11-xcb1 \
    libxcomposite1 \
    libxrandr2 \
    libxss1 \
    libxshmfence1 \
    fonts-liberation \
    libappindicator3-1 \
    libasound2 \
    libxss1 \
    libgbm1 \
    --no-install-recommends \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY requirements.txt .
RUN apt-get update && apt-get install -y iputils-ping
RUN pip install --upgrade pip
RUN playwright install
RUN pip install --no-cache-dir -r requirements.txt

# RUN playwright install-dep

COPY . .
EXPOSE 8000
CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]