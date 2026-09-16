import { MongoClient } from 'mongodb';

if (!process.env.MONGODB_URI) {
  throw new Error('[FATAL] MONGODB_URI environment variable is not set.');
}

const uri     = process.env.MONGODB_URI;
const options = {
  serverSelectionTimeoutMS: 5_000,
  connectTimeoutMS:        10_000,
};

let clientPromise: Promise<MongoClient>;

if (process.env.NODE_ENV === 'development') {
  // Reuse connection across hot-reloads in dev to avoid exhausting connections
  const g = global as typeof globalThis & { _mongoClientPromise?: Promise<MongoClient> };
  if (!g._mongoClientPromise) {
    g._mongoClientPromise = new MongoClient(uri, options).connect();
  }
  clientPromise = g._mongoClientPromise;
} else {
  clientPromise = new MongoClient(uri, options).connect();
}

export default clientPromise;
