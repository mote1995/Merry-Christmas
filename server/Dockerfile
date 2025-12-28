FROM node:18-alpine

WORKDIR /app

COPY package.json ./
RUN npm install --production

COPY server.js ./

# Create directories for persistence
RUN mkdir uploads data

# Expose the API port
EXPOSE 3001

# Start the server
CMD ["node", "server.js"]
