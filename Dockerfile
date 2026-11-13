FROM node:24-bookworm-slim
WORKDIR /app
COPY --chown=node:node package.json server.mjs ./
COPY --chown=node:node dist ./dist
RUN mkdir /app/data && chown node:node /app/data
USER node
ENV HOST=0.0.0.0 PORT=3000 NODE_ENV=production DB_PATH=/app/data/clip-bounty.sqlite
VOLUME ["/app/data"]
EXPOSE 3000
CMD ["node", "server.mjs"]
