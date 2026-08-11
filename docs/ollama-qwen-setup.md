# Ollama Qwen Local Model Setup

## Overview

This document describes the local Qwen model setup using Ollama, replacing the external EcoAPI provider. All AI processing now runs 100% locally on-premises with no external API dependencies.

## Prerequisites

- **Hardware**: 32GB+ RAM recommended for qwen3.6:27b (27B parameter model)
- **OS**: macOS, Linux, or Windows with WSL2
- **Storage**: ~15GB disk space for model weights

## Installation Steps

### 1. Install Ollama

**macOS/Linux:**
```bash
curl -fsSL https://ollama.ai/install.sh | sh
```

**Windows:**
Download from https://ollama.ai/download

### 2. Pull Qwen Model

```bash
ollama pull qwen3.6:27b
```

This downloads the 27B parameter Qwen model (~15GB).

### 3. Verify Installation

```bash
ollama list
# Should show: qwen3.6:27b

ollama run qwen3.6:27b "Hello, how are you?"
# Should return a response
```

### 4. Start Ollama Server

The AI service expects Ollama running at `http://localhost:11434`:

```bash
ollama serve
```

For production, consider running Ollama as a system service:

**systemd (Linux):**
```bash
sudo systemctl enable ollama
sudo systemctl start ollama
```

**launchd (macOS):**
```bash
launchctl load ~/Library/LaunchAgents/com.ollama.ollama.plist
```

## Configuration

### Environment Variables

Add to `/workspace/ai-service/.env`:

```bash
# Enable real module generation
AI_SERVICE_USE_REAL_MODULE_GENERATOR="true"

# Qwen model name (must match ollama pull)
AI_SERVICE_OLLAMA_MODEL="qwen3.6:27b"

# Request timeout (seconds) - 27B models can be slow
AI_SERVICE_REQUEST_TIMEOUT_SECONDS="120"
```

### No API Key Required

Unlike external providers, Ollama requires no API key. All communication is local via HTTP.

## Performance Expectations

| Metric | Expected Value |
|--------|---------------|
| First request latency | 30-60 seconds (model loading) |
| Subsequent requests | 5-15 seconds |
| Module generation | 30-90 seconds |
| RAM usage | ~20GB for qwen3.6:27b |
| Disk I/O | Minimal after initial load |

### Optimization Tips

1. **Keep Ollama running**: Model stays cached in RAM
2. **Use SSD**: Faster model loading
3. **GPU acceleration**: If available, Ollama auto-detects CUDA/Metal
4. **Batch requests**: Worker processes jobs sequentially

## Troubleshooting

### "Model not found"
```bash
ollama pull qwen3.6:27b
```

### "Connection refused"
Ensure Ollama server is running:
```bash
ollama serve
```

### Slow performance
- Check RAM availability (need 32GB+)
- Close other memory-intensive applications
- Consider smaller model: `ollama pull qwen2.5:7b`

### Out of memory
Reduce model size:
```bash
ollama rm qwen3.6:27b
ollama pull qwen2.5:7b
```

Update `.env`:
```bash
AI_SERVICE_OLLAMA_MODEL="qwen2.5:7b"
```

## Migration from EcoAPI

### Before (EcoAPI)
```bash
# AI_SERVICE_QWEN_BASE_URL (deprecated)="https://dashscope.aliyuncs.com/compatible-mode/v1"
# AI_SERVICE_QWEN_API_KEY (deprecated)="sk-xxx"
# AI_SERVICE_QWEN_CHAT_MODEL (deprecated)="qwen-plus"
```

### After (Ollama Local)
```bash
AI_SERVICE_OLLAMA_MODEL="qwen3.6:27b"
AI_SERVICE_REQUEST_TIMEOUT_SECONDS="120"
# No base URL needed (defaults to localhost:11434)
# No API key needed
```

## Security Benefits

✅ **Data Privacy**: All prompts and responses stay on-premises
✅ **No Network Latency**: Local HTTP calls only
✅ **No Rate Limits**: Unlimited requests
✅ **No API Costs**: Free after hardware investment
✅ **Full Control**: Model version and configuration managed locally

## Production Deployment

For production environments:

1. **Dedicated GPU Server**: Run Ollama on separate machine with GPU
2. **Network Isolation**: Ollama bound to internal network only
3. **Monitoring**: Track Ollama health and model loading times
4. **Backup**: Regular backups of model weights
5. **Updates**: Test new model versions before deployment

### Docker Deployment

```bash
docker run -d --gpus all -p 11434:11434 \
  -v ollama:/root/.ollama \
  --name ollama \
  ollama/ollama
```

Then pull model inside container:
```bash
docker exec -it ollama ollama pull qwen3.6:27b
```

## References

- Ollama Documentation: https://ollama.ai/docs
- Qwen Model Card: https://ollama.ai/library/qwen3.6:27b
- GitHub: https://github.com/ollama/ollama

---

Last Updated: 2025-01-XX
