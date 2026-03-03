<template>
  <div class="chat-panel">
    <!-- Sidebar: conversation list -->
    <div class="chat-sidebar">
      <button class="new-conv-btn" @click="newConversation">
        <span class="btn-icon">✏️</span> 新对话
      </button>

      <div class="conv-list">
        <div
          v-for="conv in conversations"
          :key="conv.id"
          class="conv-item"
          :class="{ active: conv.id === currentConvId }"
          @click="switchConversation(conv)"
        >
          <div class="conv-item-main">
            <span class="conv-name">{{ conv.name || '新对话' }}</span>
            <span class="conv-time">{{ fmtTime(conv.updated_at) }}</span>
          </div>
          <button
            class="conv-delete-btn"
            title="删除对话"
            @click.stop="deleteConversation(conv)"
          >✕</button>
        </div>
        <div v-if="conversations.length === 0" class="no-conv">暂无对话</div>
      </div>
    </div>

    <!-- Main chat area -->
    <div class="chat-main">
      <!-- Messages -->
      <div class="messages-area" ref="messagesAreaRef">
        <!-- Welcome state -->
        <div v-if="messages.length === 0 && !isStreaming" class="welcome-state">
          <div class="welcome-icon">🤖</div>
          <h2 class="welcome-title">量化 AI 助手</h2>
          <p class="welcome-sub">你好！我可以帮你查询策略状态、分析持仓、获取市场数据……</p>
          <div class="suggestions">
            <button
              v-for="hint in hints"
              :key="hint"
              class="suggestion-btn"
              @click="sendSuggestion(hint)"
            >{{ hint }}</button>
          </div>
        </div>

        <!-- Message bubbles -->
        <div v-for="(msg, i) in messages" :key="i" class="message-row" :class="msg.role">
          <div class="avatar">
            <span v-if="msg.role === 'assistant'">🤖</span>
            <span v-else>👤</span>
          </div>
          <div class="bubble-wrap">
            <!-- Tool use indicator inside assistant bubble -->
            <div v-if="msg.role === 'assistant' && msg.toolsUsed && msg.toolsUsed.length" class="tools-used">
              <span v-for="t in msg.toolsUsed" :key="t" class="tool-tag">⚙️ {{ t }}</span>
            </div>
            <div class="bubble" v-html="renderContent(msg.content)"></div>
          </div>
        </div>

        <!-- Streaming indicator -->
        <div v-if="isStreaming" class="message-row assistant">
          <div class="avatar">🤖</div>
          <div class="bubble-wrap">
            <div v-if="streamingTools.length" class="tools-used">
              <span v-for="t in streamingTools" :key="t" class="tool-tag">⚙️ {{ t }}</span>
            </div>
            <div class="bubble streaming">
              <span v-html="renderContent(streamingContent)"></span>
              <span class="cursor" v-if="!streamingContent">思考中</span>
              <span class="cursor blink">▌</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Input area -->
      <div class="input-area">
        <div class="input-wrap">
          <textarea
            ref="inputRef"
            v-model="inputText"
            class="chat-input"
            placeholder="输入问题，Enter 发送，Shift+Enter 换行"
            rows="1"
            :disabled="isStreaming"
            @keydown.enter.exact.prevent="sendMessage"
            @input="autoResize"
          ></textarea>
          <button
            class="send-btn"
            :class="{ loading: isStreaming }"
            :disabled="!inputText.trim() || isStreaming"
            @click="sendMessage"
          >
            <span v-if="!isStreaming">↑</span>
            <span v-else class="stop-icon" @click.stop="stopStream">■</span>
          </button>
        </div>
        <div class="input-hint">模型: qwen3 · Enter 发送 · Shift+Enter 换行</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, nextTick, watch } from 'vue'

// ──────────────────────── state ─────────────────────────────────────────────
const conversations = ref([])
const currentConvId = ref(null)
const messages = reactive([])
const inputText = ref('')
const isStreaming = ref(false)
const streamingContent = ref('')
const streamingTools = ref([])

const messagesAreaRef = ref(null)
const inputRef = ref(null)

let abortController = null

const hints = [
  '今天有哪些策略在跑',
  '帮我分析一下持仓情况',
  '最近有哪些强势股票',
  '连板天梯现在什么情况',
  '帮我查一下000001的基本信息',
]

// ──────────────────────── lifecycle ─────────────────────────────────────────
onMounted(() => {
  loadConversations()
})

watch(() => messages.length, () => scrollBottom())
watch(streamingContent, () => scrollBottom())

// ──────────────────────── helpers ────────────────────────────────────────────
function getToken() {
  return localStorage.getItem('access_token') || ''
}

function fmtTime(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  const now = new Date()
  const diff = now - d
  if (diff < 86400000) {
    return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  }
  return d.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })
}

/**
 * Minimal markdown-ish renderer:
 * - code fences → <pre><code>
 * - inline `code` → <code>
 * - **bold** → <strong>
 * - newlines → <br>
 */
function renderContent(text) {
  if (!text) return ''
  let out = text

  // Fenced code blocks
  out = out.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) =>
    `<pre class="code-block"><code>${escHtml(code.trimEnd())}</code></pre>`)

  // Inline code
  out = out.replace(/`([^`]+)`/g, (_, c) => `<code class="inline-code">${escHtml(c)}</code>`)

  // Bold
  out = out.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')

  // Newlines (only where not already wrapped in block tags)
  out = out.replace(/\n/g, '<br>')

  return out
}

function escHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function scrollBottom() {
  nextTick(() => {
    const el = messagesAreaRef.value
    if (el) el.scrollTop = el.scrollHeight
  })
}

function autoResize(e) {
  const el = e.target
  el.style.height = 'auto'
  el.style.height = Math.min(el.scrollHeight, 160) + 'px'
}

// ──────────────────────── conversations ──────────────────────────────────────
async function loadConversations() {
  try {
    const resp = await fetch('/assistant/api/conversations/', {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
    if (resp.ok) {
      conversations.value = await resp.json()
    }
  } catch (e) {
    console.warn('[ChatPanel] loadConversations failed', e)
  }
}

function newConversation() {
  currentConvId.value = null
  messages.splice(0, messages.length)
  streamingContent.value = ''
  streamingTools.value = []
  isStreaming.value = false
  nextTick(() => inputRef.value?.focus())
}

async function switchConversation(conv) {
  if (currentConvId.value === conv.id) return
  currentConvId.value = conv.id
  messages.splice(0, messages.length)
  try {
    const resp = await fetch(`/assistant/api/conversations/${conv.id}`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
    if (resp.ok) {
      const data = await resp.json()
      const msgs = data.messages || []
      msgs.forEach(m => messages.push({
        role: m.role,
        content: m.content,
        toolsUsed: [],
      }))
      scrollBottom()
    }
  } catch (e) {
    console.warn('[ChatPanel] switchConversation failed', e)
  }
}

async function deleteConversation(conv) {
  if (!confirm(`删除对话「${conv.name || '新对话'}」？`)) return
  try {
    await fetch(`/assistant/api/conversations/${conv.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${getToken()}` },
    })
  } catch (e) {
    console.warn('[ChatPanel] deleteConversation failed', e)
  }
  // If deleting the active conversation, reset to new-conversation state
  if (currentConvId.value === conv.id) {
    newConversation()
  }
  await loadConversations()
}

// ──────────────────────── send / stream ──────────────────────────────────────
function sendSuggestion(text) {
  inputText.value = text
  sendMessage()
}

async function sendMessage() {
  const text = inputText.value.trim()
  if (!text || isStreaming.value) return

  inputText.value = ''
  nextTick(() => {
    if (inputRef.value) {
      inputRef.value.style.height = 'auto'
    }
  })

  // Push user bubble
  messages.push({ role: 'user', content: text, toolsUsed: [] })

  isStreaming.value = true
  streamingContent.value = ''
  streamingTools.value = []

  abortController = new AbortController()

  try {
    const resp = await fetch('/assistant/api/chat/stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getToken()}`,
      },
      body: JSON.stringify({
        conversation_id: currentConvId.value,
        message: text,
      }),
      signal: abortController.signal,
    })

    if (!resp.ok) {
      const errText = await resp.text()
      throw new Error(`HTTP ${resp.status}: ${errText}`)
    }

    const reader = resp.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { value, done } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() // keep incomplete line

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const raw = line.slice(6).trim()
        if (raw === '[DONE]') continue

        try {
          const evt = JSON.parse(raw)

          if (evt.type === 'conv_id') {
            currentConvId.value = evt.conversation_id
          } else if (evt.type === 'tool_result') {
            if (!streamingTools.value.includes(evt.tool_name)) {
              streamingTools.value = [...streamingTools.value, evt.tool_name]
            }
          } else if (evt.type === 'token') {
            streamingContent.value += evt.content
          } else if (evt.type === 'error') {
            streamingContent.value = `❌ 错误：${evt.message}`
          }
        } catch {
          // non-JSON line, skip
        }
      }
    }

    // Commit streamed message to list
    messages.push({
      role: 'assistant',
      content: streamingContent.value,
      toolsUsed: [...streamingTools.value],
    })
    streamingContent.value = ''
    streamingTools.value = []

    // Refresh sidebar list
    await loadConversations()

  } catch (e) {
    if (e?.name !== 'AbortError') {
      messages.push({
        role: 'assistant',
        content: `❌ 请求失败：${e.message}`,
        toolsUsed: [],
      })
    }
    streamingContent.value = ''
    streamingTools.value = []
  } finally {
    isStreaming.value = false
    abortController = null
  }
}

function stopStream() {
  abortController?.abort()
}
</script>

<style scoped>
.chat-panel {
  display: flex;
  height: calc(100vh - 110px);
  background: var(--bg-primary, #f5f7fa);
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 2px 12px rgba(0,0,0,0.08);
}

/* ─── Sidebar ─── */
.chat-sidebar {
  width: 220px;
  min-width: 220px;
  background: #fff;
  border-right: 1px solid #e8ecf0;
  display: flex;
  flex-direction: column;
  padding: 12px 8px;
  gap: 10px;
}

.new-conv-btn {
  width: 100%;
  padding: 8px 12px;
  background: #0466c8;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  justify-content: center;
  font-weight: 500;
  transition: background 0.15s;
}
.new-conv-btn:hover { background: #035eb5; }

.conv-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.conv-item {
  padding: 8px 10px;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
  transition: background 0.1s;
}
.conv-item:hover { background: #f0f4f8; }
.conv-item.active { background: #e8f0fb; }

.conv-item-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.conv-name {
  font-size: 13px;
  color: #1a1a1a;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.conv-time {
  font-size: 11px;
  color: #9aa3af;
}

.conv-delete-btn {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  border: none;
  background: transparent;
  color: #b0b8c1;
  font-size: 13px;
  cursor: pointer;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.15s, background 0.15s, color 0.15s;
  padding: 0;
  line-height: 1;
}
.conv-item:hover .conv-delete-btn { opacity: 1; }
.conv-delete-btn:hover { background: #fee2e2; color: #dc2626; }

.no-conv {
  font-size: 13px;
  color: #b0b8c1;
  text-align: center;
  margin-top: 20px;
}

/* ─── Main area ─── */
.chat-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* ─── Messages ─── */
.messages-area {
  flex: 1;
  overflow-y: auto;
  padding: 20px 20px 12px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  scroll-behavior: smooth;
}

/* Welcome */
.welcome-state {
  margin: auto;
  text-align: center;
  max-width: 480px;
  padding: 40px 20px;
}
.welcome-icon { font-size: 48px; margin-bottom: 12px; }
.welcome-title {
  font-size: 20px;
  font-weight: 600;
  color: #1a1a1a;
  margin-bottom: 8px;
}
.welcome-sub {
  font-size: 14px;
  color: #6b7280;
  margin-bottom: 24px;
}
.suggestions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: center;
}
.suggestion-btn {
  padding: 7px 14px;
  background: #fff;
  border: 1px solid #d1d9e0;
  border-radius: 20px;
  font-size: 13px;
  color: #374151;
  cursor: pointer;
  transition: all 0.15s;
}
.suggestion-btn:hover {
  background: #0466c8;
  color: #fff;
  border-color: #0466c8;
}

/* Message rows */
.message-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}
.message-row.user {
  flex-direction: row-reverse;
}

.avatar {
  font-size: 22px;
  min-width: 32px;
  text-align: center;
  padding-top: 2px;
}

.bubble-wrap {
  max-width: 72%;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.message-row.user .bubble-wrap {
  align-items: flex-end;
}

.tools-used {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.tool-tag {
  font-size: 11px;
  background: #f0f4f8;
  color: #4b6c8a;
  padding: 2px 8px;
  border-radius: 10px;
  border: 1px solid #d1dce9;
}

.bubble {
  padding: 10px 14px;
  border-radius: 12px;
  font-size: 14px;
  line-height: 1.6;
  word-break: break-word;
}

.message-row.user .bubble {
  background: #0466c8;
  color: #fff;
  border-radius: 12px 12px 2px 12px;
}
.message-row.assistant .bubble {
  background: #fff;
  color: #1a1a1a;
  border-radius: 12px 12px 12px 2px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.07);
}

.bubble.streaming {
  min-width: 40px;
}

.cursor {
  color: #9aa3af;
  font-size: 13px;
}
.blink {
  animation: blink 0.8s step-end infinite;
  color: #0466c8;
  margin-left: 1px;
}
@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}

/* Code blocks inside bubbles */
:deep(.code-block) {
  background: #1e293b;
  color: #e2e8f0;
  border-radius: 6px;
  padding: 10px 14px;
  font-size: 12.5px;
  overflow-x: auto;
  margin: 6px 0;
  font-family: 'Fira Code', 'Consolas', monospace;
}
:deep(.inline-code) {
  background: #f1f5f9;
  color: #d63384;
  padding: 1px 5px;
  border-radius: 4px;
  font-size: 13px;
  font-family: 'Fira Code', 'Consolas', monospace;
}

/* ─── Input area ─── */
.input-area {
  padding: 12px 20px 14px;
  background: #fff;
  border-top: 1px solid #e8ecf0;
}

.input-wrap {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  background: #f5f7fa;
  border: 1.5px solid #d1d9e0;
  border-radius: 12px;
  padding: 6px 8px 6px 14px;
  transition: border-color 0.15s;
}
.input-wrap:focus-within {
  border-color: #0466c8;
  background: #fff;
}

.chat-input {
  flex: 1;
  resize: none;
  border: none;
  outline: none;
  background: transparent;
  font-size: 14px;
  line-height: 1.5;
  color: #1a1a1a;
  max-height: 160px;
  overflow-y: auto;
  padding: 4px 0;
}
.chat-input::placeholder { color: #b0b8c1; }
.chat-input:disabled { opacity: 0.6; }

.send-btn {
  width: 34px;
  height: 34px;
  border-radius: 8px;
  border: none;
  background: #0466c8;
  color: #fff;
  font-size: 18px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s;
  flex-shrink: 0;
}
.send-btn:hover:not(:disabled) { background: #035eb5; }
.send-btn:disabled { background: #b0c4d8; cursor: not-allowed; }
.send-btn.loading { background: #e53e3e; }
.stop-icon { font-size: 13px; }

.input-hint {
  font-size: 11px;
  color: #b0b8c1;
  margin-top: 5px;
  text-align: right;
}

/* Scrollbar */
.messages-area::-webkit-scrollbar,
.conv-list::-webkit-scrollbar { width: 4px; }
.messages-area::-webkit-scrollbar-thumb,
.conv-list::-webkit-scrollbar-thumb {
  background: #d1d9e0;
  border-radius: 2px;
}
</style>
