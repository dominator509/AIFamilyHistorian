# Assumptions

| Assumption | Reason | Risk if wrong | Exact verification | Blocks implementation |
|---|---|---|---|---|
| Greenfield repository | User requested a new blueprint | Existing code could conflict | `find . -maxdepth 2 -type f | sort` in EP-000 | Yes |
| US-first launch | Initial deployment target | Consent, publicity, privacy, and defamation rules differ by jurisdiction | Counsel-approved launch matrix in LEGAL_APPROVAL_FILE | Production only |
| DeepSeek V4 Flash remains available under configured model name | Requested model | API or terms may change | Probe model list and archive official docs during EP-000 | Yes |
| Deepgram contract permits intended transcription | Chosen primary STT | Retention or training terms may be unacceptable | Vendor-risk evidence and read-only probe | Production only |
| ElevenLabs is optional | Voice work creates elevated rights risk | Missing provider must not block book workflows | Leave ELEVENLABS_API_KEY empty and prove stock/local narration fallback | No |
| Professional voice cloning is self-voice only | Current provider rule and safety choice | Product could otherwise enable impersonation | Verify provider documentation and live-fire rejection | Yes |
| Local Whisper can process consent-restricted audio | Required fallback | Compute cost may exceed lean target | Benchmark representative one-hour audio in EP-008 | No |
| R2 supports required multipart sizes | Large media requirement | Upload architecture may need alternative | Run multipart integration proof | Yes |
| Print provider is deferred until contract approval | API and rights terms vary | Automated physical fulfillment not available at first ship | Keep print artifact generation real; mark provider fulfillment optional | No |
| Users own or license contributed media | Required business model | Infringement and takedown exposure | Counsel-approved contributor release and rights workflow | Production only |
| No public social network | Product boundary | Growth features could create moderation burden | SPEC-000 and route audit | No |
| Host media binaries are available | EP-000 expected direct host probes | FFmpeg, ExifTool, ImageMagick, ClamAV and OCRmyPDF are absent from the current host PATH | `ffmpeg -version`, `exiftool -ver`, `magick -version`, `clamscan --version`, `ocrmypdf --version` | No; provide pinned worker containers |
| Host package manager matches the blueprint | Reproducible install requires pnpm 10.13.1 | Host currently resolves pnpm 9.15.0 | `pnpm --version`; enforce `packageManager` and Corepack in EP-001 | No |
| Available disk is sufficient for local services and images | Real local dependencies and media processing require container storage | Only 28 GB is currently free on a 95 percent used volume | `df -h .`; keep images bounded and monitor before large pulls | Potentially |
