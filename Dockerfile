FROM node:22-alpine
ENV NODE_ENV=production HOST=0.0.0.0
WORKDIR /app
COPY --chown=node:node package.json server.mjs worker.mjs ./
COPY --chown=node:node src ./src
COPY --chown=node:node config ./config
COPY --chown=node:node public ./public
USER node
EXPOSE 4173
CMD ["node", "server.mjs"]
