import Redis from 'ioredis';

export const redisPublisher = new Redis(process.env.REDIS_URL);
export const redisSubscriber = new Redis(process.env.REDIS_URL);

export const initRedis = async () => {
  redisSubscriber.subscribe('new-message');
  console.log('Connected to Redis');
};