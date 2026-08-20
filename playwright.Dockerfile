FROM mcr.microsoft.com/playwright:v1.62.1-jammy

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends python3 build-essential     && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci

COPY . .

ENV TEST_BASE_URL=http://localhost:5173

CMD ["./test-e2e-docker.sh"]
