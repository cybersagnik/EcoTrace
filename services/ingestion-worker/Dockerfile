FROM node:20-alpine
RUN apk add --no-cache wget
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY index.js validator.js ./
EXPOSE 3003
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:3003/health || exit 1
CMD ["node", "index.js"]
