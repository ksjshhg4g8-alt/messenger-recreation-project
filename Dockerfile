# Сборка сайта (фронтенд) и раздача через Nginx

# --- Этап 1: сборка ---
FROM node:20-alpine AS build
WORKDIR /app

# Адрес сервера функций для фронтенда (подставляется при сборке)
ARG VITE_API_BASE=/api
ENV VITE_API_BASE=$VITE_API_BASE

COPY package*.json bun.lockb* ./
RUN npm install
COPY . .
RUN npm run build

# --- Этап 2: раздача ---
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
