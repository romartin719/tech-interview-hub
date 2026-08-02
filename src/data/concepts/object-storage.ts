import type { Concept } from './types'

const concept: Concept = {
  slug: 'object-storage',
  title: 'Object Storage',
  number: 13,
  category: 'Data & Storage',
  icon: 'pi pi-box',
  summary: 'S3, Presigned URLs - flat key-to-blob storage for files, not rows.',
  readTimeMinutes: 7,
  blocks: [
    {
      type: 'paragraph',
      text:
        'Object storage (S3, Google Cloud Storage, Azure Blob Storage) stores arbitrary blobs of data - images, videos, backups, log archives - as opaque byte streams addressed by a key, not as rows in a database or files in a filesystem tree. The API is deliberately tiny: PUT a key with some bytes, GET a key back, DELETE a key. That simplicity is exactly what lets it scale to effectively unlimited capacity and extreme durability, in exchange for higher per-request latency than a local disk or a database.',
    },
    {
      type: 'table',
      caption: 'Key Properties',
      headers: ['Property', 'What it means'],
      rows: [
        ['Flat namespace', 'Every object lives at a key like `users/42/avatar.png` in one flat bucket - there is no real directory structure. The "folders" you see in a console UI are just a rendering of the `/` characters in key names, not an actual hierarchy the storage engine understands.'],
        ['Virtually unlimited capacity', 'You do not provision size up front the way you would with a disk volume - buckets grow to petabytes without any capacity planning on your part.'],
        ['High durability', 'Every object is replicated synchronously across multiple availability zones (S3 advertises 11 nines of durability), so losing a single disk, rack, or even an entire AZ does not lose data.'],
        ['Higher latency than local disk', 'Every read or write is an HTTP request over the network, typically tens of milliseconds. This makes it wrong for hot, low-latency transactional data (that is what a database or local SSD is for) and right for large, less latency-sensitive blobs.'],
      ],
    },
    {
      type: 'table',
      caption: 'Access Patterns',
      headers: ['Pattern', 'How it works'],
      rows: [
        ['Direct SDK access', 'Your app server holds credentials and calls the storage SDK directly to PUT/GET objects. Simple, but every byte of a large file flows through the app server, doubling bandwidth cost and tying up server memory and connections.'],
        ['Presigned URLs', 'The app server asks the object store to mint a time-limited, cryptographically signed URL that grants permission to upload or download one specific key, then hands that URL to the client. The client then talks directly to the object store - the app server never touches the file bytes at all.'],
      ],
    },
    {
      type: 'diagram',
      diagram: {
        title: 'Presigned Upload Flow',
        mermaid: `flowchart LR
  client[Client]:::client
  app["App Server"]:::compute
  store[("Object Store (S3)")]:::storage
  client -->|"1. Request upload URL for key"| app
  app -->|"2. Return signed URL (no file bytes)"| client
  client -->|"3. PUT file directly"| store
  store -->|"4. 200 OK"| client`,
      },
    },
    {
      type: 'list',
      items: [
        'User-uploaded media - profile photos, videos, attachments in a chat or social app.',
        'Backups and snapshots - database dumps, disaster-recovery copies.',
        'Data lake storage - raw and processed analytics data queried by tools like Athena or Spark directly off object storage.',
        'Static website hosting - HTML/CSS/JS bundles served straight from a bucket, often fronted by a CDN.',
      ],
    },
    {
      type: 'callout',
      kind: 'tip',
      title: 'Presigned URLs are the standard pattern for large uploads',
      text:
        'If every file upload were proxied through your app server, you would pay for that bandwidth twice (client to server, then server to storage) and every in-flight upload would hold open server memory and a connection slot. Presigned URLs let the client talk directly to the object store while your app server only ever handles small, cheap metadata requests - generate the URL, then later record that the object exists. This is the pattern almost every production system uses for anything beyond tiny files, and interviewers will often ask you to draw exactly this flow when a "photo sharing" or "video upload" prompt comes up.',
    },
  ],
  relatedConcepts: ['caching', 'cdn'],
}

export default concept
