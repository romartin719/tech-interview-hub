import type { Concept } from './types'

const concept: Concept = {
  slug: 'realtime-communication',
  title: 'WebSocket vs SSE vs Polling',
  number: 20,
  category: 'Communication & Messaging',
  icon: 'pi pi-bolt',
  summary: 'Choosing how a server pushes updates to a client that is already connected.',
  readTimeMinutes: 7,
  blocks: [
    {
      type: 'paragraph',
      text:
        "Once a client is connected, how does the server get new data to it? HTTP was built request-first, so anything that feels like a server \"pushing\" data is really one of a few patterns layered on top. The right choice depends on one question: does the client ever need to send data back on the same connection, and how low does the latency need to be?",
    },
    {
      type: 'table',
      caption: 'The Options',
      headers: ['Approach', 'How it works', 'Trade-off'],
      rows: [
        ['Polling', 'Client repeatedly asks "anything new?" on a fixed interval.', "Simplest to build, but wastes requests when there's nothing new, and updates are delayed by up to the poll interval."],
        ['Long Polling', 'Client asks, and the server holds the request open until there is data (or a timeout), then the client immediately re-asks.', 'Much less wasteful than plain polling and lower latency, but still one HTTP round trip per update and holds server resources per waiting client.'],
        ['SSE (Server-Sent Events)', 'A single long-lived, one-directional HTTP connection the server streams events over; the browser auto-reconnects if it drops.', "Simple, works over plain HTTP/CDN infrastructure, but it's server-to-client only - the client can't send messages back on that connection."],
        ['WebSocket', 'A full bidirectional connection, upgraded from HTTP once, that both sides can send on at any time.', "Most flexible and lowest latency in both directions, but it's a stateful long-lived connection with its own scaling and connection-management story."],
      ],
    },
    {
      type: 'diagram',
      diagram: {
        title: 'Long-Lived Connection Pinning',
        mermaid: `flowchart LR
  client[Client]:::client
  lb["Load Balancer"]:::edge
  s1["Server A"]:::compute
  s2["Server B"]:::compute
  pubsub[("Redis Pub/Sub")]:::cache
  client -->|"1. WS connect"| lb
  lb -->|"2. pinned"| s1
  s2 -->|"3. publish event"| pubsub
  pubsub -->|"4. deliver to A"| s1
  s1 -->|"5. push over open socket"| client`,
      },
    },
    {
      type: 'heading',
      text: 'Decision Rules',
    },
    {
      type: 'list',
      items: [
        'Need client-to-server messages on the same channel, or very low latency in both directions (chat input, multiplayer games, collaborative editing) -> WebSocket.',
        'Only need server-to-client push, and want to stay on plain HTTP so it rides through existing CDN/proxy/load-balancer infra with no special handling -> SSE.',
        "Updates are occasional and simplicity beats elegance, or you don't control the client well enough to guarantee WebSocket support -> polling is genuinely fine.",
      ],
    },
    {
      type: 'callout',
      kind: 'warning',
      title: 'WebSocket scaling is a connection problem, not just a traffic problem',
      text:
        "A WebSocket is a long-lived connection pinned to one specific server instance - that server, not just that service, is holding the socket. Scaling horizontally then needs either sticky routing at the load balancer (same client always lands on the same instance) or a shared pub/sub layer (e.g. Redis) so that when Server B needs to push an update to a client connected to Server A, it can publish the event and have A deliver it over the socket it's holding. Skipping this is the most common reason a WebSocket feature that works in dev silently drops messages once traffic is spread across multiple instances.",
    },
    {
      type: 'callout',
      kind: 'tip',
      title: 'Most "real-time" features never need bidirectional',
      text:
        "Chat message delivery, live sports scores, and notification badges all feel like they need a WebSocket, but the client almost never sends data back on that same channel - sending a chat message is a normal POST, only *receiving* new messages is push. SSE covers that server-to-client-only shape with far less operational overhead, and it's worth defaulting to it before reaching for a full WebSocket.",
    },
  ],
  relatedConcepts: ['message-queues', 'load-balancing', 'fan-out-patterns'],
}

export default concept
