#!/usr/bin/env python3
"""
Create embeddings for tweets using sentence-transformers (local, CPU) and save for RAG chatbot
"""
import json
import os
from typing import List, Dict
import time

# Configuration
INPUT_FILE = '/tmp/tweets_for_chatbot.json'
OUTPUT_FILE = '/Users/stacey/.openclaw/workspace/nilesh.londhe.com/chatbot/tweets_embeddings.json'

# Import sentence-transformers
try:
    from sentence_transformers import SentenceTransformer
    MODEL = SentenceTransformer('all-MiniLM-L6-v2')  # Small, fast, good quality
except ImportError:
    print("Installing sentence-transformers...")
    import subprocess
    subprocess.check_call(['pip3', 'install', '--break-system-packages', 'sentence-transformers'])
    from sentence_transformers import SentenceTransformer
    MODEL = SentenceTransformer('all-MiniLM-L6-v2')

def load_tweets(filepath: str) -> List[Dict]:
    """Load tweets from JSON file"""
    with open(filepath, 'r', encoding='utf-8') as f:
        return json.load(f)

def create_embedding(text: str) -> List[float]:
    """Create embedding using local sentence-transformers"""
    # Clean and truncate text
    text = ' '.join(text.split())  # Normalize whitespace
    text = text[:512]  # MiniLM max length
    
    embedding = MODEL.encode(text, convert_to_numpy=True)
    return embedding.tolist()

def process_tweets_in_batches(tweets: List[Dict], batch_size: int = 32):
    """Process tweets and create embeddings in batches"""
    
    # Load existing embeddings if any
    if os.path.exists(OUTPUT_FILE):
        try:
            with open(OUTPUT_FILE, 'r', encoding='utf-8') as f:
                existing = json.load(f)
            processed_ids = {t['id'] for t in existing}
            print(f"Resuming from {len(existing)} existing embeddings")
            all_tweets = existing
        except:
            processed_ids = set()
            all_tweets = []
    else:
        processed_ids = set()
        all_tweets = []
    
    # Filter unprocessed tweets
    to_process = [t for t in tweets if t['id'] not in processed_ids]
    print(f"Processing {len(to_process)} new tweets...")
    
    for i in range(0, len(to_process), batch_size):
        batch = to_process[i:i + batch_size]
        batch_num = i // batch_size + 1
        total_batches = (len(to_process) - 1) // batch_size + 1
        print(f"Processing batch {batch_num}/{total_batches}...")
        
        for tweet in batch:
            try:
                # Clean text for embedding
                text = tweet['text']
                # Remove URLs and clean up
                text = ' '.join(text.split())  # Normalize whitespace
                text = text[:800]  # Truncate to token limit
                
                embedding = create_embedding(text)
                
                tweet_with_embedding = {
                    'id': tweet['id'],
                    'text': tweet['text'],
                    'created_at': tweet['created_at'],
                    'retweet_count': int(tweet.get('retweet_count', 0) or 0),
                    'favorite_count': int(tweet.get('favorite_count', 0) or 0),
                    'embedding': embedding
                }
                all_tweets.append(tweet_with_embedding)
                
            except Exception as e:
                print(f"Error processing tweet {tweet['id']}: {e}")
                continue
        
        # Save progress after each batch (atomic write)
        temp_file = OUTPUT_FILE + '.tmp'
        with open(temp_file, 'w', encoding='utf-8') as f:
            json.dump(all_tweets, f, ensure_ascii=False)
        os.rename(temp_file, OUTPUT_FILE)
        
        # Small delay to avoid overwhelming the server
        time.sleep(0.1)
    
    print(f"Total embeddings created: {len(all_tweets)}")
    return all_tweets

if __name__ == '__main__':
    print("Loading tweets...")
    tweets = load_tweets(INPUT_FILE)
    print(f"Loaded {len(tweets)} tweets")
    
    print("Creating embeddings via Ollama (nomic-embed-text on ASUS)...")
    process_tweets_in_batches(tweets, batch_size=32)
    
    print(f"Done! Saved to {OUTPUT_FILE}")
