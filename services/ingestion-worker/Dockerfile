FROM node:20-alpine
RUN apk add --no-cache wget
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY index.js validator.js ./
EXPOSE 3003
CMD ["node", "index.js"]