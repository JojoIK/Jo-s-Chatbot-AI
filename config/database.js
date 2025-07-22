// Database configuration
const { PrismaClient } = require("@prisma/client");
const logger = require("../utils/logger");
const { config, isDevelopment } = require("./envConfig");

// Create Prisma client instance
let prisma

// Prisma configuration per environment
const prismaLogLevels = () => {
    const levels = ['error', 'warn']
    if (config.database.logging) {
        if (isDevelopment) levels.push('query', 'info')
    }
    return levels.map(level => ({ emit: 'event', level }))
}

// Initialize Prisma Client with enhanced logging and environment configs
const createPrismaClient = () => {
    if (!prisma) {
        prisma = new PrismaClient({
            datasources: {
                db: {
                    url: config.database.url
                }
            },
            log: prismaLogLevels(),
            errorFormat: isDevelopment ? 'pretty' : 'colorless',
        })

        // Event Listeners
        if (isDevelopment) {
            prisma.$on('query', (e) => {
                logger.debug('Prisma Query', {
                    query: e.query,
                    params: e.params,
                    duration: `${e.duration}ms`
                })
            })
        }

        prisma.$on('error', (e) => {
            logger.error('Prisma Error', e)
        })

        prisma.$on('warn', (e) => {
            logger.warn('Prisma Warning', e.message)
        })

        prisma.$on('info', (e) => {
            logger.info('Prisma Info', e.message)
        })

        // Graceful shutdown
        const disconnect = async () => {
            try {
                await prisma.$disconnect()
                logger.info('Prisma disconnected successfully')
            } catch (error) {
                logger.error('Error during Prisma disconnect', error)
            }
        }

        process.on('SIGINT', async () => {
            await disconnect()
            process.exit(0)
        })

        process.on('SIGTERM', async () => {
            await disconnect()
            process.exit(0)
        })

        process.on('beforeExit', disconnect)

        process.on('unhandledRejection', (reason) => {
            logger.error('Unhandled Promise Rejection', reason)
        })

        process.on('uncaughtException', (error) => {
            logger.error('Uncaught Exception', error)
            process.exit(1)
        })
    }
    return prisma
}

// Database connection health check
const checkDbConnection = async () => {
    try {
        const client = createPrismaClient()
        await client.$queryRaw`SELECT 1`
        logger.info('Database connection established successfully')
        return true
    } catch (error) {
        logger.error('Database connection failed:', error.message)
        return false
    }
}

// Utility for pagination 
const paginate = (page = 1, limit = 10) => {
    return {
        skip: (page - 1) * limit,
        take: limit
    }
}

// Transaction wrapper for grouped DB operations
const transaction = async (callback) => {
    const client = createPrismaClient()
    return client.$transaction(callback)
}

module.exports = {
    get prisma() {
        return createPrismaClient()
    },
    createPrismaClient,
    checkDbConnection,
    helpers: {
        paginate,
        transaction
    }
}