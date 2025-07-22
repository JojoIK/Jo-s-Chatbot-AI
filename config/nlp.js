const { NlpManager } = require("node-nlp");
const natural = require("natural");
const sentiment = require("sentiment");
const compromise = require("compromise");
const fs = require('fs/promises');
const logger = require("../utils/logger");
const { env, isDevelopment } = require("./envConfig");


// NLP configuration
const nlpConfig = {
    languages: [env.NLP_LANGUAGE],
    forceNR: true,
    nlu: {
        log: isDevelopment,
        useNoneFeature: true,
        threshold: 0.5
    },
    nlg: {
        log: isDevelopment
    },
    ner: {
        log: isDevelopment,
        threshold: 0.8
    },
    sentiment: {
        log: isDevelopment
    },
    action: {
        log: isDevelopment
    }
}

const createNlpManager = () => {
    const manager = new NlpManager(nlpConfig)
    return manager
}

// Sentiment analyzer configuration
const sentimentAnalyzer = new sentiment()

// Natural language tokenizer
const tokenizer = new natural.WordTokenizer()

// Stemmer for word normalization
const stemmer = natural.PorterStemmer

// Intent categories and their patterns
const intentCategories = {
    greeting: {
        patterns: [
            'hello', 'hi', 'hey', 'good morning', 'good afternoon', 'good evening',
            'greetings', 'howdy', 'what\'s up', 'how are you'
        ],
        entities: [],
        responses: [
            'Hello! How can I help you today?',
            'Hi there! What can I do for you?',
            'Greetings! How may I assist you?',
            'Hello! I\'m here to help. What do you need?'
        ]
    },

    goodbye: {
        patterns: [
            'bye', 'goodbye', 'see you', 'farewell', 'take care', 'have a good day',
            'catch you later', 'until next time', 'so long', 'adios'
        ],
        entities: [],
        responses: [
            'Goodbye! Have a great day!',
            'See you later! Take care!',
            'Farewell! Feel free to come back anytime.',
            'Bye! It was nice talking with you.'
        ]
    },

    help: {
        patterns: [
            'help', 'can you help', 'I need help', 'assist me', 'support',
            'what can you do', 'how does this work', 'instructions'
        ],
        entities: [],
        responses: [
            'I\'m here to help! You can ask me any question and I\'ll do my best to assist you.',
            'I can help you with various tasks. What specific help do you need?',
            'Sure! I\'m designed to assist you. What would you like help with?'
        ]
    },

    question: {
        patterns: [
            'what is', 'who is', 'where is', 'when is', 'why is', 'how is',
            'what are', 'who are', 'where are', 'when are', 'why are', 'how are',
            'tell me about', 'explain', 'describe'
        ],
        entities: ['topic', 'subject'],
        responses: [
            'Let me help you with that question.',
            'I\'ll do my best to answer your question.',
            'That\'s a great question. Let me think about it.'
        ]
    },

    compliment: {
        patterns: [
            'thank you', 'thanks', 'great job', 'well done', 'awesome',
            'you\'re helpful', 'good work', 'excellent', 'amazing'
        ],
        entities: [],
        responses: [
            'You\'re welcome! I\'m glad I could be of help.',
            'Thank you! I appreciate your kind words.',
            'I\'m happy to be of assistance!'
        ]
    },

    complaint: {
        patterns: [
            'this is wrong', 'you\'re not helpful', 'this doesn\'t work',
            'I\'m frustrated', 'this is bad', 'terrible', 'awful'
        ],
        entities: [],
        responses: [
            'I apologize for any inconvenience. Let me try to help you better.',
            'I\'m sorry this isn\'t working as expected. How can I improve?',
            'I understand your frustration. Let me see what I can do to help.'
        ]
    }
}

// Entity definitions 
const entityTypes = {
    person: {
        regex: /\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/g,
        examples: ['John Doe', 'Jane Smith']
    },

    date: {
        regex: /\b\d{1,2}\/\d{1,2}\/\d{4}\b|\b\d{4}-\d{2}-\d{2}\b/g,
        examples: ['12/25/2023', '2023-12-25', 'December 25, 2023']
    },

    time: {
        regex: /\b\d{1,2}:\d{2}(?:\s?[AP]M)?\b/gi,
        examples: ['2:30 PM', '14:30', '2:30pm']
    },

    email: {
        regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
        examples: ['user@example.com', 'john.doe@company.org']
    },

    phone: {
        regex: /\b\d{3}-\d{3}-\d{4}\b|\b\(\d{3}\)\s?\d{3}-\d{4}\b/g,
        examples: ['123-456-7890', '(123) 456-7890']
    },

    number: {
        regex: /\b\d+(?:\.\d+)?\b/g,
        examples: ['123', '45.67', '1000']
    }
}

// Initialize NLP manager with training data
const InitializeNlpManager = async () => {
    const manager = createNlpManager()

    try {
        // Load training data if it exists
        const intentsPath = path.resolve('../training/intents.json')
        const utterancesPath = path.resolve('../training/utterances.json')
        const entitiesPath = path.resolve('../training/entities.json')
        const modelPath = path.resolve(env.NLP_MODEL_PATH)

        let intents = [], utterances = {}, entities = []

        try {
            [intents, utterances, entities] = await Promise.all([
                fs.readFile(intentsPath, 'utf8').then(JSON.parse),
                fs.readFile(utterancesPath, 'utf8').then(JSON.parse),
                fs.readFile(entitiesPath, 'utf8').then(JSON.parse).catch(() => [])
            ])

            // Add intents and entities from training data
            for (const intent of intents) {
                const intentUtterances = utterances[intent.name] || []

                for (const utterance of intentUtterances) {
                    manager.addDocument(env.NLP_LANGUAGE, utterance, intent.name)
                }

                for (const response of intent.responses || []) {
                    manager.addAnswer(env.NLP_LANGUAGE, intent.name, response)
                }
            }

            for (const entity of entities) {
                manager.addNamedEntityText(
                    entity.name,
                    entity.option,
                    entity.languages,
                    entity.texts
                )
            }

            logger.info('Loaded training data from individual files')
        } catch (error) {
            logger.warn('Training files not found or invalid. Using default intents')

            // Default intents
            for (const [intentName, intentData] of Object.entries(intentCategories)) {
                for (const pattern of intentData.patterns) {
                    manager.addDocument(env.NLP_LANGUAGE, pattern, intentName)
                }

                for (const response of intentData.responses) {
                    manager.addAnswer(env.NLP_LANGUAGE, intentName, response)
                }
            }
        }

        // Train the model
        await manager.train()

        // Save the trained model
        try {
            await manager.save(modelPath)
            logger.info('NLP model trained and saved successfully')
        } catch (error) {
            logger.error('Failed to save NLP model:', error.message)
        }

        return manager
    } catch (error) {
        logger.error('Failed to initialize NLP manager:', error.message)
        throw error
    }
}

// Text preprocessing utilities
const preprocessText = (text) => {
    // Convert to lowercase
    let processed = text.toLowerCase()

    // Remove extra whitespace
    processed = processed.replace(/\s+/g, ' ').trim()

    // Remove special characters but keep punctuation for NLP
    processed = processed.replace(/[^\w\s.,!?'-]/g, '')

    return processed
}

// Extract entities from text
const extractentities = (text) => {
    const entities = []

    for (const [entityType, entityConfig] of Object.entries(entityTypes)) {
        const matches = text.match(entityConfig.regex);
        if (matches) {
            for (const match of matches) {
                entities.push({
                    type: entityType,
                    value: match,
                    start: text.indexOf(match),
                    end: text.indexOf(match) + match.length
                })
            }
        }
    }

    return entities
}

// Analyze sentiment
const analyzeSentiment = (text) => {
    const result = sentimentAnalyzer.analyze(text)

    return {
        score: result.score,
        comparative: result.comparative,
        tokens: result.tokens,
        positive: result.positive,
        negative: result.negative,
        label: result.score > env.NLP_SENTIMENT_THRESHOLD ? 'positive' : result.score < -env.NLP_SENTIMENT_THRESHOLD ? 'negative' : 'neutral'
    }
}

// Tokenize text
const tokenizeText = (text) => {
    return tokenizer.tokenize(text)
}

// Stem words
const stemText = (text) => {
    const tokens = tokenizeText(text)
    return tokens.map(token => stemmer.stem(token))
}

// Parse text with compromise
const parseText = (text) => {
    const doc = compromise(text)

    return {
        people: doc.people().out('array'),
        places: doc.places().out('array'),
        organizations: doc.organizations().out('array'),
        topics: doc.topics().out('array'),
        dates: doc.dates().out('array'),
        times: doc.times().out('array'),
        sentences: doc.sentences().out('array'),
        nouns: doc.nouns().out('array'),
        verbs: doc.verbs().out('array'),
        adjectives: doc.adjectives().out('array'),
    }
}

// Get response confidence threshold
const getConfidenceTreshold = () => {
    return isDevelopment ? 0.3 : 0.5
}

module.exports = {
    nlpConfig,
    intentCategories,
    entityTypes,
    createNlpManager,
    InitializeNlpManager,
    preprocessText,
    extractentities,
    analyzeSentiment,
    tokenizeText,
    stemText,
    parseText,
    getConfidenceTreshold,

    // Utility functions
    isGreeting: (intent) => intent === 'greeting',
    isGoodbye: (intent) => intent === 'goodbye',
    isQuestion: (intent) => intent === 'question',
    isComplaint: (intent) => intent === 'complaint',
    isCompliment: (intent) => intent === 'compliment',

    // NLP libraries access
    natural,
    sentiment: sentimentAnalyzer,
    compromise
}