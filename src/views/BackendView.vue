<script setup lang="ts">
import Accordion from 'primevue/accordion'
import AccordionPanel from 'primevue/accordionpanel'
import AccordionHeader from 'primevue/accordionheader'
import AccordionContent from 'primevue/accordioncontent'
import Card from 'primevue/card'
import Tag from 'primevue/tag'

const categories = [
  {
    name: 'API Design',
    topics: [
      'REST best practices (resource naming, versioning, pagination)',
      'GraphQL schema design and resolvers',
      'gRPC and Protocol Buffers',
      'API authentication (OAuth 2.0, JWT, API Keys)',
      'Rate limiting and throttling',
      'API documentation (OpenAPI/Swagger)',
      'Idempotency and retry patterns',
      'HATEOAS and Richardson Maturity Model',
    ],
  },
  {
    name: 'Databases',
    topics: [
      'Relational database design and normalization (1NF to 3NF)',
      'SQL query optimization (EXPLAIN, indexes, query plans)',
      'Transactions and isolation levels',
      'NoSQL types: Document (MongoDB), Key-Value (Redis), Column (Cassandra), Graph (Neo4j)',
      'Database migration strategies',
      'Connection pooling',
      'N+1 query problem and solutions',
      'Event sourcing and CQRS',
    ],
  },
  {
    name: 'Microservices',
    topics: [
      'Service decomposition strategies',
      'Inter-service communication (sync vs async)',
      'Service discovery and registration',
      'Saga pattern for distributed transactions',
      'Circuit Breaker, Retry, Bulkhead patterns',
      'API Gateway vs Service Mesh',
      'gRPC for internal communication',
      'Distributed tracing (Jaeger, Zipkin)',
    ],
  },
  {
    name: 'Authentication & Security',
    topics: [
      'OAuth 2.0 flows (Authorization Code, Client Credentials)',
      'JWT structure and validation',
      'Session management (stateless vs stateful)',
      'RBAC and ABAC authorization models',
      'Password hashing (bcrypt, Argon2)',
      'OWASP Top 10 vulnerabilities',
      'SQL Injection, XSS, CSRF prevention',
      'Secrets management (Vault, AWS Secrets Manager)',
    ],
  },
  {
    name: 'Caching & Performance',
    topics: [
      'Redis data structures and use cases',
      'Caching patterns (Cache-aside, Write-through, Write-behind)',
      'Cache invalidation strategies',
      'HTTP caching (ETags, Cache-Control)',
      'CDN caching for APIs',
      'Database query caching',
      'Connection pooling and keep-alive',
      'Async processing and job queues',
    ],
  },
  {
    name: 'DevOps & Infrastructure',
    topics: [
      'Docker and containerization',
      'Kubernetes basics (Pods, Deployments, Services)',
      'CI/CD pipelines',
      'Infrastructure as Code (Terraform)',
      'Logging and monitoring (ELK, Prometheus, Grafana)',
      'Blue-green and canary deployments',
      'Health checks and graceful shutdown',
      'Cloud services (AWS/GCP/Azure essentials)',
    ],
  },
  {
    name: 'Messaging & Event-Driven',
    topics: [
      'Kafka architecture (topics, partitions, consumer groups)',
      'RabbitMQ exchanges and queues',
      'Message ordering guarantees',
      'Dead letter queues and retry strategies',
      'Event sourcing patterns',
      'Outbox pattern for reliable publishing',
      'Idempotent consumers',
    ],
  },
  {
    name: 'Testing',
    topics: [
      'Unit testing with mocks and stubs',
      'Integration testing with test containers',
      'Contract testing (Pact)',
      'Load testing (k6, JMeter)',
      'Test pyramid (unit > integration > e2e)',
      'Test database strategies',
      'Property-based testing',
    ],
  },
]

const systemDesignQuestions = [
  { name: 'Design a REST API for an E-commerce platform', difficulty: 'Medium', focus: ['Pagination', 'Auth', 'Rate Limiting'] },
  { name: 'Implement a Job Scheduler', difficulty: 'Hard', focus: ['Cron', 'Distributed Locks', 'Reliability'] },
  { name: 'Design a Logging & Monitoring Pipeline', difficulty: 'Medium', focus: ['ELK', 'Aggregation', 'Alerting'] },
  { name: 'Build an Authentication Service', difficulty: 'Medium', focus: ['OAuth', 'JWT', 'Session'] },
  { name: 'Design a Payment Processing System', difficulty: 'Hard', focus: ['Idempotency', 'Saga', 'Webhooks'] },
  { name: 'Build a Real-time Notification Service', difficulty: 'Medium', focus: ['WebSocket', 'Push', 'Queue'] },
]
</script>

<template>
  <div>
    <div class="section-header">
      <h1><i class="pi pi-server"></i> Backend Interview Prep</h1>
      <p>APIs, databases, microservices, security, and infrastructure</p>
    </div>

    <h2 style="margin-bottom: 1rem">Core Topics</h2>
    <Accordion multiple>
      <AccordionPanel v-for="(cat, i) in categories" :key="i" :value="String(i)">
        <AccordionHeader>{{ cat.name }}</AccordionHeader>
        <AccordionContent>
          <ul class="topic-list">
            <li v-for="t in cat.topics" :key="t">{{ t }}</li>
          </ul>
        </AccordionContent>
      </AccordionPanel>
    </Accordion>

    <h2 style="margin: 2rem 0 1rem">Backend Design Questions</h2>
    <div class="question-grid">
      <Card v-for="q in systemDesignQuestions" :key="q.name">
        <template #title>
          {{ q.name }}
          <Tag
            :value="q.difficulty"
            :severity="q.difficulty === 'Hard' ? 'danger' : q.difficulty === 'Medium' ? 'warn' : 'success'"
            style="margin-left: 0.5rem; vertical-align: middle"
          />
        </template>
        <template #content>
          <div class="focus-tags">
            <Tag v-for="f in q.focus" :key="f" :value="f" severity="info" rounded style="margin: 0.2rem" />
          </div>
        </template>
      </Card>
    </div>
  </div>
</template>

<style scoped>
.topic-list {
  padding-left: 1.5rem;
  line-height: 2;
}

.question-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 1rem;
}

.focus-tags {
  display: flex;
  flex-wrap: wrap;
}
</style>
