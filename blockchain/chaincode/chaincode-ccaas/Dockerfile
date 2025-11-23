FROM node:18-alpine

WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy chaincode source
COPY . .

# Expose chaincode port
EXPOSE 9999

# Start chaincode server
CMD ["node", "server.js"]
