#!/usr/bin/env python3
"""
Flask API for Twitter-based RAG Chatbot
Mimics LV Nilesh's writing style based on tweet history
Uses local sentence-transformers for embeddings
"""
import json
import os
import numpy as np
from flask import Flask, request, jsonify, send_from_directory
from functools import lru_cache

# Load sentence-transformers model
from sentence_transformers import SentenceTransformer
EMBEDDING_MODEL = SentenceTransformer('all-MiniLM-L6-v2')

app = Flask(__name__, static_folder='static')

# Load embeddings
EMBEDDINGS_FILE = os.path.join(os.path.dirname(__file__), 'tweets_embeddings.json')

@lru_cache
def load_tweets_with_embeddings():
    """Load tweets with embeddings (cached)"""
    with open(EMBEDDINGS_FILE, 'r', encoding='utf-8') as f:
        return json.load(f)

def cosine_similarity(vec1: list, vec2: list) -> float:
    """Calculate cosine similarity between two vectors"""
    return np.dot(vec1, vec2) / (np.linalg.norm(vec1) * np.linalg.norm(vec2))

def embed_query(query: str) -> list:
    """Create embedding for query using local model"""
    text = ' '.join(query.split())  # Normalize whitespace
    text = text[:512]  # MiniLM max length
    
    embedding = EMBEDDING_MODEL.encode(text, convert_to_numpy=True)
    return embedding.tolist()

def find_similar_tweets(query: str, top_k: int = 5) -> list:
    """Find most similar tweets to query"""
    query_embedding = embed_query(query)
    tweets = load_tweets_with_embeddings()
    
    # Calculate similarities
    similarities = []
    for tweet in tweets:
        if 'embedding' not in tweet:
            continue
        sim = cosine_similarity(query_embedding, tweet['embedding'])
        similarities.append((sim, tweet))
    
    # Sort by similarity and return top_k
    similarities.sort(reverse=True, key=lambda x: x[0])
    return [tweet for _, tweet in similarities[:top_k]]

def generate_response(query: str, similar_tweets: list) -> str:
    """Generate a response in LV Nilesh's style based on similar tweets"""
    if not similar_tweets:
        return "I'm not sure about that topic. Ask me something else!"
    
    # Pick the most relevant tweets and combine them
    response_tweets = similar_tweets[:3]
    
    # Filter out very old tweets unless they're highly relevant
    recent_tweets = [t for t in response_tweets if '2024' in t['created_at'] or '2025' in t['created_at'] or '2026' in t['created_at']]
    
    if recent_tweets:
        response_tweets = recent_tweets[:2]
    
    # Build response
    responses = []
    for tweet in response_tweets:
        text = tweet['text']
        # Clean up the text
        text = text.replace('\n\n', '. ')
        text = text.replace('\n', ' ')
        responses.append(text)
    
    # Combine into a coherent response
    if len(responses) == 1:
        return responses[0]
    else:
        return " ".join(responses)

@app.route('/')
def index():
    """Health check"""
    return jsonify({"status": "ok", "service": "lvnilesh-chatbot"})

@app.route('/chat', methods=['POST'])
def chat():
    """Handle chat query"""
    data = request.get_json()
    query = data.get('query', '')
    
    if not query:
        return jsonify({"error": "No query provided"}), 400
    
    try:
        # Find similar tweets
        similar_tweets = find_similar_tweets(query, top_k=5)
        
        if not similar_tweets:
            return jsonify({
                "response": "I don't have much to say about that. Try asking me about tech, AI, Bitcoin, or my daily life!",
                "sources": []
            })
        
        # Generate response
        response = generate_response(query, similar_tweets)
        
        # Return response with sources
        sources = [
            {
                "text": t['text'][:200],
                "date": t['created_at'],
                "likes": t.get('favorite_count', 0)
            }
            for t in similar_tweets[:3]
        ]
        
        return jsonify({
            "response": response,
            "sources": sources
        })
        
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

@app.route('/widget.js')
def widget():
    """Serve the chat widget"""
    return send_from_directory('static', 'widget.js')

@app.route('/widget.css')
def widget_css():
    """Serve the widget CSS"""
    return send_from_directory('static', 'widget.css')

if __name__ == '__main__':
    print("Starting LV Nilesh Chatbot API...")
    print("Loading sentence-transformers model...")
    print(f"Loading {EMBEDDINGS_FILE}...")
    
    try:
        tweets = load_tweets_with_embeddings()
        print(f"Loaded {len(tweets)} tweets with embeddings")
    except Exception as e:
        print(f"Warning: Could not load embeddings: {e}")
        print("Make sure to run embed_tweets.py first")
    
    app.run(host='0.0.0.0', port=5000, debug=True)
