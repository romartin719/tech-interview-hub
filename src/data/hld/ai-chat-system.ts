import type { HLDTopic } from './types'

const topic: HLDTopic = {
  slug: 'ai-chat-system',
  title: 'AI Chat System (ChatGPT / Claude)',
  difficulty: 'Advanced',
  icon: 'pi pi-sparkles',
  color: '#6d28d9',
  readTimeMinutes: 32,
  topics: ['LLM Inference Serving', 'Continuous Batching & KV Cache', 'Token Streaming'],
  companies: ['OpenAI', 'Anthropic', 'Google DeepMind'],
  prerequisites: ['Rate Limiter', 'Message Queues', 'Caching'],
  summary:
    'An AI chat system routes a user prompt plus reconstructed conversation history to a fleet of GPU inference servers running continuous batching, streams generated tokens back over Server-Sent Events as they are produced, and enforces per-tier token quotas, moderation, and capacity-aware queueing around a stateless LLM that itself has no memory of anything.',

  understandingProblem:
    "This is not \"design an LLM\" - the model weights are a black box you call into. The interesting systems problem is everything AROUND the model: the model itself is stateless and remembers nothing between calls, it runs on a GPU that costs roughly $2-5/hour to rent and can only usefully serve a handful of users at once if you are naive about scheduling, and generating a single response takes anywhere from 1 to 30+ seconds token-by-token. So you need a system that fakes \"memory\" by replaying conversation history on every turn, keeps expensive GPUs busy across thousands of concurrent users instead of one at a time, streams partial output to the user immediately instead of making them stare at a blank screen, and gracefully degrades - queueing, load-shedding, or downgrading to a smaller model - the moment demand exceeds the GPU capacity you actually have, which for every major LLM provider is a real and recurring constraint, not a hypothetical one.",
  realExamples:
    'ChatGPT: reported by OpenAI to have crossed 800M+ weekly active users and over 1B messages/day by 2025. Claude (Anthropic): 200K-token context window on Claude 3+ models, with some enterprise tiers offering 1M-token context. GPT-4 Turbo / GPT-4o: 128K-token context window. Anthropic and OpenAI both publicly return HTTP 529/"overloaded" style errors during demand spikes rather than silently failing - a real, well-known capacity-management failure mode for this exact product category.',

  naiveFirstCut: {
    diagram: {
      mermaid: `flowchart LR
  client[Client]:::client
  server["App Server<br/>calls model.generate() synchronously"]:::compute
  gpu["1 GPU<br/>1 model instance"]:::compute
  client -->|"1. POST message, wait..."| server
  server -->|"2. Blocking call"| gpu
  gpu -->|"3. Full response after 15s"| server
  server -->|"4. Return whole reply"| client`,
    },
    whyThisBreaks: [
      'One GPU, one request at a time - while the model is decoding token 40 of user A\'s reply, the GPU sits mostly idle waiting on memory bandwidth, and user B\'s request just queues behind it instead of sharing the same GPU pass. At 20 tokens/sec and 500-token replies, that is 25 seconds of a $3/hour GPU serving exactly one human.',
      'No streaming - the HTTP handler blocks until generation fully finishes, so a 25-second reply means 25 seconds of a blank spinner. Users bail, and the request occupies a server thread/connection the entire time for no visible progress.',
      'No conversation memory - the model call is stateless. Ask a follow-up like "what about the second one?" and the model has zero idea what "the second one" refers to unless you resend the entire prior conversation as part of the prompt every single time.',
      'No context limit handling - a chat that runs long (50+ turns) eventually exceeds the model\'s fixed context window (e.g. 128K tokens). The naive approach just sends everything and gets a hard API error back, killing the conversation.',
      'No backpressure - when traffic spikes (e.g. a viral moment), every request still tries to grab its own GPU slot. With no queue, no rate limits, and no batching, GPUs fall over or requests time out en masse instead of degrading gracefully.',
    ],
    closingNote:
      'The fix is not "buy more GPUs" - it is to stop treating GPU inference like a stateless CPU call and start treating it like a scarce, shared, streamable resource: queue requests, stream tokens as they are produced, and batch many users onto the same GPU pass. Everything else (history, quotas, moderation, capacity routing) gets layered around that core loop.',
  },

  priorArt: [
    {
      title: 'vLLM / PagedAttention (UC Berkeley, LMSYS)',
      description:
        'Introduced PagedAttention, borrowing OS virtual-memory paging for the KV cache, cutting cache memory waste from the 60-80% typical of naive allocators down to under 4%. Backing the LMSYS Chatbot Arena, it let them cut GPU count by half while serving an average of 30K and peak of 60K requests/day. (vLLM project blog)',
      link: 'https://blog.vllm.ai/2023/06/20/vllm.html',
    },
    {
      title: 'OpenAI ChatGPT Infrastructure',
      description:
        'Publicly describes routing chat completions to a GPU fleet behind a queueing layer, streaming tokens via SSE, and applying moderation classifiers on both input and output; well documented "ChatGPT is at capacity" errors during the GPT-4 launch window are a public case study in demand exceeding provisioned GPU capacity. (OpenAI engineering communications)',
      link: 'https://openai.com/index/gpt-4-research/',
    },
    {
      title: 'Anthropic Claude API',
      description:
        'Publishes explicit `overloaded_error` (HTTP 529) responses distinct from rate-limit errors (429), separating "you personally are over quota" from "we as a service are out of capacity right now" - a distinction most naive designs collapse into one error code. (Anthropic API docs)',
      link: 'https://docs.anthropic.com/en/api/errors',
    },
    {
      title: 'Character.AI Serving Infrastructure',
      description:
        'Published engineering posts on running int8-quantized, custom-attention inference to serve 20K+ queries/sec at a fraction of typical serving cost, an explicit case study in continuous batching and KV-cache efficiency mattering more than raw GPU count. (Character.AI engineering blog)',
      link: 'https://blog.character.ai/optimizing-ai-inference-at-character-ai-2/',
    },
    {
      title: 'Google Gemini / DeepMind Serving',
      description:
        'Runs multi-region TPU/GPU pools with priority-tiered request routing so paid API traffic is insulated from free-tier load spikes, illustrating tiered capacity allocation as a first-class design concern rather than an afterthought. (Google Cloud / DeepMind technical posts)',
      link: 'https://cloud.google.com/blog/products/ai-machine-learning/reduce-429-errors-on-vertex-ai',
    },
  ],

  coreEntities: [
    { name: 'Conversation', description: 'A thread of messages between one user and the assistant, identified by a conversationId; the unit of "memory."' },
    { name: 'Message', description: 'A single turn - role (user/assistant/system), content, token count, timestamp - persisted under its conversation.' },
    { name: 'GenerationJob', description: 'One in-flight request to produce a reply: the assembled prompt, the target model, streaming state, and which GPU worker owns it.' },
    { name: 'ModelWorker', description: 'A GPU process running an inference server (e.g. vLLM) that holds model weights and the KV cache for every sequence it is currently decoding.' },
    { name: 'UsageLedger', description: 'Per-user, per-tier counters for input tokens, output tokens, and request rate, used for both billing and quota enforcement.' },
  ],

  requirements: {
    core: [
      'Send a message and receive a generated reply, streamed back token-by-token as it is produced rather than all at once',
      'Maintain conversation context across turns - a follow-up question correctly references earlier turns in the same conversation',
      'Serve many concurrent users efficiently on a limited GPU fleet by batching their generation steps together',
      'Enforce per-user rate limits and token-based usage quotas, differentiated by pricing tier',
      'Filter unsafe or policy-violating content on both the incoming prompt and the outgoing generation',
    ],
    belowTheLine: [
      'Training or fine-tuning the underlying model',
      'Multi-modal generation (image/audio output)',
      'Tool-calling / plugin / agentic orchestration',
      'Enterprise workspace admin, SSO, and team billing controls',
      'On-device or fully local inference',
    ],
    nonFunctionalTable: [
      { metric: 'Time to first token (TTFT)', target: '< 500ms at p90 under normal load' },
      { metric: 'Steady-state token rate', target: '30-80 tokens/sec streamed per active request' },
      { metric: 'GPU utilization', target: '> 85% busy time via continuous batching, vs. ~10-20% naive' },
      { metric: 'Availability', target: '99.9% for the chat/queue layer; graceful 529 degradation under GPU shortage' },
      { metric: 'Moderation added latency', target: '< 20ms extra before first token, checked async on output' },
    ],
  },

  technologyChoices: [
    {
      tier: 'Inference Engine',
      purpose: 'Run the LLM on GPU with continuous batching across users',
      primaryPick: 'vLLM / TensorRT-LLM',
      alternatives: 'Triton, TGI (Hugging Face), Ollama',
      whyPrimaryWins: "PagedAttention-style KV-cache paging cuts cache memory waste from the 60-80% typical of naive allocators down to under 4%, which is what actually lifts GPU utilization into the 85%+ range this design targets.",
    },
    {
      tier: 'GPU Hardware',
      purpose: 'Matrix multiplication for autoregressive token decoding',
      primaryPick: 'NVIDIA A100 / H100',
      alternatives: 'AMD MI300X, Google TPU',
      whyPrimaryWins: 'Broadest serving-engine and CUDA-kernel support today matters more than raw FLOPs, since decode is memory-bandwidth-bound rather than compute-bound.',
    },
    {
      tier: 'Streaming Protocol',
      purpose: 'Deliver generated tokens to the client the instant they exist',
      primaryPick: 'SSE (Server-Sent Events)',
      alternatives: 'WebSocket, gRPC streaming',
      whyPrimaryWins: 'One-directional is all this needs; it rides over plain HTTP/1.1 through existing proxies and load balancers, and browsers auto-reconnect on a dropped connection.',
    },
    {
      tier: 'Inference Queue',
      purpose: 'Decouple accepting a request from GPU availability and absorb bursts',
      primaryPick: 'Redis Streams or Kafka',
      alternatives: 'SQS, RabbitMQ',
      whyPrimaryWins: 'A priority-ordered queue lets a paid-tier job jump ahead of a free-tier job in the same backlog instead of first-come-first-served collapse under load.',
    },
    {
      tier: 'Conversation Store',
      purpose: 'Persist message history, since the model itself remembers nothing',
      primaryPick: 'DynamoDB (partitioned by conversationId)',
      alternatives: 'Postgres, MongoDB, Cassandra',
      whyPrimaryWins: 'Partitioning by conversationId makes both appending a new turn and reading the full thread single-partition operations with no joins.',
    },
    {
      tier: 'Context Cache',
      purpose: 'Avoid re-reading and re-serializing history on every turn',
      primaryPick: 'Redis (TTL = session duration)',
      alternatives: 'Memcached',
      whyPrimaryWins: 'Most conversations are read-hot for only the few minutes a user is actively chatting, then go cold - a short TTL cache captures nearly all of that reuse cheaply.',
    },
  ],
  technologyChoicesNote:
    "Why continuous batching over just buying more GPUs? GPU decode is memory-bandwidth-bound, so a naive server handling one sequence at a time leaves most of a GPU idle no matter how many you provision. A serving engine that batches many users' decode steps into the same forward pass and pages the KV cache on demand is what turns utilization from roughly 10-20% into 85%+ - a bigger lever on both cost and latency than fleet size alone.",

  scaleEstimation: [
    'Users: ~500M weekly active, ~50M daily active, ~1M concurrent sessions at peak',
    'Request volume: ~300K new messages/minute at peak (~5K/sec)',
    'GPU fleet: at ~40-60 concurrent decode streams sustained per high-end GPU with continuous batching, peak load needs roughly 100-150 GPUs just for steady throughput, doubled for headroom and regional redundancy - call it 250-350 GPUs',
    'Token volume: average turn is ~600 input tokens (with history) + ~400 output tokens; at 5K requests/sec that is ~3M input + 2M output tokens/sec system-wide, which is the real billing and capacity unit, not "requests"',
    'Storage: ~5M new conversations/day, each averaging 6KB of message text -> ~30GB/day of raw conversation data, trivial for a KV/document store but requires history reads on every turn',
    'Cache: KV cache for a 500-token context on a 70B-class model can run into several GB per sequence, which is the actual scarce resource on the GPU - not FLOPs',
  ],

  apiInterface: [
    {
      method: 'POST',
      path: '/v1/conversations',
      description: 'Create a new conversation thread.',
      example: '// Response 201\n{ "conversationId": "conv_8f2a", "createdAt": "2026-08-02T10:00:00Z" }',
    },
    {
      method: 'POST',
      path: '/v1/conversations/{id}/messages',
      description: 'Send a user message; response streams back as Server-Sent Events, one "delta" event per generated token/chunk.',
      example:
        '// Request\n{ "role": "user", "content": "Summarize this in 3 bullets" }\n\n// Response (text/event-stream)\ndata: {"delta":"Here"}\n\ndata: {"delta":" are"}\n\ndata: {"delta":" three"}\n\ndata: {"event":"done","usage":{"inputTokens":612,"outputTokens":48}}',
    },
    {
      method: 'GET',
      path: '/v1/conversations/{id}',
      description: 'Fetch a conversation and its message history.',
      example: '// Response 200\n{ "conversationId": "conv_8f2a", "messages": [ { "role": "user", "content": "..." }, { "role": "assistant", "content": "..." } ] }',
    },
    {
      method: 'GET',
      path: '/v1/usage',
      description: 'Return the caller\'s current-period token usage against their tier quota.',
      example: '// Response 200\n{ "tier": "paid", "inputTokensUsed": 812000, "outputTokensUsed": 340000, "dailyOutputQuota": 1000000 }',
    },
    {
      method: 'DELETE',
      path: '/v1/conversations/{id}',
      description: 'Delete a conversation and its stored message history.',
    },
  ],
  apiSecurityNote:
    'Every request must carry a session/API-key identifying the caller so rate limits and token quotas can be charged to the right account; conversation IDs must be scoped to their owner and never guessable, since they are effectively private chat transcripts.',

  highLevelDesignIntro:
    "Let's build this up incrementally: first decouple accepting a request from generating a reply, then stream tokens instead of blocking, then fix the real bottleneck - one GPU serving one user at a time - with batching and KV-cache management, then layer conversation memory, context-window limits, quotas, safety filtering, multi-region capacity, and reconnect handling on top of that core loop.",

  builds: [
    {
      title: 'Decouple Accept from Generate: An Inference Queue',
      body:
        'The naive design has the HTTP handler call the model directly and block for the full 15-30 second generation. That ties an app-server thread to one GPU job for the entire duration and gives you zero backpressure when GPUs are saturated. The fix: the chat service does NOT talk to the GPU directly. It writes a GenerationJob onto a queue and returns immediately (or opens a stream that will be fed later); GPU workers pull jobs off that queue when they have capacity.\n\nWhy a queue and not a direct call: it absorbs bursts (queue depth grows instead of GPUs falling over), it lets you prioritize by tier (paid users\' jobs can jump ahead of free-tier jobs in the same queue), and it gives you a natural place to reject or delay work when the system is over capacity instead of everyone timing out simultaneously.',
      newComponents: [
        { name: 'Chat Service', description: 'Stateless orchestrator: auth, rate limiting, assembling the prompt from history, enqueuing the job, and later relaying tokens back to the client.' },
        { name: 'Inference Queue', description: 'A priority-ordered queue (e.g. Redis Streams or SQS with priority lanes) holding pending GenerationJobs, paid-tier jobs ahead of free-tier.' },
      ],
      diagram: {
        mermaid: `flowchart LR
  client[Client]:::client
  chat["Chat Service"]:::compute
  queue[["Inference Queue<br/>priority lanes"]]:::async
  gpu["GPU Worker Pool"]:::compute
  client -->|"1. POST message"| chat
  chat -->|"2. Enqueue GenerationJob"| queue
  queue -->|"3. Worker pulls next job"| gpu
  gpu -->|"4. Generation begins"| chat`,
      },
      closingNote:
        'A queue fixes backpressure and prioritization, but the client is still waiting on a closed HTTP response for the full generation. The next problem to solve is getting partial output back the moment it exists.',
    },
    {
      title: 'Stream Tokens as They Are Generated',
      body:
        'LLMs generate autoregressively - one token at a time, each depending on all previous tokens. That is inherently a streaming process, so the API should expose it as one: instead of buffering the full reply and sending it as a single response body, open a Server-Sent Events (SSE) connection and push each token (or small chunk of tokens) to the client the instant the GPU worker produces it.\n\nWhy SSE over a plain WebSocket here: it is one-directional (server to client), which is all this needs, it rides over plain HTTP/1.1 so it works through existing proxies and load balancers without special upgrade handling, and browsers auto-reconnect on drop. The GPU worker does not talk to the client directly - it publishes each token to a channel keyed by the job/conversation ID (e.g. Redis Pub/Sub), and the Chat Service instance holding the client\'s SSE connection subscribes to that channel and relays tokens through. That indirection matters: it decouples "which GPU is running this job" from "which Chat Service instance is holding this client connection," so either side can be swapped or scaled independently.',
      newComponents: [
        { name: 'Token Relay (Pub/Sub)', description: 'A Redis Pub/Sub channel per active job that carries generated tokens from the GPU worker to whichever Chat Service instance is holding the client\'s SSE connection.' },
      ],
      diagram: {
        mermaid: `sequenceDiagram
  autonumber
  participant C as Client
  participant Chat as Chat Service
  participant PS as Token Relay
  participant GPU as GPU Worker
  C->>Chat: open SSE stream
  Chat->>PS: subscribe channel=jobId
  GPU->>PS: publish token 1
  PS-->>Chat: token 1
  Chat-->>C: data: token 1
  GPU->>PS: publish token 2
  PS-->>Chat: token 2
  Chat-->>C: data: token 2`,
      },
      insightCallout:
        'The single biggest UX win in this whole system is cheap: time-to-first-token matters far more to perceived speed than total generation time. Users tolerate a 20-second reply if the first words appear in 400ms; they abandon a 5-second reply that shows nothing until it is done.',
      closingNote:
        'Streaming fixes perceived latency for one user at a time, but it does nothing about the actual bottleneck underneath: a single GPU still only usefully serves one generation stream if nothing changes about how the model is invoked.',
    },
    {
      title: 'Continuous Batching: Stop Wasting the GPU',
      body:
        'Here is the core inefficiency: generating a token is memory-bandwidth-bound, not compute-bound - the GPU spends most of its cycles waiting on memory rather than doing math. That means a GPU decoding ONE sequence at a time leaves most of its compute idle. The fix is to run many users\' next-token steps through the model in the same forward pass - batching - so the GPU amortizes that memory-bound work across dozens of sequences at once.\n\nNaive (static) batching groups a fixed batch of requests together and runs them until ALL of them finish, which wastes GPU slots on users whose replies finished early while the batch waits on the longest one. Continuous batching (the technique behind serving engines like vLLM) instead evaluates the batch one decode-step at a time: the instant any sequence in the batch finishes (hits a stop token or its max length), that slot is immediately backfilled with the next queued job, with zero idle GPU time waiting for a batch boundary. This is what actually gets utilization from ~10-20% (one sequence at a time) to 85-90%+.\n\nThe other half of the problem is memory: each in-flight sequence needs a KV cache (the cached attention keys/values for every token generated so far) that grows as the conversation grows, and naive allocators reserve a worst-case-sized contiguous block per sequence up front, wasting 60-80% of GPU memory to fragmentation. vLLM\'s PagedAttention fixes this by paging the KV cache into fixed-size blocks (like OS virtual memory pages) that get allocated on demand and freed the instant a sequence finishes - cutting that waste to under 4% and letting far more sequences fit in the same GPU memory, which directly increases how many users one GPU can batch together.',
      newComponents: [
        { name: 'GPU Worker (vLLM-style server)', description: 'Holds model weights plus per-sequence KV cache; continuously batches whichever sequences are currently decoding, backfilling finished slots immediately.' },
        { name: 'KV Cache Manager', description: 'Pages each sequence\'s attention cache into fixed-size blocks, allocating on demand and freeing on completion so memory is not wasted on worst-case reservations.' },
      ],
      diagram: {
        mermaid: `flowchart TD
  subgraph naive["Naive static batching"]
    n1["Seq A: 40 tokens left"]:::compute
    n2["Seq B: finished, GPU idle for this slot"]:::client
    n3["Seq C: 5 tokens left"]:::compute
  end
  subgraph cont["Continuous batching"]
    c1["Seq A: decoding"]:::compute
    c2["Seq B finished -> Seq D backfilled instantly"]:::cache
    c3["Seq C: decoding"]:::compute
  end`,
      },
      insightCallout:
        'This is the crux of the whole design: GPU capacity is the scarcest, most expensive resource in the system, so the single highest-leverage engineering investment is maximizing useful work per GPU-second - not adding more GPUs to a poorly-utilized fleet.',
      closingNote:
        'With batching solved, one GPU worker can genuinely serve dozens of concurrent users. The next gap is that the model itself remembers nothing - every one of those batched requests needs its conversation history reconstructed from storage before it reaches the GPU.',
    },
    {
      title: 'Conversation History Storage & Context Reconstruction',
      body:
        'The model call is stateless - it only sees whatever text is in the prompt for THIS call. "Memory" across turns is an illusion the Chat Service manufactures by storing every message and re-sending the relevant history as part of the prompt on every new turn.\n\nStore Conversations and Messages in a document/key-value store partitioned by conversationId, so appending a new turn and reading the full thread are both single-partition operations with no joins. On each new user message: read the conversation\'s message history, append the new user message, assemble it into the model\'s expected prompt format (system prompt + history + new message), enqueue that as the GenerationJob, and once the reply streams back, append it too as an assistant message.\n\nA Context Cache (Redis) in front of that store avoids re-reading and re-serializing the full history from the durable store on every single turn of an active conversation - most conversations are read-hot for the few minutes a user is actively chatting, then go cold.',
      newComponents: [
        { name: 'Conversation Store', description: 'Document/KV store (partition key: conversationId) holding ordered messages; append-only writes, range read for history reconstruction.' },
        { name: 'Context Cache', description: 'Redis cache of recently-active conversations\' history, avoiding a durable-store read on every turn of a live chat.' },
      ],
      diagram: {
        mermaid: `flowchart LR
  chat["Chat Service"]:::compute
  cache[("Context Cache<br/>Redis")]:::cache
  store[("Conversation Store<br/>partitioned by conversationId")]:::database
  gpu["GPU Worker"]:::compute
  chat -->|"1. Read history"| cache
  cache -->|"2. Miss -> read through"| store
  chat -->|"3. Assemble prompt + new msg"| gpu
  gpu -->|"4. Reply streamed back"| chat
  chat -->|"5. Append both turns"| store`,
      },
      closingNote:
        'Replaying full history works fine for a 10-turn conversation. It breaks down once a conversation runs long enough that history plus the new message no longer fits in the model\'s fixed context window - which is the next thing that will happen in any real product.',
    },
    {
      title: 'Context Window Overflow: Truncation and Summarization',
      body:
        'Every model has a hard token limit per call - e.g. 128K tokens for GPT-4 Turbo, 200K for Claude 3+. Once system prompt + history + new message exceeds that, the API call fails outright unless the system actively manages it.\n\nThe simplest strategy is a sliding window: keep only the most recent N messages verbatim and drop everything older. This is cheap but loses genuinely relevant earlier context - a user who established an important constraint 40 messages ago gets it silently forgotten.\n\nThe production answer layers a rolling summary underneath the sliding window: keep the last ~20 messages verbatim, and replace everything older with a compact summary generated by a smaller, cheaper model, regenerated periodically (e.g. every 10 new messages) rather than on every single turn to keep the extra cost and latency bounded. The prompt sent to the main model becomes: system prompt + rolling summary + last N verbatim messages + new message - preserving the gist of a long conversation while staying comfortably inside the context budget.',
      newComponents: [
        { name: 'Summarization Worker', description: 'A background job using a smaller/cheaper model to compress older turns of a long conversation into a rolling summary, refreshed periodically rather than per-turn.' },
      ],
      diagram: {
        mermaid: `flowchart LR
  full["Full history<br/>80 messages"]:::client
  window["Last 20 messages<br/>verbatim"]:::compute
  summary["Rolling summary<br/>of messages 1-60"]:::cache
  worker["Summarization Worker<br/>cheaper model"]:::async
  prompt["Assembled prompt<br/>within context budget"]:::compute
  full -->|"1. Split"| window
  full -->|"2. Older turns"| worker
  worker -->|"3. Compress"| summary
  summary -->|"4. Prepend"| prompt
  window -->|"5. Append"| prompt`,
      },
      closingNote:
        'History and context limits are now handled. The next concern is not correctness but abuse and cost: nothing yet stops one account from consuming unlimited GPU-seconds.',
    },
    {
      title: 'Per-User Rate Limits and Token-Based Usage Quotas',
      body:
        'A GPU-second is real, metered cost, so limits here are not just abuse prevention - they are the actual billing mechanism. Two different quotas matter and they are counted separately: request rate (how often you can call) and token volume (how much you can generate), and within token volume, input tokens and output tokens are typically priced and capped differently, because output tokens cost far more compute per token (each one requires a full forward pass; input tokens are processed once, in parallel, during the prompt phase).\n\nEnforce request-rate limits the same way an ordinary API rate limiter would (Redis counters/token buckets, checked in the Chat Service before a job is even enqueued, so abusive traffic never reaches the GPU fleet). Enforce token quotas as a running ledger per user per billing period: after every completed generation, increment inputTokensUsed and outputTokensUsed by the exact counts the model reports, and reject new requests once either counter crosses the tier\'s daily/monthly cap. Free tier gets a small daily allowance and lower priority in the inference queue; paid tiers get a larger allowance and priority queueing.',
      newComponents: [
        { name: 'Usage Ledger (Redis + durable store)', description: 'Per-user counters for input tokens, output tokens, and request rate, checked before enqueueing and updated after every completed generation.' },
      ],
      diagram: {
        mermaid: `flowchart TD
  req["New message"]:::client
  rl["Rate check<br/>Redis token bucket"]:::compute
  quota["Token quota check<br/>Usage Ledger"]:::cache
  reject["429 / quota exceeded"]:::client
  enqueue["Enqueue GenerationJob"]:::async
  req -->|"1. Check rate"| rl
  rl -->|"2. Pass"| quota
  rl -->|"3. Fail"| reject
  quota -->|"4. Under cap"| enqueue
  quota -->|"5. Over cap"| reject`,
      },
      closingNote:
        'Quotas stop cost blowouts from volume. They do nothing about the CONTENT of what is sent or generated, which is the next requirement.',
    },
    {
      title: 'Moderation: Filtering Input and Output',
      body:
        'Two distinct passes are needed, at two different points in the pipeline, because they protect against two different things. An input classifier runs on the user\'s message BEFORE it reaches the GPU: cheap (a few milliseconds, typically a small dedicated classifier model, not the main LLM), and it exists to reject clearly disallowed prompts before spending any GPU-seconds on them. An output classifier runs on the generated text, checked incrementally on chunks of the streamed reply rather than waiting for the full response, so a violation can still be caught within a second or two instead of only after the entire reply has already been shown to the user.\n\nThe tricky part is doing this without destroying the latency win from streaming: running a full moderation pass on the ENTIRE final response before releasing any of it just reintroduces the blocking behavior streaming was meant to remove. The practical compromise is to stream tokens to the client immediately while moderation runs asynchronously in parallel on rolling chunks, and only interrupt/redact the stream if a violation is flagged mid-generation - trading a small window of exposure for keeping time-to-first-token intact.',
      newComponents: [
        { name: 'Safety Classifier', description: 'Lightweight model checking prompts before generation and streamed output chunks during generation, distinct from and much cheaper than the main LLM.' },
      ],
      diagram: {
        mermaid: `sequenceDiagram
  autonumber
  participant C as Client
  participant Chat as Chat Service
  participant Mod as Safety Classifier
  participant GPU as GPU Worker
  C->>Chat: send message
  Chat->>Mod: check input (~5ms)
  Mod-->>Chat: allowed
  Chat->>GPU: enqueue job
  GPU-->>Chat: stream chunk
  Chat->>Mod: check output chunk (async)
  Chat-->>C: forward chunk
  Mod-->>Chat: flagged mid-stream
  Chat-->>C: stop stream, replace with policy message`,
      },
      closingNote:
        'Every layer so far assumes there is enough GPU capacity to serve the request at all. The last hard problem is what happens the moment that assumption breaks - which for this class of product, it regularly does.',
    },
    {
      title: 'Multi-Region Capacity Routing and Load Shedding',
      body:
        'GPU capacity is finite and provisioned per region, and demand for these products is famously spiky - a viral moment, a new model launch, or a regional outage can spike load 5-10x in minutes. The system needs an explicit answer for "what happens when queued demand exceeds GPU throughput" rather than letting requests silently time out.\n\nFirst, route: a global load balancer picks the region with available capacity for the requested model, falling back to another region rather than piling every request onto one saturated pool. Second, when even that is not enough, shed load with intent instead of first-come-first-served collapse: priority tiers mean paid traffic keeps flowing while free-tier requests queue longer or get an explicit "at capacity, try again" response (this is exactly what Anthropic\'s distinct 529 overloaded-error and OpenAI\'s public "ChatGPT is at capacity" messaging are doing - communicating "we are out of capacity" as a different, actionable signal from "you personally are rate-limited"). A further lever many providers use is model downgrade under pressure: routing free-tier or lower-priority traffic to a smaller/cheaper model variant during a crunch, preserving availability at the cost of quality rather than failing outright.',
      diagram: {
        mermaid: `flowchart TD
  req["Incoming request"]:::client
  glb["Global Router"]:::edge
  r1["Region A GPU pool<br/>90% utilized"]:::compute
  r2["Region B GPU pool<br/>60% utilized"]:::compute
  shed["Load shed:<br/>free tier queued/rejected"]:::async
  paid["Paid tier: priority lane"]:::compute
  req -->|"1. Route by capacity"| glb
  glb -->|"2. Prefer least-loaded"| r2
  glb -->|"3. All regions saturated"| shed
  shed -->|"4. Paid traffic still served"| paid
  shed -->|"5. Free tier: 529 / delayed"| req`,
      },
      insightCallout:
        'The interview-worthy insight: a well-designed AI chat system does not pretend GPU capacity is infinite and try to serve everyone equally when it is not - it makes an explicit, tiered decision about who gets degraded first, and communicates "we are out of capacity" as a distinct signal from "you are rate-limited."',
      closingNote:
        'With routing, quotas, and moderation in place, the last edge case is what happens to an individual in-flight stream when the CLIENT - not the server - drops mid-generation.',
    },
    {
      title: 'Resumable Streams: Surviving a Client Disconnect',
      body:
        'A mobile client loses signal, a laptop sleeps, a tab reloads - all mid-generation. The naive behavior is for the dropped SSE connection to simply kill the in-flight job, wasting the GPU-seconds already spent and forcing a full regeneration on reconnect.\n\nBecause the Token Relay (Pub/Sub) already decouples "which GPU is generating this" from "which Chat Service connection is listening," the GPU worker does not need to know or care that the client disconnected - it keeps generating and publishing tokens to the job\'s channel regardless. The Chat Service instead persists every published token/chunk to a short-lived buffer (e.g. the same Redis instance, keyed by jobId, with a TTL of a minute or two) as it relays them. On reconnect, the client resends the same jobId/conversationId; the Chat Service replays whatever is in the buffer immediately, then re-subscribes to the live channel for anything generated after that - so the user sees the full reply with no re-generation and no gap, as long as they reconnect within the buffer\'s TTL.',
      diagram: {
        mermaid: `sequenceDiagram
  autonumber
  participant C as Client
  participant Chat as Chat Service
  participant Buf as Token Buffer
  participant GPU as GPU Worker
  C->>Chat: stream open, jobId=42
  GPU->>Buf: publish + buffer tokens
  Buf-->>Chat: relay tokens
  Chat-->>C: forward tokens
  C--xChat: connection drops
  GPU->>Buf: keeps generating regardless
  C->>Chat: reconnect, jobId=42
  Chat->>Buf: replay buffered tokens
  Chat-->>C: catch-up burst, then live tail
  Buf-->>Chat: continue live relay`,
      },
      closingNote:
        'That closes the loop on the core request path. What remains is tying every piece - queueing, batching, history, quotas, moderation, capacity routing, and resumability - into one coherent architecture.',
    },
  ],

  coreFlows: [
    {
      title: 'Send a Message: Happy Path',
      diagram: {
        mermaid: `sequenceDiagram
  autonumber
  participant C as Client
  participant Chat as Chat Service
  participant Mod as Safety Classifier
  participant Q as Inference Queue
  participant GPU as GPU Worker
  participant Store as Conversation Store
  C->>Chat: POST /messages "Summarize this"
  Chat->>Mod: check input prompt
  Mod-->>Chat: allowed
  Chat->>Store: read + assemble history
  Chat->>Q: enqueue GenerationJob
  Q->>GPU: worker picks up job (batched)
  GPU-->>Chat: stream tokens via relay
  Chat-->>C: SSE data: token chunks
  GPU-->>Chat: done, usage counts
  Chat->>Store: append user + assistant messages
  Chat-->>C: SSE event: done`,
      },
    },
    {
      title: 'Client Disconnects and Resumes Mid-Stream',
      diagram: {
        mermaid: `sequenceDiagram
  autonumber
  participant C as Client
  participant Chat as Chat Service
  participant Buf as Token Buffer
  participant GPU as GPU Worker
  C->>Chat: open stream, jobId=88
  GPU->>Buf: generating + buffering tokens
  Buf-->>Chat: relay
  Chat-->>C: forward tokens
  C--xChat: network drop
  Note over GPU,Buf: generation continues unaffected
  C->>Chat: reconnect with jobId=88
  Chat->>Buf: fetch buffered tokens
  Chat-->>C: replay + resume live stream`,
      },
    },
    {
      title: 'Capacity Crunch: Queued, Then Load-Shed',
      diagram: {
        mermaid: `sequenceDiagram
  autonumber
  participant C as Client (free tier)
  participant Chat as Chat Service
  participant Q as Inference Queue
  participant GPU as GPU Worker Pool
  C->>Chat: POST /messages
  Chat->>Q: enqueue (low priority lane)
  Q->>GPU: all workers saturated with paid-tier jobs
  Note over Q,GPU: queue depth grows past threshold
  Chat-->>C: 529 "at capacity, retry shortly"
  Note over Chat,C: paid-tier requests in high-priority lane still served normally`,
      },
    },
  ],

  deepDives: [
    {
      title: 'Continuous Batching and the KV Cache',
      problem:
        'A single GPU decoding one sequence at a time leaves most of its compute idle because token generation is memory-bandwidth-bound, and naively reserving KV-cache memory per sequence wastes most of the GPU\'s memory to fragmentation before batching even helps.',
      diagram: {
        mermaid: `flowchart LR
  a["Static batch of 8<br/>waits for slowest sequence"]:::client
  b["Continuous batching<br/>finished slots backfilled instantly"]:::cache
  c["PagedAttention<br/>KV cache in fixed blocks<br/>under 4% waste"]:::compute
  a -->|"1. Idle GPU time"| b
  b -->|"2. More sequences fit"| c`,
      },
      bad:
        'One request per GPU pass, run to completion before starting the next. GPU utilization sits around 10-20% because most of each step is spent waiting on memory bandwidth rather than compute, and only one user\'s tokens are being produced at a time no matter how much idle capacity exists.',
      good:
        'Static batching: group N requests together and run the batch as a unit. This shares the memory-bound cost across N sequences and lifts utilization meaningfully, but the whole batch is stuck waiting on whichever sequence finishes last - if 7 of 8 sequences finish in 50 tokens and one runs to 500, those 7 GPU slots sit idle for the remaining 450 steps.',
      great:
        'Continuous batching (as implemented in vLLM and similar serving engines) evaluates one decode step at a time across the whole batch and immediately backfills any slot that finishes with the next queued job, with paged KV-cache memory (PagedAttention) allocated in fixed blocks on demand instead of reserved worst-case up front. Reported results: KV-cache waste drops from 60-80% down to under 4%, and real deployments (LMSYS Chatbot Arena) cut GPU count by 50% while handling tens of thousands of requests per day on the same hardware that previously ran at a fraction of the throughput.',
    },
    {
      title: 'Context Window Overflow on Long Conversations',
      problem:
        'A conversation that runs long enough eventually has system prompt + full history + new message exceed the model\'s fixed token limit (128K-200K tokens depending on model), and the naive fix of just sending everything produces a hard API error mid-conversation.',
      bad:
        'Send the full history every time with no limit checking. Works for short conversations, then abruptly fails with a context-length error once a long-running chat crosses the model\'s ceiling - the user gets a broken conversation with no warning.',
      good:
        'A pure sliding window: keep only the last N messages, drop everything older. This reliably stays under the limit and is cheap to implement, but a constraint or fact established 40 messages ago is silently and permanently forgotten the moment it falls out of the window - the model behaves as if it was never said.',
      great:
        'Sliding window plus rolling summarization: keep the last ~20 messages verbatim for fidelity on recent context, and periodically compress everything older into a summary using a smaller, cheaper model, refreshed every N new messages rather than every turn to bound the extra cost. The prompt becomes system prompt + rolling summary + recent verbatim messages + new message, preserving the gist of very long conversations while staying comfortably inside the token budget.',
    },
    {
      title: 'Prompt-Prefix Caching for Shared System Prompts',
      problem:
        'Many concurrent requests to the same model share an identical prefix - the same system prompt, the same few-shot examples, or the same long document a user pasted at the start of a conversation - yet a naive server recomputes the attention state for that shared prefix from scratch on every single request.',
      simpleTerms:
        'If a thousand users are all chatting with the same custom assistant persona, the first paragraph of every single prompt (the persona instructions) is byte-for-byte identical - so why recompute it a thousand times?',
      bad:
        'Treat every request as fully independent: run the full forward pass over system prompt + history + new message from position zero every time, even when the first several hundred tokens are identical to thousands of other concurrent requests. Pure wasted compute on the shared prefix.',
      good:
        'Cache the KV state for a known, static shared prefix (like a fixed system prompt) once per model and reuse it across requests that share that exact prefix, skipping recomputation for that portion. This helps a lot for a small number of well-known fixed prefixes but does not generalize to arbitrary conversation history that differs per user.',
      great:
        'Automatic prefix caching at the serving-engine level: the inference server hashes growing prefixes of incoming requests and reuses cached KV blocks for any prefix match across ANY requests, not just a hardcoded system prompt - so a long shared document, a common few-shot template, or even the first N turns of a conversation a user is actively continuing all benefit automatically, with cached blocks evicted LRU-style as new unique prefixes arrive. This is a direct extension of the same paged KV-cache infrastructure that makes continuous batching efficient in the first place.',
    },
    {
      title: 'Multi-Region Capacity and Graceful Degradation',
      problem:
        'GPU capacity is provisioned per region and is expensive to over-provision for rare spikes, but demand for AI chat products is spiky enough (viral moments, model launches) that treating "not enough GPUs right now" as an unhandled exception causes cascading failure across every user, not just the excess demand.',
      bad:
        'No explicit capacity signal: requests are accepted regardless of GPU headroom and simply queue indefinitely or time out once the queue backs up, giving every user - paid or free, first-in-line or not - the same degraded experience with no way to distinguish "you are rate-limited" from "we are simply out of capacity."',
      good:
        'A single global capacity threshold that rejects new requests once queue depth crosses a limit, returning a clear "at capacity" error instead of a silent timeout. This communicates the failure honestly but treats all users identically, so a paying customer gets shut out exactly as fast as a free-tier user during a spike.',
      great:
        'Tiered, routed degradation: a global router sends traffic to whichever region has headroom before falling back to queueing; when even that runs out, priority lanes keep paid traffic flowing while free-tier traffic queues longer or is explicitly shed with a distinct overloaded-capacity signal (separate from a plain rate-limit error); and as a last lever, lower-priority traffic can be transparently routed to a smaller/cheaper model variant to preserve availability over peak quality. This is exactly the pattern behind real, publicly-documented "at capacity" and 529-style responses from major providers.',
    },
  ],

  selfAudit: [
    { question: 'Why not call the model directly from the request handler?', answer: 'It blocks a thread for 15-30s per request and gives zero backpressure - use a queue plus streaming instead.' },
    { question: 'Why stream tokens instead of returning the full reply?', answer: 'Time-to-first-token dominates perceived latency; users tolerate a slow total reply if output starts immediately.' },
    { question: 'What is the actual GPU bottleneck?', answer: 'Memory bandwidth per decode step, not raw compute - which is exactly what continuous batching amortizes across many concurrent sequences.' },
    { question: 'How does the model "remember" earlier turns?', answer: 'It does not - the Chat Service reconstructs and resends the relevant history as part of every new prompt.' },
    { question: 'What happens when history exceeds the context window?', answer: 'Sliding window of recent turns verbatim plus a periodically-refreshed rolling summary of older turns.' },
    { question: 'How are input and output tokens billed differently?', answer: 'Output tokens cost far more compute per token (sequential forward passes) than input tokens (processed once, in parallel), so they are metered and priced separately.' },
    { question: 'How is moderation done without killing streaming latency?', answer: 'Input checked before enqueueing (cheap, blocking); output checked incrementally on streamed chunks, interrupting the stream only if flagged.' },
    { question: 'What happens when GPU demand exceeds capacity?', answer: 'Route to a less-loaded region first, then shed load by tier with an explicit "overloaded" signal, or downgrade lower-priority traffic to a cheaper model.' },
  ],

  finalArchitecture: {
    title: 'Final Architecture',
    mermaid: `flowchart LR
  client[Client]:::client
  glb["Global Router"]:::edge
  chat["Chat Service"]:::compute
  mod["Safety Classifier"]:::compute
  ledger[("Usage Ledger")]:::cache
  cache[("Context Cache")]:::cache
  store[("Conversation Store")]:::database
  queue[["Inference Queue<br/>priority lanes"]]:::async
  gpu["GPU Worker Pool<br/>continuous batching + KV cache"]:::compute
  relay[("Token Relay<br/>Pub/Sub")]:::cache
  buf[("Token Buffer<br/>reconnect replay")]:::cache
  summarizer["Summarization Worker"]:::async

  client -->|"1. Send message"| glb
  glb -->|"2. Route to region"| chat
  chat -->|"3. Check input"| mod
  chat -->|"4. Check quota + rate"| ledger
  chat -->|"5. Read/assemble history"| cache
  cache -->|"6. Read-through"| store
  chat -->|"7. Enqueue job"| queue
  queue -->|"8. Batched pickup"| gpu
  gpu -->|"9. Publish tokens"| relay
  relay -->|"10. Buffer + relay"| buf
  buf -->|"11. Stream to client"| chat
  chat -->|"12. Forward SSE"| client
  chat -->|"13. Persist turns"| store
  store -->|"14. Long convos"| summarizer
  summarizer -->|"15. Rolling summary"| cache`,
  },

  keyTechnologies: [
    { term: 'Continuous Batching', definition: 'Serving technique that evaluates many concurrent sequences one decode step at a time, backfilling finished slots immediately instead of waiting for a fixed batch boundary.' },
    { term: 'KV Cache', definition: 'Cached attention keys/values for every token generated so far in a sequence, reused on each subsequent step so the model does not recompute attention over the whole prefix every time.' },
    { term: 'PagedAttention', definition: 'A KV-cache memory management scheme (used by vLLM) that pages the cache into fixed-size blocks allocated on demand, cutting memory fragmentation from 60-80% down to under 4%.' },
    { term: 'Server-Sent Events (SSE)', definition: 'A one-directional HTTP streaming protocol used to push generated tokens to the client as they are produced, without needing a full WebSocket upgrade.' },
    { term: 'Time to First Token (TTFT)', definition: 'The latency from request to the first visible piece of output; the primary perceived-speed metric for streaming LLM responses.' },
    { term: 'Context Window', definition: 'The fixed maximum number of tokens (prompt + history + reply) a model can process in a single call; exceeding it requires truncation or summarization.' },
    { term: 'Prefix Caching', definition: 'Reusing cached KV state for a shared prompt prefix across multiple requests instead of recomputing attention over identical leading tokens every time.' },
    { term: 'Load Shedding', definition: 'Deliberately rejecting or deprioritizing lower-priority traffic when demand exceeds capacity, to protect availability for higher-priority traffic.' },
  ],

  expectedDepth: {
    mid:
      'Explain that the model call is stateless and history must be resent each turn. Know that responses should stream token-by-token over SSE rather than blocking for the full reply. Understand basic rate limiting per user to protect the system from abuse.',
    senior:
      'Explain why one GPU serving one request at a time is wildly inefficient (memory-bandwidth-bound decode) and how continuous batching plus KV-cache management fixes it, referencing a real serving engine like vLLM. Design conversation history storage and context-window overflow handling (sliding window + summarization). Separate input-token and output-token quotas and justify why they are priced/limited differently. Cover a two-stage moderation pipeline that does not defeat streaming latency.',
    staffPlus:
      'Address multi-region GPU capacity routing and tiered load shedding as first-class design concerns, not edge cases - including how to communicate "we are out of capacity" distinctly from "you are rate-limited," and when to downgrade lower-priority traffic to a cheaper model under pressure. Discuss prompt-prefix caching as a systemic throughput lever across many requests, resumable-stream design when a GPU worker and a client connection are decoupled, and the cost model tying GPU-seconds, KV-cache memory, and token-based billing together end to end.',
  },

  keyTakeaways: [
    'The model is stateless - "memory" is the Chat Service replaying stored history on every call, not something the model does itself',
    'GPU decode is memory-bandwidth-bound, not compute-bound, which is exactly why continuous batching (not more GPUs) is the highest-leverage fix for utilization',
    'PagedAttention-style KV-cache paging is what makes batching many concurrent conversations in limited GPU memory feasible at all',
    'Stream tokens immediately - time-to-first-token dominates perceived speed far more than total generation time',
    'Input and output tokens are different resources with different costs and should be quota\'d and billed separately',
    'Capacity crunches are a normal, recurring failure mode for this product category and need an explicit tiered degradation strategy, not just more hardware',
  ],

  relatedDesigns: ['chat-system', 'rate-limiter', 'job-scheduler', 'key-value-store'],
  relatedConcepts: [
    { name: 'Message Queues', description: 'The Inference Queue decouples accepting a request from a GPU worker being available to generate it.' },
    { name: 'Caching', description: 'Context caching, KV-cache paging, and prefix caching all reuse expensive prior computation instead of redoing it.' },
    { name: 'Rate Limiting', description: 'Per-user request-rate and token-quota enforcement reuses the same token-bucket/counter techniques as a general API rate limiter.' },
    { name: 'Load Balancing', description: 'Multi-region routing sends each request to whichever GPU pool actually has headroom.' },
    { name: 'Pub/Sub', description: 'Decouples which GPU worker is generating tokens from which server instance is holding the client\'s live connection.' },
  ],

  simulator: {
    goalDescription: 'Stream generated replies to users while batching thousands of concurrent conversations onto a limited GPU fleet.',
    requirementChips: ['TTFT < 500ms p90', '~5K new messages/sec peak', 'Queue instead of blocking on the GPU'],
    targetRps: 5000,
    readRatio: 0.3,
    cacheHitRatio: 0.75,
    latencyBudgetMsP99: 500,
    rubric: [
      { id: 'chat-compute-tier', label: 'Stateless chat service orchestrating requests', kind: 'requires-node-type', nodeType: ['app-server', 'microservice'] },
      { id: 'context-cache', label: 'Redis for context cache, token relay, and usage ledger', kind: 'requires-node-type', nodeType: 'redis' },
      { id: 'inference-queue', label: 'Priority inference queue decoupling accept from generate', kind: 'requires-node-type', nodeType: ['sqs', 'rabbitmq', 'kafka'] },
      { id: 'gpu-tier', label: 'GPU worker pool doing batched inference', kind: 'requires-node-type', nodeType: 'worker' },
      { id: 'handles-load', label: 'Handles the target load with no red bottleneck', kind: 'no-bottleneck' },
    ],
    referenceArchitecture: {
      nodes: [
        { id: 'client-1', type: 'client', instanceCount: 1, position: { x: 40, y: 200 } },
        { id: 'lb-1', type: 'load-balancer', instanceCount: 1, position: { x: 320, y: 200 } },
        { id: 'app-1', type: 'app-server', instanceCount: 20, position: { x: 600, y: 200 } },
        { id: 'redis-1', type: 'redis', instanceCount: 4, position: { x: 880, y: 120 } },
        { id: 'sqs-1', type: 'sqs', instanceCount: 1, position: { x: 880, y: 280 } },
        { id: 'worker-1', type: 'worker', instanceCount: 60, position: { x: 1160, y: 280 } },
      ],
      edges: [
        { id: 'e-client-lb', source: 'client-1', target: 'lb-1' },
        { id: 'e-lb-app', source: 'lb-1', target: 'app-1' },
        { id: 'e-app-redis', source: 'app-1', target: 'redis-1' },
        { id: 'e-app-sqs', source: 'app-1', target: 'sqs-1' },
        { id: 'e-sqs-worker', source: 'sqs-1', target: 'worker-1' },
        { id: 'e-worker-redis', source: 'worker-1', target: 'redis-1' },
      ],
    },
    referenceArchitectureExplanation:
      "The Chat Service enqueues each message as a job on a priority inference queue rather than calling the GPU directly, so GPU workers can batch many users' decode steps together. Redis backs the context cache, token relay, and usage ledger that tie streaming and conversation history together across service instances.",
    failureModeNarratives: {
      sqs:
        'The inference queue is modeled as a single managed instance. If it becomes unavailable, the Chat Service has nowhere to hand off generation jobs and every new message fails to enqueue even though the GPU workers themselves stay healthy.',
    },
    fullDesignLinkSlug: 'ai-chat-system',
  },
}

export default topic
