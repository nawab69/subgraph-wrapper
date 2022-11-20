import express, { Request, Response, NextFunction } from 'express'
import expressWs from 'express-ws'
import bodyParser from 'body-parser'
import 'reflect-metadata'
import winston from 'winston'
import expressWinston from 'express-winston'
import http from 'http'
import WebSocket from 'ws'
import BigNumber from 'bignumber.js'
import { SubscriptionClient } from 'subscriptions-transport-ws'
import { ApolloServer } from 'apollo-server-express'
import { split } from 'apollo-link'
import { HttpLink } from 'apollo-link-http'
import { WebSocketLink } from 'apollo-link-ws'
import { fetch } from 'apollo-env'
import { getMainDefinition } from 'apollo-utilities'
import { GraphQLSchema } from 'graphql'
import {
  introspectSchema,
  makeExecutableSchema,
  makeRemoteExecutableSchema,
  mergeSchemas,
} from 'graphql-tools'
import dotenv from 'dotenv'
import { AppDataSource } from './dataSource'
import {
  getMetadataByID,
  getMetadataByTokenURI,
} from './controller/metadata.controller'

dotenv.config()

/**
 * Logging
 */

let loggerColorizer = winston.format.colorize()
let loggerTransport = new winston.transports.Console({
  format: winston.format.combine(
    winston.format.timestamp(),
    loggerColorizer,
    winston.format.ms(),
    winston.format.printf(args => {
      let { level, message, component, timestamp, ms } = args
      return `${timestamp} ${level} ${component} → ${message} ${loggerColorizer.colorize(
        'debug',
        ms
      )}`
    })
  ),
})
let logger = winston
  .createLogger({
    level: 'debug',
    transports: [loggerTransport],
  })
  .child({ component: 'App' })

/**
 * GraphQL context
 */

interface GraphQLContext {
  logger: winston.Logger
}

/**
 * GraphQL schema
 */

const SUBGRAPH_QUERY_ENDPOINT = process.env.SUBGRAPH_QUERY_ENDPOINT
const SUBGRAPH_SUBSCRIPTION_ENDPOINT =
  process.env.SUBGRAPH_SUBSCRIPTION_ENDPOINT

if (!SUBGRAPH_QUERY_ENDPOINT) {
  throw new Error('Environment variable SUBGRAPH_QUERY_ENDPOINT is not set')
}

if (!SUBGRAPH_SUBSCRIPTION_ENDPOINT) {
  throw new Error(
    'Environment variable SUBGRAPH_SUBSCRIPTION_ENDPOINT is not set'
  )
}

const createQueryNodeHttpLink = () =>
  new HttpLink({
    uri: SUBGRAPH_QUERY_ENDPOINT,
    fetch: fetch as any,
  })

const createSchema = async (): Promise<GraphQLSchema> => {
  let httpLink = createQueryNodeHttpLink()
  let remoteSchema = await introspectSchema(httpLink)

  const subscriptionClient = new SubscriptionClient(
    SUBGRAPH_SUBSCRIPTION_ENDPOINT,
    {
      reconnect: true,
    },
    WebSocket
  )

  const wsLink = new WebSocketLink(subscriptionClient)
  const link = split(
    ({ query }) => {
      const { kind, operation } = getMainDefinition(query) as any
      return kind === 'OperationDefinition' && operation === 'subscription'
    },
    wsLink,
    httpLink
  )

  let subgraphSchema = makeRemoteExecutableSchema({
    schema: remoteSchema,
    link,
  })

  let customSchema = `
    extend type Token {
      metadata: TokenMetadata
    }
    type TokenMetadata {
      name: String
      description: String
      image: String
      type: String
      file: String
    }
  `

  const bignum = (value: string) => new BigNumber(value)

  return mergeSchemas({
    schemas: [subgraphSchema, customSchema],
    resolvers: {
      Token: {
        metadata: {
          fragment: `
            ... on Token {
              id
              tokenURI
            }
          `,
          resolve: async (token, _args, _context, _info) => {
            const metadata = await getMetadataByID(token.id)
            if (!metadata) {
              return await getMetadataByTokenURI(token.id, token.tokenURI)
            }
            return metadata
          },
        },
      },
    },
  })
}

/**
 * Server application
 */

// Define the middleware
const rejectBadHeaders = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (
    req.headers['challenge-bypass-token'] ||
    req.headers['x_proxy_id']
    // Note: This one doesn't work on Google Cloud:
    // req.headers["via"]
  ) {
    return res.status(400).send('Bad Request')
  } else {
    next()
  }
}

const run = async () => {
  logger.info(`Create application`)
  const { app } = expressWs(express())
  app.use(rejectBadHeaders)
  app.use(bodyParser.json())
  app.use(bodyParser.urlencoded({ extended: true }))
  app.use(
    expressWinston.logger({
      level: 'debug',
      transports: [loggerTransport],
      baseMeta: { component: 'Server' },
    })
  )
  app.use(
    expressWinston.errorLogger({
      transports: [loggerTransport],
      baseMeta: { component: 'Server' },
    })
  )

  logger.info(`Create Apollo server`)
  const apolloServer = new ApolloServer({
    subscriptions: {
      path: '/',
    },
    schema: await createSchema(),
    introspection: true,
    playground: true,
    context: async ({ req }: any): Promise<GraphQLContext> => {
      return {
        logger: logger.child({ component: 'ApolloServer' }),
      }
    },
  })

  logger.info(`Install GraphQL request handlers`)
  apolloServer.applyMiddleware({
    app,
    path: '/',
    cors: {
      origin: '*',
    },
  })

  logger.info(`Create HTTP server`)
  const server = http.createServer(app)

  logger.info(`Install GraphQL subscription handlers`)
  apolloServer.installSubscriptionHandlers(server)

  logger.info(`Start server`)

  const PORT = process.env.PORT || 4000
  try {
    await server.listen(PORT, () => {
      logger.info('Listening on port ' + PORT)
    })
  } catch (e) {
    logger.error(`Server crashed:`, e)
    process.exitCode = 1
  }
}

AppDataSource.initialize()
  .then(() => {
    logger.info(`AppDataSource initialized`)
    run()
  })
  .catch(e => {
    logger.error(`Failed to initialize data source:`, e)
    process.exitCode = 1
  })
