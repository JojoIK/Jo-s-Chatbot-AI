// Winston logger configuration
const winston = require("winston");
const path = require("path");
const fs = require("fs");
const { env, config, isProduction } = require("../config/envConfig");

// Ensure logs directory exists
const logsDir = path.join(process.cwd(), 'logs')
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true })
}

// Custom log levels 
const levels = {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    debug: 4
}

// Color schema for levels
winston.addColors({
    error: 'red',
    warn: 'yellow',
    info: 'green',
    http: 'magneta',
    debug: 'white'
})

// Custom File and JSON formatter
const logFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json(),
    winston.format.prettyPrint()
)

// Console format for development
const consoleFormat = winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp({ format: 'HH:mm:ss' }),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
        const extra = Object.keys(meta).length ? `\n${JSON.stringify(meta, null, 2)}` : ''
        return `${timestamp} [${level}]: ${message}${extra}`
    })
)

// Create transport array based on env
const transports = []

// Winston transports
if (config.logging.file?.enabled) {
    transports.push(
        // Error log file
        new winston.transports.File({
            filename: path.join(logsDir, 'error.log'),
            level: 'error',
            format: logFormat,
            maxsize: 5 * 1024 * 1024, // 5MB
            maxFiles: 5
        }),
        // Combineed log file
        new winston.transports.File({
            filename: path.join(logsDir, 'combined.log'),
            level: 'info',
            format: logFormat,
            maxsize: 5 * 1024 * 1024, // 5MB
            maxFiles: 5
        }),
        // Separate  file for chat interactions
        new winston.transports.File({
            filename: path.join(logsDir, 'chat.log'),
            level: 'info',
            format: logFormat,
            maxsize: 5 * 1024 * 1024, // 5MB
            maxFiles: 5
        })
    )
}

// Add console transport for development
if (!isProduction) {
    transports.push(
        new winston.transports.Console({
            level: 'debug',
            format: consoleFormat
        })
    )
}

// Logger Configuration
const logger = winston.createLogger({
    level: env.LOG_LEVEL || 'info',
    levels,
    format: logFormat,
    defaultMeta: { service: 'chatbot-api' },
    transports,
    exitOnError: false
})

// Exception handling
logger.exceptions.handle(
    new winston.transports.File({
        filename: path.join(logsDir, 'exception.log'),
        format: logFormat
    })
)

logger.rejections.handle(
    new winston.transports.File({
        filename: path.join(logsDir, 'rejections.log'),
        format: logFormat
    })
)


// Custom logging methods
logger.logChatInteraction = (sessionId, message, response, processingTime) => {
    logger.info('Chat Interaction', {
        type: 'CHAT',
        sessionId,
        message: message?.substring(0, 100), // Truncate for privacy
        responseType: response?.type,
        intent: response?.intent,
        confidence: response?.confidence,
        processingTime,
        timestamp: new Date().toISOString()
    })
}

logger.logError = (error, context = {}) => {
    const message = error instanceof Error ? error.message : error
    const stack = error instanceof Error ? error.stack : null
    logger.error('Application Error', {
        type: 'ERROR',
        message,
        stack,
        ...context,
        timestamps: new Date().toISOString()
    })
}

logger.logNLPProcessing = (text, intent, confidence, entities) => {
    logger.info('NLP Processing', {
        type: 'NLP',
        testLength: text?.length,
        intent,
        confidence,
        entitiesCount: entities?.length || 0,
        timestamps: new Date().toISOString()
    })
}

logger.logPerformance = (operation, duration, metadata = {}) => {
    logger.info('Performance Metric', {
        type: 'PERFORMANCE',
        operation,
        duration: `${duration}ms`,
        ...metadata,
        timestamp: new Date().toISOString()
    })
}


logger.logAuth = (event, data = {}) => {
    logger.info('Authentication Event', {
        type: 'AUTH',
        event,
        ...data,
        timestamp: new Date().toISOString()
    })
}

logger.logSecurity = (event, data = {}) => {
    logger.warn('Security Event', {
        type: 'SECURITY',
        event,
        ...data,
        timestamp: new Date().toISOString()
    })
}

// Log on exit 
process.on(`exit`, () => logger.info('Process existing...'))

module.exports = logger