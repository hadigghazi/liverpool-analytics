FROM node:20-alpine AS build
WORKDIR /app
ARG VITE_SEASON=2425
ENV VITE_SEASON=$VITE_SEASON
COPY package.json .
RUN npm install
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
