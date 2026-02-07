# Use Node.js Alpine for lightweight image
FROM node:20-alpine

# Set working directory
WORKDIR /usr/src/app

# Copy package files first for caching
COPY package*.json ./

# Install all dependencies (dev included!)
RUN npm install

# Install nodemon globally
RUN npm install -g nodemon
# Install all dependencies (dev included!)
RUN npm install --legacy-peer-deps
RUN npm install --legacy-peer-deps

# Copy the rest of your code
COPY . .

# Expose API port
EXPOSE 4000

# Default command: run nodemon
CMD ["npm", "run", "dev"]
