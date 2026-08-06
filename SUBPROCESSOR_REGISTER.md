# Subprocessor Register - Verify Before Launch

| Provider | Function | Data categories | Optional | Launch condition |
|---|---|---|---|---|
| DeepSeek | Redacted editorial language processing | Selected minimized text and pseudonymous evidence IDs | Yes | Contract, transfer, retention, training, deletion, and security review |
| Deepgram | Speech transcription | Selected audio, language and callback metadata | Yes when local fallback selected | Contract, retention, training, deletion, region and security review |
| ElevenLabs | Narration and verified self-voice | Approved text and permitted voice samples | Yes | Voice policy, subject verification, retention, deletion, region and contract review |
| Cloudflare | Edge, WAF, Turnstile, R2, optional Stream | Network metadata and encrypted media objects | No for core hosting | DPA, region, deletion and security review |
| Neon | PostgreSQL | Structured encrypted records | No | DPA, region, backup and security review |
| Upstash | Queue and cache metadata | Job IDs and non-content cache data | No | DPA, region and security review |
| Fly.io | Application and worker compute | Transient application and media data | No | DPA, region, disk and security review |
| Stripe | Billing | Customer and payment references | No for paid plans | DPA and checkout disclosure |
| Resend | Transactional email | Recipient, template data and links | No | DPA and link minimization |
| Sentry/OTel provider | Redacted diagnostics | Pseudonymous technical telemetry | No | Scrubbing validation and DPA |
| Print provider | Physical book fulfillment | Approved edition and shipping details | Yes | Separate approval before integration |
