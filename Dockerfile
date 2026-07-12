FROM node:22-alpine AS build
WORKDIR /src
COPY package.json ./
RUN npm install --no-audit --no-fund
COPY build.mjs index.html sw.js manifest.json ./
COPY css css
COPY js js
COPY lang lang
RUN node build.mjs

FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /src/dist /usr/share/nginx/html
COPY assets /usr/share/nginx/html/assets
