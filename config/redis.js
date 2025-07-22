// Redis configuration for sessions
const Redis = require("ioredis");
const logger = require("../utils/logger");
const { config, env, isProduction } = require('./envConfig')

// Create Redis client 
let redisClient

// Custom retry strategy
const retryStrategy = (times) => {
    const delay = Math.min(times * 100, 2000)
    logger.warn(`Redis retry #${times}, delaying for ${delay}ms`)
    return delay
}

// Redis configuration
const redisConfig = {
    host: config.redis.host,
    port: config.redis.port,
    password: config.redis.password,
    db: config.redis.db,
    retryStrategy,
    maxRetriesPerRequest: config.redis.maxRetriesPerRequest,
    connectTimeout: config.redis.connectTimeout || 10000,
    lazyConnect: true,
    keyPrefix: `chatbot:${env.NODE_ENV}`
}

const createRedisClient = () => {
    if (!redisClient) {
        redisClient = new Redis(redisConfig)

        // Event listeners
        redisClient.on('connect', () => logger.info('Redis client connected'))
        redisClient.on('ready', () => logger.info('Redis client ready'))
        redisClient.on('error', (error) => logger.error(error, { type: 'REDIS' }))
        redisClient.on('close', () => logger.warn('Redis client connection closed'))
        redisClient.on('reconnecting', () => logger.info('Redis client reconnecting...'))
        redisClient.on('end', () => logger.info('Redis client connection ended'))

        // Graceful shutdown 
        const shutdown = async () => {
            logger.info('Shutting down Redis connection...')
            try {
                await redisClient.quit()
                logger.info('Redis client disconnected')
            } catch (error) {
                logger.error('Failed to disconnect Redis client', error)
            } finally {
                process.exit(0)
            }
        }

        process.on('SIGINT', shutdown)
        process.on('SIGTERM', shutdown)
    }

    return redisClient
}

// Session management 
const cleanExpiredSessions = async () => {
    // Create new session
    const client = createRedisClient()
    const pattern = `${redisConfig.keyPrefix}session:*`
    const keys = []

    let cursor = '0'
    do {
        const [nextCursor, scannedKeys] = await client.scan(cursor, 'MATCH', pattern, 'COUNT', 100)
        cursor = nextCursor
        keys.push(...scannedKeys)
    } while (cursor !== '0');

    let cleanedCount = 0
    for (const key of keys) {
        const ttl = await client.ttl(key)
        if (ttl === -1) {
            await client.expire(key, env.SESSION_TIMEOUT / 1000)
        } else if (ttl === -2) {
            cleanedCount++
        }
    }

    logger.info(`Cleaned ${cleanedCount} expired sessions`)
    return cleanedCount
}

const healthCheck = async () => {
    try {
        const client = createRedisClient()
        await client.ping()
        return { status: 'healthy', timestamp: new Date().toISOString() }
    } catch (error) {
        logger.error(error, { type: 'REDIS_HEALTH' })
        return { status: 'unhealthy', error: error.message, timestamp: new Date().toISOString() }
    }
}

const initializeRedis = async () => {
    try {
        const client = createRedisClient()
        await client.connect()
        logger.info('Redis connection initialized successfully')
        return client
    } catch (error) {
        logger.error(error, { type: 'REDIS_INIT' })
        throw error
    }
}

module.exports = {
    redisConfig,
    createRedisClient,
    initializeRedis,
    healthCheck,
    cleanExpiredSessions,
    get client() {
        return createRedisClient()
    }
}



