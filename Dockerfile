FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source files
COPY tsconfig.json ./
COPY src ./src

# Build TypeScript
RUN npm run build

# Production image
FROM node:20-alpine AS runtime

WORKDIR /app

# Install tini for proper signal handling
RUN apk add --no-cache tini

# Copy built files and dependencies
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package.json ./

# Default to Docker network Ollama host
ENV TERMWHAT_OLLAMA_HOST=http://ollama:11434
ENV TERMWHAT_MODEL=llama3.2
ENV NODE_ENV=production
ENV DOCKER=true

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/index.js"]
