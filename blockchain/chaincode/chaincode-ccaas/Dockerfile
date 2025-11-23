FROM node:18-alpine

WORKDIR /usr/src/app

# Copy package.json
COPY package.json ./

# Install dependencies (production only)
RUN npm install --production && npm cache clean --force

# Copy chaincode source files
COPY server.js ./
COPY index.js ./
COPY lib ./lib

# Expose chaincode port
EXPOSE 9999

# Start chaincode server
CMD ["node", "server.js"]
