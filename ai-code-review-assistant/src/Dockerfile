# src/Dockerfile
FROM docker.n8n.io/n8nio/n8n:latest

# Switch to root to install global packages
USER root
RUN npm install -g n8n-nodes-sqlite

# Switch back to node user and configure n8n to load custom nodes
USER node
ENV N8N_CUSTOM_EXTENSIONS=/home/node/custom
RUN mkdir -p /home/node/custom && echo "module.exports = { nodes: ['n8n-nodes-sqlite'] }" > /home/node/custom/n8n-custom-nodes.js