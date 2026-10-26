# AEROGEST GSD — interface (build estático servido por Nginx sem privilégios)
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npx vite build

FROM nginxinc/nginx-unprivileged:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY nginx-seguranca.conf /etc/nginx/snippets/seguranca.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
