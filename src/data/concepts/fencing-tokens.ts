import type { Concept } from './types'

const concept: Concept = {
  slug: 'fencing-tokens',
  title: 'Fencing Tokens',
  number: 29,
  category: 'Distributed Systems',
  icon: 'pi pi-key',
  summary: 'Stale Lock Prevention - stopping a client that thinks it still holds a lock from doing damage after it does not.',
  readTimeMinutes: 6,
  blocks: [
    {
      type: 'usedIn',
      items: ['Google Chubby lock service', 'ZooKeeper-based distributed locks', 'Kubernetes leader election'],
    },
    {
      type: 'paragraph',
      text:
        'Distributed locks look simple - acquire, do work, release - but the "acquire" step lies to you in one important way: holding a lock only guarantees exclusivity for as long as the lock service believes you are still alive. A client that pauses for too long can lose its lock without ever finding out in time to stop what it was doing.',
    },
    {
      type: 'heading',
      text: 'The Stale-Lock Problem',
    },
    {
      type: 'paragraph',
      text:
        'Client A acquires a distributed lock to write to shared storage, then hits a long GC pause or a network partition that keeps it from sending heartbeats. The lock service, seeing no heartbeat within the timeout, assumes A is dead, expires its lock, and grants the same lock to Client B. B starts writing. Then A\'s pause ends - A resumes execution still believing it holds the lock, because from A\'s own point of view it never released anything - and A also writes to the shared storage. Now A and B are writing concurrently to the same resource, and the data is corrupted, even though "only one client held the lock at a time" according to the lock service\'s own bookkeeping. The bug is that A was never actually notified of losing the lock in a way it could act on before continuing.',
    },
    {
      type: 'heading',
      text: 'The Fix: Monotonic Fencing Tokens',
    },
    {
      type: 'list',
      items: [
        'Every time the lock service grants the lock, it returns a monotonically increasing token (an epoch/version number) along with the grant - each new grant gets a strictly higher number than every previous grant.',
        'The client must attach this token to every write it sends to the protected resource, not just present it once at acquire time.',
        'The resource itself (not the lock service) tracks the highest token it has seen so far, and rejects any incoming write whose token is lower than that - even if the writer legitimately held the lock at some earlier point.',
      ],
    },
    {
      type: 'code',
      language: 'text',
      caption: 'Fencing check at the storage layer',
      code:
        'function handleWrite(request):\n  if request.token < highestTokenSeen:\n    reject("stale lock - a newer holder has already written")\n  highestTokenSeen = max(highestTokenSeen, request.token)\n  applyWrite(request.data)',
    },
    {
      type: 'paragraph',
      text:
        'In the earlier scenario, B is granted token 37 and A was holding token 36. When A\'s delayed write finally arrives carrying token 36, the storage service sees that 36 is less than the 37 it already recorded from B, and rejects A\'s write outright. A\'s pause is now harmless - it can no longer corrupt shared state, even though it never received or processed any explicit "you lost the lock" message.',
    },
    {
      type: 'callout',
      kind: 'mistake',
      title: 'The resource must check the token - the lock service alone cannot enforce this',
      text:
        'A fencing token only works if the thing being protected (the database, the storage service, the file) is the one validating it on every write. If a client that already has direct write access to storage simply writes without passing its token through, or if the storage layer accepts writes without checking them, the token is decoration with no enforcement behind it. This is a common mistake when retrofitting locking onto a system that was not designed for it: teams add a distributed lock around a critical section but never touch the storage layer itself, so the "protection" only holds as long as every client behaves perfectly - which is exactly the assumption fencing tokens exist to remove.',
    },
  ],
  relatedConcepts: ['vector-clocks', 'leader-election'],
}

export default concept
