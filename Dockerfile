FROM node:24-bookworm-slim
WORKDIR /app
COPY --chown=node:node package.json server.js admin.js model.js views.js dialogs.js web-config.js crew.css LICENSE ./
RUN mkdir /app/data && chown node:node /app/data
USER node
ENV PORT=8080 HOST=0.0.0.0
EXPOSE 8080
CMD ["node", "server.js"]
