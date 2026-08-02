import scalability from './scalability'
import loadBalancing from './load-balancing'
import cdn from './cdn'
import proxy from './proxy'
import apiGateway from './api-gateway'
import connectionPooling from './connection-pooling'
import networkingBasics from './networking-basics'
import normalizationVsDenormalization from './normalization-vs-denormalization'
import databaseIndexing from './database-indexing'
import databaseSharding from './database-sharding'
import databaseReplication from './database-replication'
import dbQueryComplexity from './db-query-complexity'
import objectStorage from './object-storage'
import writeAheadLog from './write-ahead-log'
import transactionsIsolationLevels from './transactions-isolation-levels'
import caching from './caching'
import rateLimiting from './rate-limiting'
import bloomFilters from './bloom-filters'
import messageQueues from './message-queues'
import realtimeCommunication from './realtime-communication'
import fanOutPatterns from './fan-out-patterns'
import deadLetterQueue from './dead-letter-queue'
import capTheorem from './cap-theorem'
import consistencyModels from './consistency-models'
import consistentHashing from './consistent-hashing'
import leaderElection from './leader-election'
import vectorClocks from './vector-clocks'
import merkleTrees from './merkle-trees'
import fencingTokens from './fencing-tokens'
import eventSourcingCqrs from './event-sourcing-cqrs'
import sagaPattern from './saga-pattern'
import outboxPattern from './outbox-pattern'
import circuitBreaker from './circuit-breaker'
import idempotency from './idempotency'
import retryExponentialBackoff from './retry-exponential-backoff'
import durableExecution from './durable-execution'
import microservicesVsMonolith from './microservices-vs-monolith'
import batchVsStreamProcessing from './batch-vs-stream-processing'
import apiDesign from './api-design'
import serviceDiscovery from './service-discovery'
import authentication from './authentication'
import performanceMetrics from './performance-metrics'
import observability from './observability'
import deploymentReliability from './deployment-reliability'
import backOfEnvelopeEstimation from './back-of-envelope-estimation'
import heartbeatHealthChecks from './heartbeat-health-checks'
import geospatialIndexing from './geospatial-indexing'
import distributedLocking from './distributed-locking'
import uniqueIdGeneration from './unique-id-generation'
import fineDistinctions from './fine-distinctions'

export * from './types'

export const concepts = [
  scalability,
  loadBalancing,
  cdn,
  proxy,
  apiGateway,
  connectionPooling,
  networkingBasics,
  normalizationVsDenormalization,
  databaseIndexing,
  databaseSharding,
  databaseReplication,
  dbQueryComplexity,
  objectStorage,
  writeAheadLog,
  transactionsIsolationLevels,
  caching,
  rateLimiting,
  bloomFilters,
  messageQueues,
  realtimeCommunication,
  fanOutPatterns,
  deadLetterQueue,
  capTheorem,
  consistencyModels,
  consistentHashing,
  leaderElection,
  vectorClocks,
  merkleTrees,
  fencingTokens,
  eventSourcingCqrs,
  sagaPattern,
  outboxPattern,
  circuitBreaker,
  idempotency,
  retryExponentialBackoff,
  durableExecution,
  microservicesVsMonolith,
  batchVsStreamProcessing,
  apiDesign,
  serviceDiscovery,
  authentication,
  performanceMetrics,
  observability,
  deploymentReliability,
  backOfEnvelopeEstimation,
  heartbeatHealthChecks,
  geospatialIndexing,
  distributedLocking,
  uniqueIdGeneration,
  fineDistinctions,
]
