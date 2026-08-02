import type { Concept } from './types'

const concept: Concept = {
  slug: 'authentication',
  title: 'Authentication - JWT and Sessions',
  number: 41,
  category: 'Security & Auth',
  icon: 'pi pi-lock',
  summary: 'JWT, Sessions, OAuth 2.0 - proving who is making a request.',
  readTimeMinutes: 9,
  blocks: [
    {
      type: 'paragraph',
      text:
        'Authentication answers one question on every request: who is this? Almost every system design interview touches it briefly, and the two mechanisms that come up over and over are server-side sessions and client-held JWTs - which are really just two different answers to "where does the proof of identity live between requests."',
    },
    {
      type: 'heading',
      text: 'Session-Based Authentication',
    },
    {
      type: 'paragraph',
      text:
        'On login, the server creates a session and stores it server-side (in-memory, Redis, or a database) keyed by a randomly generated session ID. That ID is handed to the client in a cookie. On every subsequent request, the server looks up the session ID to identify the user and load their state. Sessions are simple to revoke instantly - just delete the session record - but every app instance needs access to the same session store, so they require shared/centralized storage as soon as you run more than one server.',
    },
    {
      type: 'heading',
      text: 'JWT-Based Authentication',
    },
    {
      type: 'paragraph',
      text:
        "A JWT (JSON Web Token) lets the server issue a signed token that contains claims about the user directly - no server-side storage needed. Any server holding the shared signing secret (or public key, for asymmetric signing) can verify the token's signature and trust its contents without a database lookup. This makes JWTs stateless and trivially horizontally scalable, but it comes at a cost: a JWT can't be revoked before its stated expiry without reintroducing server-side state, such as a blocklist of revoked token IDs.",
    },
    {
      type: 'code',
      language: 'text',
      caption: 'JWT Structure: header.payload.signature',
      code:
        'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyMTIzIiwiZXhwIjoxNzM1Njg5NjAwfQ.SflKxwRJSMeKKF2QT4fwpM\n\n// Decoded payload:\n{\n  "sub": "user123",\n  "exp": 1735689600\n}',
    },
    {
      type: 'table',
      caption: 'Session vs JWT',
      headers: ['Aspect', 'Session', 'JWT'],
      rows: [
        ['Revocation', 'Instant - delete the session record', 'Not easily revocable before expiry without extra state (e.g. a blocklist)'],
        ['Server-side storage', 'Required - a shared store (Redis/DB) reachable by every app instance', 'Not required - any server with the signing key can verify the token alone'],
        ['Transport', 'Typically a cookie holding an opaque session ID', 'Typically a bearer token, works well across domains and native/mobile clients'],
      ],
    },
    {
      type: 'heading',
      text: 'Access Tokens + Refresh Tokens',
    },
    {
      type: 'paragraph',
      text:
        "A common pattern combines both worlds: issue a short-lived JWT access token used on every request, which limits the damage window if it is stolen (it simply expires soon). Separately issue a longer-lived refresh token, used only to mint new access tokens, which is stored more carefully (e.g. an httpOnly cookie) and can be revoked server-side, since refresh happens rarely enough that a database check on it doesn't hurt scalability. This gets you JWT's statelessness for the common case (every regular request) and session-like revocability for the rare case (refresh).",
    },
    {
      type: 'diagram',
      diagram: {
        title: 'Access Token + Refresh Token Flow',
        mermaid: `sequenceDiagram
  participant C as Client
  participant A as Auth Server
  participant S as API Server
  C->>A: Login (credentials)
  A->>C: Access token (short-lived) + Refresh token (long-lived)
  C->>S: Request + Access token
  S->>C: Response (no DB lookup needed)
  Note over C,S: ...access token expires...
  C->>A: Refresh token
  A->>A: Check refresh token not revoked
  A->>C: New access token`,
      },
    },
    {
      type: 'paragraph',
      text:
        'OAuth 2.0 is worth naming briefly, though it solves a different problem: delegated authorization, letting a third-party app act on a user\'s behalf without ever seeing their password (the "Sign in with Google" flow). It is not a replacement for sessions or JWTs - a system might use OAuth 2.0 to let a user log in via a third party, and then issue its own session or JWT for that user afterward.',
    },
    {
      type: 'callout',
      kind: 'tip',
      title: '"JWT vs sessions" is really "stateless vs stateful"',
      text:
        "Frame this trade-off as stateless vs stateful rather than as two unrelated technologies - it's the same choice you make everywhere else in distributed systems (see Consistency Models, Scalability). The access-token-plus-refresh-token pattern exists specifically to get most of the benefits of both at once: statelessness for the high-volume path, revocability for the low-volume one.",
    },
  ],
  relatedConcepts: ['api-design', 'rate-limiting', 'consistency-models'],
}

export default concept
