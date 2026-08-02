import type { Concept } from './types'

const concept: Concept = {
  slug: 'distributed-locking',
  title: 'Distributed Locking',
  number: 48,
  category: 'Other Essentials',
  icon: 'pi pi-lock',
  summary: 'Redis, DynamoDB, ZooKeeper - ensuring only one process does a thing at a time, across machines.',
  readTimeMinutes: 8,
  blocks: [
    {
      type: 'paragraph',
      text:
        'A distributed lock lets multiple processes on different machines agree that only one of them may hold a resource at a time - e.g. only one worker should process a given job, or only one instance should run a scheduled task. A single-process mutex will not do; the lock itself has to live somewhere all the machines can see, and that "somewhere" needs to survive a holder crashing without leaving everyone else locked out forever.',
    },
    {
      type: 'table',
      caption: 'Approaches',
      headers: ['Approach', 'How it works', 'Trade-off'],
      rows: [
        ['Redis SETNX + TTL', 'A single SET key value NX PX ttl call atomically acquires the lock only if it does not already exist, with a TTL so it auto-expires.', 'Simple and fast, but a single Redis instance is a single point of failure, and a naive implementation has edge cases around the lock expiring while the holder is still mid-operation.'],
        ['Redlock', 'Acquires the same lock across a majority of several independent Redis instances, intended to tolerate one instance failing.', 'More fault-tolerant on paper, but its correctness under certain clock-drift and process-pause scenarios has been genuinely disputed by distributed-systems researchers - worth knowing this nuance exists, not just the algorithm steps.'],
        ['Database row lock (SELECT ... FOR UPDATE)', 'Takes a row-level lock inside a transaction using infrastructure you already have.', 'Transactional and consistent with the rest of your data, but ties up a DB connection (and a transaction) for the full duration of the locked operation.'],
        ['DynamoDB conditional writes', 'A conditional PutItem/UpdateItem (e.g. "only write if attribute does not exist") acts as an atomic compare-and-set to create/refresh a lock record.', 'Fits naturally if you are already on DynamoDB and need no extra infrastructure, but you own the TTL/expiry and cleanup logic yourself.'],
        ['ZooKeeper / etcd ephemeral nodes', 'A client creates an ephemeral node tied to its session; the node vanishes automatically if the session dies (crash, network partition).', 'Purpose-built for this - clean, automatic release on crash without waiting for a TTL - but it is another piece of coordination infrastructure to run and operate.'],
      ],
    },
    {
      type: 'code',
      language: 'text',
      caption: 'Redis lock acquire / release',
      code:
        `# Acquire (atomic: only succeeds if key does not exist)
SET lock:job-42 client-abc NX PX 30000

# Release (Lua script: only delete if we are still the holder)
if redis.call("GET", KEYS[1]) == ARGV[1] then
  return redis.call("DEL", KEYS[1])
else
  return 0
end`,
    },
    {
      type: 'list',
      items: [
        'Mutual exclusion - at most one client believes it holds the lock at any moment.',
        'Deadlock-freedom - a TTL/expiry so a crashed or hung holder does not lock everyone else out forever.',
        'Safety under a slow/paused holder - the system must not silently assume a holder is still alive just because it has not explicitly released the lock.',
      ],
    },
    {
      type: 'callout',
      kind: 'warning',
      title: 'A lock alone is not enough - fencing tokens',
      text:
        'A distributed lock does not guarantee correctness by itself: a client can be paused (GC pause, network stall, VM suspend) long enough for its lock to expire, then resume and act on the resource believing it still holds the lock. Production distributed locking almost always pairs the lock with a monotonically increasing fencing token, checked by the protected resource itself, so a "zombie" holder acting after expiry gets rejected rather than silently corrupting shared state.',
    },
  ],
  relatedConcepts: ['unique-id-generation', 'consensus-algorithms'],
}

export default concept
