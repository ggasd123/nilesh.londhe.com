#!/usr/bin/env python3
"""
Twitter RAG Chatbot API Server - No external dependencies
Uses local embedding server on ASUS (nomic-embed-text) and Qwen for responses
"""

import json
import http.server
import socketserver
import urllib.request
import math
from typing import List, Dict

# Configuration
EMBEDDING_SERVER = "http://localhost:8002/v1"
QWEN_SERVER = "http://localhost:8001/v1"
EMBEDDINGS_FILE = "/home/cloudgenius/mynix/chatbot-data/tweets_embeddings.json"
TOP_K = 5

# Load embeddings once at startup
print(f"Loading embeddings from {EMBEDDINGS_FILE}...")
with open(EMBEDDINGS_FILE, 'r') as f:
    EMBEDDINGS = json.load(f)
print(f"Loaded {len(EMBEDDINGS)} tweet embeddings")

def create_embedding(text: str, prefix: str = "search_query") -> List[float]:
    """Create embedding using local nomic-embed-text server"""
    url = f"{EMBEDDING_SERVER}/embeddings"
    payload = json.dumps({
        "model": "nomic-embed-text",
        "input": f"{prefix}: {text}"
    }).encode('utf-8')
    
    req = urllib.request.Request(url, data=payload, headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=30) as response:
        data = json.loads(response.read().decode('utf-8'))
        return data['data'][0]['embedding']

def cosine_similarity(a: List[float], b: List[float]) -> float:
    """Calculate cosine similarity between two vectors (no numpy)"""
    dot_product = sum(x * y for x, y in zip(a, b))
    mag_a = math.sqrt(sum(x * x for x in a))
    mag_b = math.sqrt(sum(x * x for x in b))
    return dot_product / (mag_a * mag_b)

def find_similar(query_embedding: List[float], top_k: int = TOP_K) -> List[Dict]:
    """Find most similar tweets to query"""
    scores = []
    for tweet in EMBEDDINGS:
        score = cosine_similarity(query_embedding, tweet['embedding'])
        scores.append((tweet, score))
    
    scores.sort(key=lambda x: x[1], reverse=True)
    return [tweet for tweet, score in scores[:top_k]]

def generate_response(query: str, similar_tweets: List[Dict]) -> str:
    """Generate response using Qwen LLM with retrieved tweets as context"""
    context = "\n".join([
        f'- "{t["text"]}" ({t["created_at"][:10]})' 
        for t in similar_tweets
    ])
    
    prompt = f"""You are a chatbot that responds in the style of @LVNilesh based on their Twitter history.

Here are similar things they've tweeted before:
{context}

Respond to this query in a similar style, tone, and voice. Keep it concise and natural like a tweet or short conversation.

Query: {query}

Your response:"""
    
    url = f"{QWEN_SERVER}/chat/completions"
    payload = json.dumps({
        "model": "Qwen3.5-27B",
        "messages": [
            {"role": "system", "content": "You are a helpful assistant that responds in the style of a tech entrepreneur who tweets about AI, Bitcoin, stocks, and cloud infrastructure. Keep responses concise and conversational."},
            {"role": "user", "content": prompt}
        ],
        "temperature": 0.7,
        "max_tokens": 500
    }).encode('utf-8')
    
    req = urllib.request.Request(url, data=payload, headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=60) as response:
        data = json.loads(response.read().decode('utf-8'))
        return data['choices'][0]['message']['content']

class ChatbotHandler(http.server.SimpleHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
    
    def do_GET(self):
        if self.path == '/health':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"status": "ok", "embeddings": len(EMBEDDINGS)}).encode())
        else:
            self.send_response(404)
            self.end_headers()
    
    def do_POST(self):
        if self.path == '/chat':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            data = json.loads(post_data.decode('utf-8'))
            
            query = data.get('query', '')
            if not query:
                self.send_response(400)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"error": "Query is required"}).encode())
                return
            
            print(f"Query: {query}")
            
            try:
                # Create query embedding
                print("  Creating embedding...")
                query_embedding = create_embedding(query, "search_query")
                
                # Find similar tweets
                print("  Finding similar tweets...")
                similar = find_similar(query_embedding)
                print(f"  Found {len(similar)} similar tweets")
                
                # Generate response
                print("  Generating response...")
                response_text = generate_response(query, similar)
                print(f"  Response: {response_text[:100]}...")
                
                self.send_response(200)
                self.send_header('Access-Control-Allow-Origin', '*')
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"response": response_text}).encode())
                
            except Exception as e:
                print(f"Error: {e}")
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode())
        else:
            self.send_response(404)
            self.end_headers()
    
    def log_message(self, format, *args):
        print(f"[{self.log_date_time_string()}] {args[0]}")

if __name__ == "__main__":
    PORT = int(__import__('os').environ.get('PORT', 3001))
    
    print(f"🤖 Chatbot API server running on http://localhost:{PORT}")
    print(f"📊 Loaded {len(EMBEDDINGS)} tweet embeddings")
    print(f"🔗 Endpoints:")
    print(f"   GET  /health - Health check")
    print(f"   POST /chat   - Chat endpoint")
    print(f"🚀 Press Ctrl+C to stop\n")
    
    with socketserver.TCPServer(("", PORT), ChatbotHandler) as httpd:
        httpd.serve_forever()
