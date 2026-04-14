FROM node:20-alpine

WORKDIR /app


COPY package*.json ./
RUN npm install

COPY . .

# Open the Vite port
EXPOSE 5173

# Start the Vite live development server
CMD ["npm", "run", "dev"]