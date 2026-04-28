# Use an official Node runtime as a parent image
FROM node:18-alpine

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and install dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of your backend code into the container
COPY . .

# Make port 5000 available to the outside
EXPOSE 5000

# Command to run your real server
CMD ["node", "server.js"]