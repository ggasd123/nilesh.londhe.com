#!/usr/bin/env node
/**
 * Create embeddings for tweets on ASUS
 * Uses local embedding server at http://localhost:8002
 */

const fs = require('fs');
const path = require('path');
const OpenAI = require('openai');

// Use local embedding server
const embeddingsClient = new OpenAI({ 
  baseURL: 'http://localhost:8002/v1', 
  apiKey: 'none' 
});

const DATA_DIR = '/home/cloudgenius/mynix/chatbot-data';
const TWEETS_FILE = path.join(DATA_DIR, 'tweets.json');
const EMBEDDINGS_FILE = path.join(DATA_DIR, 'tweet_embeddings.json');

async function main() {
  console.log('Loading tweets...');
  const tweets = JSON.parse(fs.readFileSync(TWEETS_FILE, 'utf8'));
  console.log(`Loaded ${tweets.length} tweets`);

  // Filter to most recent 20k tweets (already sorted by date descending)
  const recentTweets = tweets.slice(0, 20000);
  console.log(`Processing ${recentTweets.length} most recent tweets`);

  const embeddings = [];
  const batchSize = 20;

  for (let i = 0; i < recentTweets.length; i += batchSize) {
    const batch = recentTweets.slice(i, i + batchSize);
    const progress = Math.round((i / recentTweets.length) * 100);
    console.log(`Progress: ${progress}% (${i}/${recentTweets.length})`);

    const texts = batch.map(t => `search_document: ${t.text}`);
    
    try {
      const response = await embeddingsClient.embeddings.create({
        model: 'nomic-embed-text',
        input: texts,
      });

      batch.forEach((tweet, idx) => {
        embeddings.push({
          id: tweet.id,
          text: tweet.text,
          created_at: tweet.created_at,
          embedding: response.data[idx].embedding,
        });
      });

      // Save progress every batch
      fs.writeFileSync(EMBEDDINGS_FILE, JSON.stringify(embeddings));

    } catch (error) {
      console.error(`Error at batch ${i}:`, error.message);
      process.exit(1);
    }

    // Small delay to avoid overwhelming the server
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  console.log(`✅ Created ${embeddings.length} embeddings`);
  console.log(`Saved to: ${EMBEDDINGS_FILE}`);
  
  // Show sample
  const sample = embeddings[0];
  console.log('\nSample embedding:');
  console.log(`ID: ${sample.id}`);
  console.log(`Text: "${sample.text.substring(0, 50)}..."`);
  console.log(`Embedding dimensions: ${sample.embedding.length}`);
}

main().catch(console.error);
