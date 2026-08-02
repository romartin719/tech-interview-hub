import type { Concept } from './types'

const concept: Concept = {
  slug: 'networking-basics',
  title: 'Networking Basics',
  number: 7,
  category: 'Core Infrastructure',
  icon: 'pi pi-wifi',
  summary: 'TCP/UDP, HTTP/2 vs HTTP/3, DNS, TLS - the plumbing underneath every request.',
  readTimeMinutes: 9,
  blocks: [
    {
      type: 'paragraph',
      text:
        "Every system-design answer eventually rests on a request going over a wire, and the transport it rides on shapes latency, reliability, and failure modes. You don't need to reimplement TCP in an interview, but you do need to know which protocol you're standing on and why, because it explains real production symptoms - a slow mobile client, a stalled page load, a spike in reconnect storms.",
    },
    {
      type: 'table',
      caption: 'TCP vs UDP',
      headers: ['', 'TCP', 'UDP'],
      rows: [
        ['Connection', 'Connection-oriented - 3-way handshake before data flows', 'Connectionless - just send the packet'],
        ['Reliability', 'Guaranteed delivery, retransmits lost packets', 'Best-effort - packets can be lost or arrive out of order'],
        ['Ordering', 'In-order delivery to the application', 'No ordering guarantee'],
        ['Overhead', 'Higher - handshake, ACKs, congestion control', 'Minimal - no handshake, no ACKs'],
        ['Typical use', 'HTTP/1.1, HTTP/2, databases, anything needing correctness', 'DNS queries, video/voice streaming, gaming - speed beats perfect delivery'],
      ],
    },
    {
      type: 'table',
      caption: 'HTTP/1.1 vs HTTP/2 vs HTTP/3',
      headers: ['Version', 'Transport', 'Key idea', 'Weakness it fixes'],
      rows: [
        ['HTTP/1.1', 'TCP', 'One request per connection at a time (pipelining is fragile in practice)', 'N/A - baseline'],
        ['HTTP/2', 'TCP', 'Multiplexes many streams over a single TCP connection', 'Fixes HTTP/1.1 head-of-line blocking at the application layer, but a single lost TCP packet still stalls every stream on that connection'],
        ['HTTP/3', 'QUIC (over UDP)', 'Multiplexed streams built directly on UDP, with per-stream reliability', "Fixes HTTP/2's remaining TCP-level head-of-line blocking - one lost packet only blocks the stream it belongs to"],
      ],
    },
    {
      type: 'diagram',
      diagram: {
        title: 'DNS Resolution Flow',
        mermaid: `flowchart LR
  client[Browser]:::client
  resolver["Recursive Resolver\n(ISP / 8.8.8.8)"]:::edge
  root["Root Nameserver"]:::compute
  tld["TLD Nameserver (.com)"]:::compute
  auth["Authoritative Nameserver"]:::database
  client -->|"1. lookup example.com"| resolver
  resolver -->|"2. who handles .com?"| root
  root -->|"3. ask TLD server"| resolver
  resolver -->|"4. who handles example.com?"| tld
  tld -->|"5. ask authoritative NS"| resolver
  resolver -->|"6. resolve"| auth
  auth -->|"7. IP address"| resolver
  resolver -->|"8. IP address"| client`,
      },
    },
    {
      type: 'heading',
      text: 'TLS Handshake',
    },
    {
      type: 'list',
      items: [
        'Purpose: encrypt the connection so a third party cannot read or tamper with traffic, and authenticate the server\'s identity via its certificate (mutual TLS additionally authenticates the client).',
        'Modern TLS 1.3 collapses the handshake to one round trip before the client can send encrypted application data, down from two round trips in TLS 1.2.',
        'TLS session resumption (session tickets) lets a returning client skip most of the handshake on reconnect, which matters a lot for mobile clients that reconnect frequently.',
      ],
    },
    {
      type: 'callout',
      kind: 'tip',
      title: 'Why HTTP/3 matters most on mobile',
      text:
        "On a lossy Wi-Fi or cellular network, TCP's head-of-line blocking means one dropped packet stalls every HTTP/2 stream sharing that connection until it's retransmitted. QUIC's per-stream reliability means a lost packet only stalls the one stream it belongs to, and QUIC also survives IP changes (switching from Wi-Fi to cellular) without a full reconnect, since connections are keyed by a connection ID instead of the IP/port tuple. This is why video and API-heavy mobile apps see the biggest latency wins from HTTP/3.",
    },
  ],
  relatedConcepts: ['cdn', 'load-balancing', 'api-gateway'],
}

export default concept
