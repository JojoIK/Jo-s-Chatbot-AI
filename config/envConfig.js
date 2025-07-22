// Environment variables config
require('dotenv').config();
const { z, ZodError } = require('zod')

// Environment validation schema
const envSchema = z.object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.coerce.number().default(3000),

    // Database
    DATABASE_URL: z.string().url(),
    TEST_DATABASE_URL: z.string().url().optional(),

    // Redis
    REDIS_HOST: z.string().default('localhost'),
    REDIS_PORT: z.coerce.number().default(6379),
    REDIS_PASSWORD: z.string().optional(),
    REDIS_DB: z.coerce.number().default(0),

    // JWT
    JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
    JWT_EXPIRES_IN: z.string().default('24h'),

    // API Configuration
    API_VERSION: z.string().default('v1'),
    API_PREFIX: z.string().default('/api'),

    // Rate limiting
    RATE_LIMIT_WINDOW_MS: z.coerce.number().default(15 * 60 * 1000), // 15 minutes
    RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(100),

    // CORS
    CORS_ORIGIN: z.string().default('*'),
    CORS_METHODS: z.string().default('GET,HEAD,PUT,PATCH,POST,DELETE'),

    // Logging
    LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
    LOG_FORMAT: z.enum(['json', 'simple']).default('json'),

    // NLP Configuration
    NLP_MODEL_PATH: z.string().default('./models/nlp-model.json'),
    NLP_TRAINING_DATA_PATH: z.string().default('./data/training-data.json'),
    NLP_LANGUAGE: z.string().default('en'),
    NLP_SENTIMENT_THRESHOLD: z.coerce.number().default(0.5),

    // Session Management
    SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters'),
    SESSION_TIMEOUT: z.coerce.number().default(30 * 60 * 1000), // 30 minutes

    // Feature Flags
    ENABLE_ANALYTICS: z.coerce.boolean().default(false),
    ENABLE_RICH_RESPONSES: z.coerce.boolean().default(true),
    ENABLE_CONTEXT_MANAGEMENT: z.coerce.boolean().default(true),

    // Security
    BCRYPT_SALT_ROUNDS: z.coerce.number().default(12),
    HELMET_CSP_DIRECTIVES: z.string().optional()
})

// Validate and parse environment variables
let env
try {
    env = envSchema.parse(process.env)
} catch (error) {
    console.error('Environment validation failed: ')
    if (error instanceof ZodError) {
        error.errors.forEach((err) =>
            console.error(` - ${err.path.join('.')}: ${err.message}`)
        )
    } else {
        console.error(error)
    }
    process.exit(1)
}

// Environment-specific configurations
const configurations = {
    development: {
        server: {
            port: env.PORT,
            host: 'localhost',
        },
        database: {
            url: env.DATABASE_URL,
            logging: true,
        },
        redis: {
            host: env.REDIS_HOST,
            port: env.REDIS_PORT,
            password: env.REDIS_PASSWORD,
            db: env.REDIS_DB,
            retryDelayOnFailover: 100,
            maxRetriesPerRequest: 3,
        },
        cors: {
            origin: env.CORS_ORIGIN,
            methods: env.CORS_METHODS.split(','),
            credentials: true,
        },
        logging: {
            level: env.LOG_LEVEL,
            format: env.LOG_FORMAT,
            file: {
                enabled: true,
                filename: 'logs/app.log',
                maxSize: '20m',
                maxFiles: '14d'
            }
        }
    },

    production: {
        server: {
            port: env.PORT,
            host: '0.0.0.0',
        },
        database: {
            url: env.DATABASE_URL,
            logging: false,
        },
        redis: {
            host: env.REDIS_HOST,
            port: env.REDIS_PORT,
            password: env.REDIS_PASSWORD,
            db: env.REDIS_DB,
            retryDelayOnFailover: 100,
            maxRetriesPerRequest: 3,
            connectTimeout: 10000,
        },
        cors: {
            origin: env.CORS_ORIGIN !== '*' ? env.CORS_ORIGIN.split(',') : false,
            methods: env.CORS_METHODS.split(','),
            credentials: true,
        },
        logging: {
            level: 'error',
            format: 'json',
            file: {
                enabled: true,
                filename: 'logs/app.log',
                maxSize: '50m',
                maxFiles: '30d'
            }
        }
    },

    test: {
        server: {
            port: env.PORT,
            host: 'localhost',
        },
        database: {
            url: env.TEST_DATABASE_URL || env.DATABASE_URL,
            logging: false,
        },
        redis: {
            host: env.REDIS_HOST,
            port: env.REDIS_PORT,
            password: env.REDIS_PASSWORD,
            db: env.REDIS_DB + 1, // Use different DB for tests
            retryDelayOnFailover: 100,
            maxRetriesPerRequest: 1,
        },
        cors: {
            origin: '*',
            methods: ['GET', 'POST', 'PUT', 'DELETE'],
            credentials: true,
        },
        logging: {
            level: 'error',
            format: 'simple',
            file: {
                enabled: false,
            }
        }
    }
}

const config = configurations[env.NODE_ENV]

module.exports = {
    env,
    config,
    isDevelopment: env.NODE_ENV === 'development',
    isProduction: env.NODE_ENV === 'production',
    isTest: env.NODE_ENV === 'test',

    // Basic
    port: env.PORT,
    nodeEnv: env.NODE_ENV,

    // Auth
    jwtSecret: env.JWT_SECRET,
    jwtExpiresIn: env.JWT_EXPIRES_IN,

    // Session
    sessionSecret: env.SESSION_SECRET,
    sessionTimeout: env.SESSION_TIMEOUT,

    // Feature flags
    features: {
        analytics: env.ENABLE_ANALYTICS,
        richResponses: env.ENABLE_RICH_RESPONSES,
        contextManagement: env.ENABLE_CONTEXT_MANAGEMENT,
    },

    // NLP settings
    nlp: {
        modelPath: env.NLP_MODEL_PATH,
        trainingDataPath: env.NLP_TRAINING_DATA_PATH,
        language: env.NLP_LANGUAGE,
        sentimentThreshold: env.NLP_SENTIMENT_THRESHOLD,
    },

    // Rate limiting
    rateLimit: {
        windowMs: env.RATE_LIMIT_WINDOW_MS,
        max: env.RATE_LIMIT_MAX_REQUESTS,
    },

    // Security
    security: {
        bcryptSaltRounds: env.BCRYPT_SALT_ROUNDS,
        helmetCspDirectives: env.HELMET_CSP_DIRECTIVES,
    }
}