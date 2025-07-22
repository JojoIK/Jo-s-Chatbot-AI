// Database seeding

const { prisma, helpers } = require("../config/database");
const logger = require("../utils/logger");

async function main() {
    logger.info('Starting database seeding')

    await helpers.transaction(async (tx) => {
        // Clear existing data(exert caution during production)
        await tx.analytics.deleteMany({})
        await tx.intentExample.deleteMany({})
        await tx.message.deleteMany({})
        await tx.session.deleteMany({})
        await tx.user.deleteMany({})
        await tx.intent.deleteMany({})
        await tx.entity.deleteMany({})
        await tx.conversationFlow.deleteMany({})
        await tx.configuration.deleteMany({})

        // seed entites
        const entities = [
            {
                name: 'person',
                type: 'text',
                values: ['John', 'Jane', 'Admin', 'Support'],
                synonyms: {
                    'John': ['john', 'JOHN', 'Johnny'],
                    'Jane': ['jane', 'JANE', 'Janie'],
                    'Admin': ['admin', 'administrator', 'root'],
                    'Support': ['support', 'help', 'assistance']
                }
            },
            {
                name: 'emotion',
                type: 'text',
                values: ['happy', 'sad', 'angry', 'excited', 'confused'],
                synonyms: {
                    'happy': ['joy', 'glad', 'pleased', 'delighted'],
                    'sad': ['unhappy', 'depressed', 'down', 'upset'],
                    'angry': ['mad', 'furious', 'annoyed', 'irritated'],
                    'excited': ['thrilled', 'pumped', 'enthusiastic'],
                    'confused': ['lost', 'puzzled', 'bewildered']
                }
            },
            {
                name: 'product',
                type: 'text',
                values: ['laptop', 'phone', 'tablet', 'headphones', 'keyboard'],
                synonyms: {
                    'laptop': ['computer', 'notebook', 'pc'],
                    'phone': ['smartphone', 'mobile', 'cell'],
                    'tablet': ['ipad', 'android tablet'],
                    'headphones': ['earphones', 'earbuds', 'headset'],
                    'keyboard': ['keys', 'keypad']
                }
            },
            {
                name: 'time',
                type: 'datetime',
                values: ['today', 'tomorrow', 'yesterday', 'now', 'later'],
                synonyms: {
                    'today': ['this day', 'currently'],
                    'tomorrow': ['next day', 'the following day'],
                    'yesterday': ['previous day', 'the day before'],
                    'now': ['right now', 'at this moment'],
                    'later': ['afterwards', 'in a while']
                }
            }
        ]

        for (const entity of entities) {
            await tx.entity.create({ data: entity })
        }

        // Seed intents
        const intents = [
            {
                name: 'greeting',
                description: 'User greets the chatbot',
                patterns: ['hello', 'hi', 'hey', 'good morning', 'good afternoon', 'good evening'],
                responses: [
                    'Hello! How can I help you today?',
                    'Hi there! What can I do for you?',
                    'Hey! How are you doing?',
                    'Good to see you! How can I assist?'
                ],
                entities: ['person', 'emotion'],
                priority: 10
            },
            {
                name: 'goodbye',
                description: 'User says goodbye',
                patterns: ['bye', 'goodbye', 'see you', 'farewell', 'take care'],
                responses: [
                    'Goodbye! Have a great day!',
                    'See you later!',
                    'Take care!',
                    'Thanks for chatting with me!'
                ],
                entities: [],
                priority: 10
            },
            {
                name: 'help',
                description: 'User asks for help',
                patterns: ['help', 'what can you do', 'how does this work', 'I need help'],
                responses: [
                    'I can help you with various tasks. What would you like to know?',
                    'I\'m here to assist you! What do you need help with?',
                    'Feel free to ask me anything. How can I help?'
                ],
                entities: ['product'],
                priority: 8
            },
            {
                name: 'product_inquiry',
                description: 'User asks about products',
                patterns: ['tell me about', 'what is', 'information about', 'details of'],
                responses: [
                    'I can provide information about our products. What specific product are you interested in?',
                    'Which product would you like to know more about?',
                    'I have details about various products. What catches your interest?'
                ],
                entities: ['product'],
                priority: 7
            },
            {
                name: 'weather',
                description: 'User asks about weather',
                patterns: ['weather', 'temperature', 'forecast', 'is it raining', 'sunny'],
                responses: [
                    'I\'m sorry, I don\'t have access to current weather data. You might want to check a weather app or website.',
                    'For weather information, I\'d recommend checking your local weather service.',
                    'I can\'t provide weather updates, but there are many great weather apps available!'
                ],
                entities: ['time'],
                priority: 5
            },
            {
                name: 'small_talk',
                description: 'General conversation',
                patterns: ['how are you', 'what\'s up', 'how\'s it going', 'what\'s new'],
                responses: [
                    'I\'m doing well, thank you for asking! How are you?',
                    'I\'m great! Ready to help with whatever you need.',
                    'All good on my end! What brings you here today?'
                ],
                entities: ['emotion'],
                priority: 3
            },
            {
                name: 'fallback',
                description: 'Default response when intent is not recognized',
                patterns: ['*'],
                responses: [
                    'I\'m not sure I understand. Could you please rephrase that?',
                    'I didn\'t quite catch that. Can you try asking in a different way?',
                    'Sorry, I\'m not sure how to help with that. Could you be more specific?'
                ],
                entities: [],
                priority: 1
            }
        ]

        for (const intent of intents) {
            const createdIntent = await tx.intent.create({ data: intent })
            // Create examples for each intent
            const examples = intents.patterns.map(pattern => ({
                intentId: createdIntent.id,
                text: pattern,
                entities: []
            }))
            await tx.intentExample.createMany({ data: examples })
        }

        // Seed conversation flows
        const conversationFlows = [
            {
                name: 'product_support',
                description: 'Flow for handling product support requests',
                steps: [
                    {
                        id: 'identify_product',
                        type: 'ask',
                        message: 'Which product do you need help with?',
                        entities: ['product'],
                        next: 'identify_issue'
                    },
                    {
                        id: 'identify_issue',
                        type: 'ask',
                        message: 'What issue are you experiencing?',
                        entities: ['problem_type'],
                        next: 'provide_solution'
                    },
                    {
                        id: 'provide_solution',
                        type: 'response',
                        message: 'Here are some solutions for your issue...',
                        next: 'end'
                    }
                ],
                conditions: {
                    trigger_intents: ['help', 'product_inquiry'],
                    required_entities: ['product']
                }
            },
            {
                name: 'greeting_flow',
                description: 'Initial greeting and user onboarding',
                steps: [
                    {
                        id: 'welcome',
                        type: 'response',
                        message: 'Welcome! I\'m here to help you with any questions.',
                        next: 'ask_help'
                    },
                    {
                        id: 'ask_help',
                        type: 'ask',
                        message: 'What can I help you with today?',
                        entities: ['help_topic'],
                        next: 'route_to_flow'
                    }
                ],
                conditions: {
                    trigger_intents: ['greeting'],
                    context_conditions: { is_new_session: true }
                }
            }
        ]

        for (const flow of conversationFlows) {
            await tx.conversationFlow.create({ data: flow })
        }

        // Seed Configuration 
        const configurations = [
            {
                key: 'default_confidence_threshold',
                value: 0.7,
                description: 'Minimum confidence score for intent recognition'
            },
            {
                key: 'session_timeout_minutes',
                value: 30,
                description: 'Session timeout in minutes'
            },
            {
                key: 'max_context_messages',
                value: 10,
                description: 'Maximum number of messages to keep in context'
            },
            {
                key: 'enable_sentiment_analysis',
                value: true,
                description: 'Enable sentiment analysis for messages'
            },
            {
                key: 'fallback_responses',
                value: [
                    'I\'m not sure I understand. Could you please rephrase that?',
                    'I didn\'t quite catch that. Can you try asking in a different way?',
                    'Sorry, I\'m not sure how to help with that. Could you be more specific?'
                ],
                description: 'Default fallback responses'
            },
            {
                key: 'supported_languages',
                value: ['en', 'es', 'fr'],
                description: 'List of supported languages'
            }
        ]

        for (const config of configurations) {
            await tx.configuration.create({ data: config })
        }

        // Create sample user + session
        const sampleUser = await tx.user.create({
            data: {
                email: 'demo@example.com',
                username: 'demo_user'
            }
        })

        const sampleSession = await tx.session.create({
            data: {
                userId: sampleUser.id,
                sessionId: 'demo_session_001',
                context: {
                    user_name: 'Demo user',
                    conversation_stage: 'greeting',
                    last_intent: 'greeting'
                }
            }
        })

        const sampleMessages = [
            {
                sessionId: sampleSession.id,
                userId: sampleUser.id,
                content: 'Hello!',
                type: 'USER',
                intent: 'greeting',
                entities: [],
                confidence: 0.95,
                response: 'Hello! How can I help you today?',
                metadata: {
                    processing_time: 120,
                    model_version: '1.0'
                }
            },
            {
                sessionId: sampleSession.id,
                userId: sampleUser.id,
                content: 'Hello! How can I help you today?',
                type: 'BOT',
                intent: 'greeting',
                entities: [],
                confidence: 0.95,
                metadata: {
                    response_time: 50,
                    template_used: 'greeting_response_1'
                }
            },
            {
                sessionId: sampleSession.id,
                userId: sampleUser.id,
                content: 'I need help with my laptop',
                type: 'USER',
                intent: 'product_inquiry',
                entities: [{ type: 'product', value: 'laptop', confidence: 0.9 }],
                confidence: 0.88,
                response: 'I can help you with laptop-related questions. What specific issue are you experiencing?',
                metadata: {
                    processing_time: 180,
                    entities_extracted: 1
                }
            }
        ]

        for (const message of sampleMessages) {
            await tx.message.create({ data: message })
        }

        const analyticData = [
            {
                sessionId: sampleSession.id,
                event: 'session_started',
                data: {
                    user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    ip_address: '192.168.1.1',
                    referrer: 'https://example.com'
                }
            },
            {
                sessionId: sampleSession.id,
                event: 'message_sent',
                data: {
                    message_length: 6,
                    intent: 'greeting',
                    confidence: 0.95
                }
            },
            {
                sessionId: sampleSession.id,
                event: 'intent_recognized',
                data: {
                    intent: 'greeting',
                    confidence: 0.95,
                    processing_time: 120
                }
            },
            {
                sessionId: sampleSession.id,
                event: 'response_generated',
                data: {
                    response_length: 30,
                    template_used: 'greeting_response_1',
                    generation_time: 50
                }
            }
        ]

        for (const analytics of analyticData) {
            await tx.analytics.create({ data: analytics })
        }

        logger.info('Seeding completed')
        logger.info('Summary: ')
        logger.info(` - ${entities.length} entities`)
        logger.info(` - ${intents.length} intents`)
        logger.info(` - ${conversationFlows.length} flows`)
        logger.info(` - ${configurations.length} config items`)
        logger.info(' - 1 sample user, 1 session')
        logger.info(` - ${sampleMessages.length} messages`)
        logger.info(` - ${analyticData.length} analytics events`)
    })

    main().catch((e) => {
        logger.error('Seeding error:', e)
        process.exit(1)
    })
}