FROM node:22-alpine

WORKDIR /app

COPY package.json ./
COPY src/yt-subs-sdk.js src/yt-subs-cli.js src/yt-subs-mcp.js src/yt-subs-server.js ./src/

RUN npm install --omit=dev --ignore-scripts

# Bind to all interfaces so the port is reachable from outside the container
ENV YTSUBS_HOST=0.0.0.0
ENV YTSUBS_PORT=3456

VOLUME ["/root/.yt-subs-cache"]

EXPOSE 3456

CMD ["node", "src/yt-subs-server.js"]
