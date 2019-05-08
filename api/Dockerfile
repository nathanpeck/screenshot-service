FROM node:12 AS build
WORKDIR /srv
ADD package.json .
RUN npm install

FROM node:12-slim
COPY --from=build /srv .
ADD ./index.js index.js
CMD ["node", "index.js"]
