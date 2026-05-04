<script setup lang="ts">
import Accordion from 'primevue/accordion'
import AccordionPanel from 'primevue/accordionpanel'
import AccordionHeader from 'primevue/accordionheader'
import AccordionContent from 'primevue/accordioncontent'
import Card from 'primevue/card'
import Tag from 'primevue/tag'

const concepts = [
  {
    name: 'Scalability',
    topics: [
      'Horizontal vs Vertical Scaling',
      'Load Balancing (Round Robin, Least Connections, Consistent Hashing)',
      'Database Sharding (Range, Hash, Directory-based)',
      'Read Replicas & Write-ahead Logs',
      'CDN & Edge Caching',
      'Auto-scaling strategies',
    ],
  },
  {
    name: 'Databases',
    topics: [
      'SQL vs NoSQL trade-offs',
      'CAP Theorem (Consistency, Availability, Partition Tolerance)',
      'ACID vs BASE',
      'Indexing strategies (B-Tree, Hash, Composite)',
      'Database replication (Master-Slave, Multi-Master)',
      'Partitioning vs Sharding',
    ],
  },
  {
    name: 'Caching',
    topics: [
      'Cache-aside, Write-through, Write-behind patterns',
      'Redis vs Memcached',
      'Cache invalidation strategies (TTL, LRU, LFU)',
      'Distributed caching',
      'Cache stampede prevention',
      'Multi-tier caching (L1 local, L2 distributed)',
    ],
  },
  {
    name: 'Messaging & Async',
    topics: [
      'Message Queues (Kafka, RabbitMQ, SQS)',
      'Pub/Sub vs Point-to-Point',
      'Event-driven architecture',
      'Exactly-once vs At-least-once delivery',
      'Dead letter queues',
      'Backpressure handling',
    ],
  },
  {
    name: 'Networking & Protocols',
    topics: [
      'REST vs gRPC vs GraphQL',
      'WebSockets vs Server-Sent Events vs Long Polling',
      'DNS resolution & routing',
      'API Gateway patterns',
      'Rate Limiting (Token Bucket, Leaky Bucket)',
      'Circuit Breaker pattern',
    ],
  },
  {
    name: 'Storage',
    topics: [
      'Block vs Object vs File storage',
      'S3 / Blob storage patterns',
      'Data lake vs Data warehouse',
      'Write-ahead logging',
      'LSM Trees vs B-Trees',
      'Compression strategies',
    ],
  },
]

const designs = [
  { name: 'Design URL Shortener (TinyURL)', difficulty: 'Easy', concepts: ['Hashing', 'Base62', 'Database', 'Caching'] },
  { name: 'Design Rate Limiter', difficulty: 'Easy', concepts: ['Token Bucket', 'Sliding Window', 'Redis'] },
  { name: 'Design Twitter/X Feed', difficulty: 'Medium', concepts: ['Fan-out', 'Caching', 'Timeline Service', 'Pub/Sub'] },
  { name: 'Design Instagram/Photo Sharing', difficulty: 'Medium', concepts: ['CDN', 'Object Storage', 'Feed Generation', 'Sharding'] },
  { name: 'Design Chat System (WhatsApp)', difficulty: 'Medium', concepts: ['WebSockets', 'Message Queue', 'Presence', 'E2E Encryption'] },
  { name: 'Design YouTube/Video Streaming', difficulty: 'Hard', concepts: ['CDN', 'Transcoding', 'Adaptive Bitrate', 'Storage'] },
  { name: 'Design Google Search', difficulty: 'Hard', concepts: ['Web Crawling', 'Inverted Index', 'PageRank', 'Distributed Systems'] },
  { name: 'Design Uber/Ride Sharing', difficulty: 'Hard', concepts: ['Geospatial Index', 'Matching', 'Real-time Tracking', 'Pricing'] },
  { name: 'Design Notification System', difficulty: 'Medium', concepts: ['Push/Pull', 'Priority Queue', 'Rate Limiting', 'Templates'] },
  { name: 'Design Distributed Cache', difficulty: 'Hard', concepts: ['Consistent Hashing', 'Replication', 'Eviction', 'Gossip Protocol'] },
]

const framework = [
  { step: '1', title: 'Requirements Gathering', desc: 'Clarify functional & non-functional requirements. Ask about scale, latency, consistency.' },
  { step: '2', title: 'Capacity Estimation', desc: 'Estimate QPS, storage, bandwidth. Back-of-envelope calculations.' },
  { step: '3', title: 'High-Level Architecture', desc: 'Draw the main components: clients, servers, databases, caches, queues.' },
  { step: '4', title: 'Detailed Design', desc: 'Dive into specific components. Discuss APIs, data models, algorithms.' },
  { step: '5', title: 'Identify Bottlenecks', desc: 'Address single points of failure, scalability limits, and monitoring.' },
]
</script>

<template>
  <div>
    <div class="section-header">
      <h1><i class="pi pi-globe"></i> High Level Design (HLD)</h1>
      <p>System design for large-scale distributed systems</p>
    </div>

    <h2 style="margin-bottom: 1rem">Interview Framework</h2>
    <div class="framework-steps">
      <Card v-for="step in framework" :key="step.step" class="step-card">
        <template #title>
          <span class="step-number">{{ step.step }}</span> {{ step.title }}
        </template>
        <template #content>
          <p>{{ step.desc }}</p>
        </template>
      </Card>
    </div>

    <h2 style="margin: 2rem 0 1rem">Core Concepts</h2>
    <Accordion multiple>
      <AccordionPanel v-for="(concept, i) in concepts" :key="i" :value="String(i)">
        <AccordionHeader>{{ concept.name }}</AccordionHeader>
        <AccordionContent>
          <ul class="concept-list">
            <li v-for="t in concept.topics" :key="t">{{ t }}</li>
          </ul>
        </AccordionContent>
      </AccordionPanel>
    </Accordion>

    <h2 style="margin: 2rem 0 1rem">Must-Practice Design Problems</h2>
    <div class="design-problems">
      <Card v-for="d in designs" :key="d.name" class="problem-card">
        <template #title>
          {{ d.name }}
          <Tag
            :value="d.difficulty"
            :severity="d.difficulty === 'Hard' ? 'danger' : d.difficulty === 'Medium' ? 'warn' : 'success'"
            style="margin-left: 0.5rem; vertical-align: middle"
          />
        </template>
        <template #content>
          <div class="concept-tags">
            <Tag v-for="c in d.concepts" :key="c" :value="c" severity="info" rounded style="margin: 0.25rem" />
          </div>
        </template>
      </Card>
    </div>
  </div>
</template>

<style scoped>
.framework-steps {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 1rem;
  margin-bottom: 1rem;
}

.step-number {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--p-primary-color);
  color: white;
  font-weight: 700;
  font-size: 0.85rem;
  margin-right: 0.5rem;
}

.concept-list {
  padding-left: 1.5rem;
  line-height: 2;
}

.design-problems {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 1rem;
}

.concept-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
}
</style>
