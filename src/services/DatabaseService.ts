import mongoose from 'mongoose';

export class DatabaseService {
  private static instance: DatabaseService;
  private isConnected: boolean = false;

  private constructor() {}

  static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  async connect(): Promise<void> {
    if (this.isConnected) {
      console.log('Database already connected');
      return;
    }

    try {
      const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/moe-console';
      
      await mongoose.connect(mongoUri, {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      });

      this.isConnected = true;
      console.log('✅ Connected to MongoDB successfully');

      mongoose.connection.on('error', (error) => {
        console.error('❌ MongoDB connection error:', error);
        this.isConnected = false;
      });

      mongoose.connection.on('disconnected', () => {
        console.log('⚠️ MongoDB disconnected');
        this.isConnected = false;
      });

    } catch (error) {
      console.error('❌ Failed to connect to MongoDB:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (!this.isConnected) {
      return;
    }

    try {
      await mongoose.disconnect();
      this.isConnected = false;
      console.log('✅ Disconnected from MongoDB');
    } catch (error) {
      console.error('❌ Error disconnecting from MongoDB:', error);
      throw error;
    }
  }

  getConnectionStatus(): boolean {
    return this.isConnected && mongoose.connection.readyState === 1;
  }

  async healthCheck(): Promise<{
    status: 'connected' | 'disconnected' | 'error';
    details: string;
  }> {
    try {
      if (!this.isConnected) {
        return {
          status: 'disconnected',
          details: 'Not connected to database'
        };
      }

      // Test the connection with a simple operation
      await mongoose.connection.db.admin().ping();
      
      return {
        status: 'connected',
        details: `Connected to ${mongoose.connection.name} database`
      };
    } catch (error) {
      return {
        status: 'error',
        details: `Database error: ${error}`
      };
    }
  }
} 