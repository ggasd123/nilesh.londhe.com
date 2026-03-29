#!/bin/bash
# Quick setup script for Twitter RAG Chatbot on ASUS

set -e

echo "🚀 Setting up Twitter RAG Chatbot..."

# Create data directory
mkdir -p /home/cloudgenius/mynix/chatbot-data
cd /home/cloudgenius/mynix/chatbot-data

# Check if tweets.json exists
if [ ! -f "tweets.json" ]; then
    echo "❌ tweets.json not found!"
    echo ""
    echo "Please extract tweets from Twitter archive first:"
    echo ""
    echo "  # If you have tweets.js from Twitter download:"
    echo "  node -e \"\""
    echo "  const fs = require('fs');"
    echo "  const data = JSON.parse(fs.readFileSync('/path/to/tweets.js', 'utf8'));"
    echo "  const tweets = data.map(d => ({"
    echo "    id: d.tweet?.id,"
    echo "    text: d.tweet?.text,"
    echo "    created_at: d.tweet?.created_at"
    echo "  })).filter(t => t.id && t.text && t.created_at);"
    echo "  fs.writeFileSync('tweets.json', JSON.stringify(tweets));"
    echo "  console.log('Extracted', tweets.length, 'tweets');"
    echo "  \""
    echo ""
    exit 1
fi

echo "✅ tweets.json found ($(wc -l < tweets.json | xargs echo) lines)"

# Install dependencies
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm init -y
    npm install openai
fi

# Create embeddings
if [ ! -f "tweet_embeddings.json" ]; then
    echo "🔄 Creating embeddings (this may take a few minutes)..."
    node create-embeddings.js
    echo "✅ Embeddings created"
else
    echo "✅ Embeddings already exist"
fi

# Test embedding server
echo ""
echo "🧪 Testing embedding server..."
if curl -s http://localhost:8002/health > /dev/null; then
    echo "✅ Embedding server is running"
else
    echo "⚠️  Embedding server not responding on port 8002"
fi

# Test Qwen server
echo ""
echo "🧪 Testing Qwen chat server..."
if curl -s http://localhost:8001/v1/chat/completions \
    -H "Content-Type: application/json" \
    -d '{"model":"Qwen3.5-27B","messages":[{"role":"user","content":"test"}],"max_tokens":5}' > /dev/null 2>&1; then
    echo "✅ Qwen server is running"
else
    echo "⚠️  Qwen server not responding on port 8001"
fi

echo ""
echo "🎉 Setup complete!"
echo ""
echo "To start the chatbot API server:"
echo "  cd /home/cloudgenius/mynix/chatbot-data"
echo "  node server.js"
echo ""
echo "The server will be available at: http://asus:3001"
echo "Test with:"
echo "  curl -X POST http://localhost:3001/chat -H 'Content-Type: application/json' -d '{\"query\": \"Hello!\"}'"
