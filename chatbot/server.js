#!/usr/bin/env node
/**
 * Chatbot API Server - HTTP endpoint for the chatbot widget
 */

const http = require('http');
const url = require('url');
const { chat } = require('./index');

const PORT = process.env.PORT || 3001;

// Cache for loaded embeddings
let embeddingsLoaded = false;

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Health check
  if (parsedUrl.pathname === '/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', embeddingsLoaded }));
    return;
  }

  // Chat endpoint
  if (parsedUrl.pathname === '/chat' && req.method === 'POST') {
    let body = '';
    
    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', async () => {
      try {
        const { query } = JSON.parse(body);
        
        if (!query) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Query is required' }));
          return;
        }

        console.log(`[${new Date().toISOString()}] Query: ${query}`);
        
        const response = await chat(query);
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ response }));
        
      } catch (error) {
        console.error('Error:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: error.message }));
      }
    });

    return;
  }

  // 404 for everything else
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, () => {
  console.log(`Chatbot API server running on http://localhost:${PORT}`);
  console.log('Endpoints:');
  console.log('  GET  /health - Health check');
  console.log('  POST /chat   - Chat endpoint (send {"query": "your question"})');
});
