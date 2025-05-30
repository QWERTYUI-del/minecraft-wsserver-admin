# Use an official Node.js runtime as a parent image
FROM node:18-alpine

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of your app files
COPY . .

# Expose ports (adjust if needed)
EXPOSE 3000 3001

# Set environment variables (you'll override these in Pterodactyl or .env)
ENV NODE_ENV=production

# Start the app
CMD ["node", "server.js"]
