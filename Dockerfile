FROM node:22-alpine

WORKDIR /app

COPY backend/package.json ./package.json
COPY backend/package-lock.json ./package-lock.json
RUN npm ci --omit=dev

COPY backend/src ./src
COPY backend/.env.example ./.env.example
COPY FrontEnd/html ./public

EXPOSE 8080

CMD ["npm", "start"]
