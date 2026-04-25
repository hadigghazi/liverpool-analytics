FROM node:20-alpine
RUN apk add --no-cache python3 py3-pip
WORKDIR /app
COPY backend/package.json .
RUN npm install --production
COPY backend/src/ ./src/
COPY transfermarkt/ ./transfermarkt/
RUN python3 -m pip install --no-cache-dir --break-system-packages -r transfermarkt/requirements.txt
EXPOSE 3001
CMD ["node", "src/index.js"]
