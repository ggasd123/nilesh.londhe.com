#!/usr/bin/env node
/**
 * Twitter RAG Chatbot - Creates embeddings for tweets and serves chat API
 * Uses local embedding server on ASUS (nomic-embed-text)
 */

const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');

// Embedding server config (local on ASUS)
const EMBEDDING_SERVER = 'http://asus:8002/v1';
const embeddingsClient = new OpenAI({ 
  baseURL: EMBEDDING_SERVER, 
  apiKey: 'none' 
});

// Configuration
const DATA_DIR = process.env.DATA_DIR || '/tmp/twitter-2024';
const TWEETS_FILE = path.join(DATA_DIR, 'tweets.json');
const EMBEDDINGS_FILE = path.join(DATA_DIR, 'tweet_embeddings.json');
const TOP_K = 5; // Number of similar tweets to retrieve

/**
 * Load tweets from extracted JSON
 */
async function loadTweets() {
  console.log('Loading tweets from', TWEETS_FILE);
  const data = fs.readFileSync(TWEETS_FILE, 'utf8');
  const tweets = JSON.parse(data);
  console.log(`Loaded ${tweets.length} tweets`);
  return tweets;
}

/**
 * Create embeddings for all tweets (batch processing)
 */
async function createEmbeddings(tweets) {
  console.log('Creating embeddings...');
  
  // Check if embeddings already exist
  if (fs.existsSync(EMBEDDINGS_FILE)) {
    console.log('Embeddings already exist, loading...');
    return JSON.parse(fs.readFileSync(EMBEDDINGS_FILE, 'utf8'));
  }

  const embeddings = [];
  const batchSize = 10; // Batch size for API calls

  for (let i = 0; i < tweets.length; i += batchSize) {
    const batch = tweets.slice(i, i + batchSize);
    console.log(`Processing batch ${i / batchSize + 1} of ${Math.ceil(tweets.length / batchSize)}`);

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

      // Save progress
      fs.writeFileSync(EMBEDDINGS_FILE, JSON.stringify(embeddings));
    } catch (error) {
      console.error(`Error creating embeddings for batch ${i}:`, error.message);
    }

    // Rate limiting - be nice to the server
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log(`Created ${embeddings.length} embeddings`);
  return embeddings;
}

/**
 * Find similar tweets using cosine similarity
 */
function findSimilar(queryEmbedding, embeddings, topK = TOP_K) {
  const scores = embeddings.map(tweet => {
    // Cosine similarity
    const dotProduct = queryEmbedding.reduce((sum, val, i) => sum + val * tweet.embedding[i], 0);
    const magA = Math.sqrt(queryEmbedding.reduce((sum, val) => sum + val * val, 0));
    const magB = Math.sqrt(tweet.embedding.reduce((sum, val) => sum + val * val, 0));
    return { tweet, score: dotProduct / (magA * magB) };
  });

  return scores
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map(s => s.tweet);
}

/**
 * Generate chat response using retrieved tweets as context
 */
async function generateResponse(query, similarTweets) {
  const context = similarTweets
    .map(t => `- "${t.text}" (${new Date(t.created_at).toLocaleDateString()})`)
    .join('\n');

  const prompt = `You are a chatbot that responds in the style of @LVNilesh based on their Twitter history.

Here are similar things they've tweeted before:
${context}

Respond to this query in a similar style, tone, and voice. Keep it concise and natural like a tweet or short conversation.

Query: ${query}

Your response:`;

  // Use local Qwen model for response generation
  const response = await fetch('http://asus:8001/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'Qwen3.5-27B',
      messages: [
        { role: 'system', content: 'You are a helpful assistant that responds in the style of a tech entrepreneur who tweets about AI, Bitcoin, stocks, and cloud infrastructure. Keep responses concise and conversational.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 500,
    }),
  });

  const data = await response.json();
  return data.choices[0].message.content;
}

/**
 * Main chat function
 */
async function chat(query) {
  console.log(`Query: ${query}`);

  // Create query embedding
  const queryResponse = await embeddingsClient.embeddings.create({
    model: 'nomic-embed-text',
    input: `search_query: ${query}`,
  });
  const queryEmbedding = queryResponse.data[0].embedding;

  // Load embeddings
  const embeddings = JSON.parse(fs.readFileSync(EMBEDDINGS_FILE, 'utf8'));

  // Find similar tweets
  const similar = findSimilar(queryEmbedding, embeddings);
  console.log(`Found ${similar.length} similar tweets`);

  // Generate response
  const response = await generateResponse(query, similar);
  return response;
}

// Export for use as module or run directly
if (require.main === module) {
  // CLI mode
  const query = process.argv[2] || 'Tell me about yourself';
  chat(query).then(console.log).catch(console.error);
}

module.exports = { chat, loadTweets, createEmbeddings };
