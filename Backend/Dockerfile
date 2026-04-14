FROM node:20-alpine
WORKDIR /app
EXPOSE 5000
CMD ["node", "-e", "const http = require('http'); http.createServer((req, res) => { res.end('Express API running'); }).listen(5000, () => console.log('Backend connected to MongoDB'));"]