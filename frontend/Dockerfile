FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm ci

# Copy source
COPY . .

# Build the Next.js App
ENV NEXT_TELEMETRY_DISABLED 1
RUN npm run build

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["npm", "start"]
