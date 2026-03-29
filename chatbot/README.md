# Twitter RAG Chatbot Setup

This chatbot uses RAG (Retrieval Augmented Generation) to respond in your writing style based on your Twitter history.

## Architecture

```
┌─────────────────┐
│  Hugo Blog      │◄─ Chat widget (bottom right)
│  nilesh.londhe  │
│  .com           │
└────────┬────────┘
         │ HTTP POST
         ▼
┌─────────────────┐
│  Chatbot API    │◄─ Runs on ASUS (port 3001)
│  server.js      │
└────────┬────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌─────────┐ ┌──────────────┐
│ Embed   │ │ Qwen 27B     │
│ Server  │ │ Chat API     │
│ :8002   │ │ :8001        │
│ (nomic) │ │ (GPU 0)      │
└─────────┘ └──────────────┘
```

## Prerequisites

1. **Twitter data**: Extract tweets to `/home/cloudgenius/mynix/chatbot-data/tweets.json`
2. **Embedding server**: Already running on `http://asus:8002` (nomic-embed-text)
3. **Qwen model**: Already running on `http://asus:8001` (Qwen3.5-27B)

## Step 1: Prepare Tweet Data

```bash
# Create data directory
mkdir -p /home/cloudgenius/mynix/chatbot-data

# Extract tweets from Twitter archive (if you have tweets.js)
cd /tmp/twitter-2026
node -e "
const fs = require('fs');
const data = JSON.parse(fs.readFileSync('data/tweets.js', 'utf8'));
const tweets = data.map(d => ({
  id: d.tweet?.id,
  text: d.tweet?.text,
  created_at: d.tweet?.created_at
})).filter(t => t.id && t.text && t.created_at);
fs.writeFileSync('/home/cloudgenius/mynix/chatbot-data/tweets.json', JSON.stringify(tweets));
console.log('Extracted', tweets.length, 'tweets');
"
```

## Step 2: Create Embeddings

```bash
# Copy script to ASUS
cd /Users/stacey/.openclaw/workspace/nilesh.londhe.com/chatbot
scp create-embeddings.js cloudgenius@asus.cg.home.arpa:/home/cloudgenius/mynix/chatbot-data/

# Run on ASUS
ssh cloudgenius@asus.cg.home.arpa "
cd /home/cloudgenius/mynix/chatbot-data
node create-embeddings.js
"
```

This will:
- Load your tweets
- Create 768-dimensional embeddings using nomic-embed-text
- Save to `tweet_embeddings.json`

**Estimated time**: ~5 minutes for 20,000 tweets

## Step 3: Start Chatbot API Server

```bash
# Copy server files to ASUS
scp server.js index.js cloudgenius@asus.cg.home.arpa:/home/cloudgenius/mynix/chatbot-data/

# Install dependency
ssh cloudgenius@asus.cg.home.arpa "
cd /home/cloudgenius/mynix/chatbot-data
npm init -y
npm install openai
"

# Start server
ssh cloudgenius@asus.cg.home.arpa "
cd /home/cloudgenius/mynix/chatbot-data
node server.js
"
```

Server will run on `http://asus:3001`

## Step 4: Test the Chatbot

```bash
# Test API
curl http://asus:3001/health

# Send a message
curl -X POST http://asus:3001/chat \
  -H 'Content-Type: application/json' \
  -d '{"query": "What do you think about AI?"}'
```

## Step 5: Embed Widget in Hugo Site

Add this to your Hugo theme's `layouts/partials/footer.html`:

```html
<!-- LV Nilesh Chatbot Widget -->
<div id="chatbot-widget">
  <button id="chatbot-toggle" style="position:fixed;bottom:20px;right:20px;padding:15px 20px;background:linear-gradient(135deg,#667eea,#764ba2);color:white;border:none;border-radius:50px;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,0.3);z-index:9999;">💬 Chat</button>
  
  <div id="chatbot-window" style="display:none;position:fixed;bottom:80px;right:20px;width:350px;height:500px;background:white;border-radius:16px;box-shadow:0 8px 32px rgba(0,0,0,0.2);z-index:9999;flex-direction:column;overflow:hidden;">
    <div style="padding:15px;background:linear-gradient(135deg,#667eea,#764ba2);color:white;">
      <h3 style="margin:0;font-size:1rem;">🤖 LV Nilesh Bot</h3>
      <p style="margin:5px 0 0 0;font-size:0.75rem;opacity:0.9;">AI trained on @LVNilesh's tweets</p>
    </div>
    <div id="chatbot-messages" style="flex:1;overflow-y:auto;padding:15px;background:#f7f7f8;"></div>
    <div style="display:flex;padding:10px;border-top:1px solid #eee;">
      <input type="text" id="chatbot-input" placeholder="Ask..." style="flex:1;padding:8px 12px;border:2px solid #e0e0e0;border-radius:20px;outline:none;">
      <button id="chatbot-send" style="margin-left:8px;padding:8px 16px;background:linear-gradient(135deg,#667eea,#764ba2);color:white;border:none;border-radius:20px;cursor:pointer;">Send</button>
    </div>
  </div>

  <script>
    const API_URL = 'http://asus:3001/chat';
    const toggle = document.getElementById('chatbot-toggle');
    const windowEl = document.getElementById('chatbot-window');
    const messages = document.getElementById('chatbot-messages');
    const input = document.getElementById('chatbot-input');
    const sendBtn = document.getElementById('chatbot-send');

    toggle.addEventListener('click', () => {
      windowEl.style.display = windowEl.style.display === 'none' ? 'flex' : 'none';
    });

    function addMessage(text, isUser) {
      const div = document.createElement('div');
      div.style.cssText = `padding:8px 12px;margin:8px 0;background:${isUser ? '#667eea' : 'white'};color:${isUser ? 'white' : '#333'};border-radius:12px;max-width:80%;${isUser ? 'margin-left:auto' : 'margin-right:auto'}`;
      div.textContent = text;
      messages.appendChild(div);
      messages.scrollTop = messages.scrollHeight;
    }

    async function sendMessage() {
      const text = input.value.trim();
      if (!text) return;
      
      addMessage(text, true);
      input.value = '';
      
      try {
        const resp = await fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: text }),
        });
        const data = await resp.json();
        addMessage(data.response, false);
      } catch (e) {
        addMessage('Error: ' + e.message, false);
      }
    }

    sendBtn.addEventListener('click', sendMessage);
    input.addEventListener('keypress', e => { if (e.key === 'Enter') sendMessage(); });
    
    // Welcome message
    addMessage('Hi! Ask me anything.', false);
  </script>
</div>
```

## Troubleshooting

### Embeddings not created
```bash
# Check embedding server
curl http://asus:8002/health

# Test embedding creation
curl http://asus:8002/v1/embeddings \
  -H 'Content-Type: application/json' \
  -d '{"input": "test", "model": "nomic-embed-text"}'
```

### Chat API not responding
```bash
# Check if server is running
ssh cloudgenius@asus.cg.home.arpa "pgrep -f 'node.*server.js'"

# Check logs
ssh cloudgenius@asus.cg.home.arpa "tail -20 /home/cloudgenius/mynix/chatbot-data/server.log"
```

### CORS errors in browser
The server allows all origins. If you see CORS errors, check your firewall/proxy settings.

## Making it Production-Ready

1. **Reverse proxy**: Configure nginx/Caddy to expose the chat API securely
2. **Rate limiting**: Add rate limiting to prevent abuse
3. **Authentication**: Add API key or token-based auth
4. **Monitoring**: Add health checks and logging
5. **HTTPS**: Use TLS for production deployment

## Files Created

- `index.js` - Core chatbot logic (RAG, embeddings, response generation)
- `server.js` - HTTP API server
- `index.html` - Demo chat interface
- `create-embeddings.js` - Script to create tweet embeddings
- `README.md` - This file
