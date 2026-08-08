import { useState, useRef, useEffect } from 'react'
import { Bot, Send, User, Sparkles, RefreshCw, Database, Search, ShieldCheck } from 'lucide-react'
import { api } from '@/api/client'
import { useAuthStore } from '@/store'
import { toast } from 'sonner'

interface Message {
  id: string
  sender: 'user' | 'ai'
  text: string
  timestamp: string
}

export function AiAssistantPage() {
  const user = useAuthStore((s) => s.user)
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      sender: 'ai',
      text: `Hello **${user?.first_name || 'Admin'}**! I am your **Siddardha High School AI Assistant** with full real-time database query access. Ask me any question about students, fees, attendance, staff, exams, transport, or notices!`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ])
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, isTyping])

  const handleSend = async (queryText?: string) => {
    const textToSend = queryText || input
    if (!textToSend.trim() || isTyping) return

    const userMsg: Message = {
      id: Date.now().toString(),
      sender: 'user',
      text: textToSend.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }

    setMessages((prev) => [...prev, userMsg])
    if (!queryText) setInput('')
    setIsTyping(true)

    try {
      const res = await api.post('/ai/chat', { message: textToSend })
      const aiReply = res.data?.data?.response || res.data?.message || 'Sorry, I could not process your query.'

      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        sender: 'ai',
        text: aiReply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }
      setMessages((prev) => [...prev, aiMsg])
    } catch (err: any) {
      toast.error('Failed to fetch AI response')
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        sender: 'ai',
        text: '❌ Connection error while querying the database. Please try again.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }
      setMessages((prev) => [...prev, errorMsg])
    } finally {
      setIsTyping(false)
    }
  }

  const quickQueries = [
    '🎓 Find student Rahul',
    '💳 Total fee collection summary',
    '📅 Attendance report & absent logs',
    '👥 List faculty members',
    '📚 Upcoming exams & marks',
    '📢 Recent notice board announcements',
    '🏫 System executive overview',
  ]

  const formatText = (content: string) => {
    // Simple markdown formatting helper
    return content.split('\n').map((line, idx) => {
      let formattedLine = line
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/`([^`]+)`/g, '<code class="bg-slate-100 dark:bg-slate-800 text-accent px-1 py-0.5 rounded font-mono text-xs">$1</code>')

      if (line.startsWith('### ')) {
        return <h3 key={idx} className="text-base font-bold text-slate-800 dark:text-slate-100 my-2" dangerouslySetInnerHTML={{ __html: formattedLine.replace('### ', '') }} />
      }
      if (line.startsWith('#### ')) {
        return <h4 key={idx} className="text-sm font-semibold text-slate-700 dark:text-slate-200 mt-2 mb-1" dangerouslySetInnerHTML={{ __html: formattedLine.replace('#### ', '') }} />
      }
      if (line.startsWith('- ')) {
        return <li key={idx} className="ml-4 list-disc text-sm text-slate-700 dark:text-slate-300 py-0.5" dangerouslySetInnerHTML={{ __html: formattedLine.replace('- ', '') }} />
      }
      return <p key={idx} className="text-sm text-slate-700 dark:text-slate-300 min-h-[1.25rem] py-0.5" dangerouslySetInnerHTML={{ __html: formattedLine }} />
    })
  }

  return (
    <div className="flex h-[calc(100vh-5rem)] flex-col rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
      {/* Top Bar Header */}
      <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/50 px-6 py-4 dark:border-slate-800 dark:bg-slate-900/50">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-white shadow-sm">
            <Sparkles className="h-5 w-5 animate-pulse" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              Siddardha AI School Query Engine
              <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-3xs font-medium text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900">
                <Database className="h-3 w-3 text-emerald-500" /> Full DB Search
              </span>
            </h2>
            <p className="text-xs text-slate-500">Ask natural language queries to search live student records, fees, staff & attendance</p>
          </div>
        </div>
        <button
          onClick={() => setMessages([messages[0]])}
          title="Clear Conversation"
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 transition-colors"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Clear Chat
        </button>
      </div>

      {/* Quick Queries Bar */}
      <div className="flex items-center gap-2 overflow-x-auto border-b border-slate-100 bg-slate-50/30 px-6 py-2.5 dark:border-slate-800/50 dark:bg-slate-900/30">
        <span className="text-2xs font-semibold uppercase tracking-wider text-slate-400 shrink-0 flex items-center gap-1">
          <Search className="h-3 w-3" /> Quick Query:
        </span>
        {quickQueries.map((q) => (
          <button
            key={q}
            onClick={() => handleSend(q.replace(/^[^\w]+/, ''))}
            className="shrink-0 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600 hover:border-accent hover:text-accent dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 transition-colors"
          >
            {q}
          </button>
        ))}
      </div>

      {/* Messages Feed */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex items-start gap-3 ${msg.sender === 'user' ? 'flex-row-reverse' : ''}`}
          >
            <div
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                msg.sender === 'user'
                  ? 'bg-accent text-white'
                  : 'bg-emerald-600 text-white'
              }`}
            >
              {msg.sender === 'user' ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
            </div>
            <div className={`max-w-2xl rounded-2xl px-4 py-3 shadow-xs ${
              msg.sender === 'user'
                ? 'bg-accent text-white rounded-tr-none'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-tl-none border border-slate-200 dark:border-slate-700'
            }`}>
              <div className="space-y-1">
                {msg.sender === 'user' ? (
                  <p className="text-sm font-medium">{msg.text}</p>
                ) : (
                  <div>{formatText(msg.text)}</div>
                )}
              </div>
              <span className={`block mt-1 text-[10px] ${msg.sender === 'user' ? 'text-blue-100 text-right' : 'text-slate-400'}`}>
                {msg.timestamp}
              </span>
            </div>
          </div>
        ))}

        {isTyping && (
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-600 text-white">
              <Bot className="h-4 w-4" />
            </div>
            <div className="rounded-2xl rounded-tl-none bg-slate-100 dark:bg-slate-800 px-4 py-3 border border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-bounce" />
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-bounce [animation-delay:0.2s]" />
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-bounce [animation-delay:0.4s]" />
                <span className="ml-2">Searching live database records...</span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Box */}
      <div className="border-t border-slate-200 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-900/50">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleSend()
          }}
          className="flex items-center gap-3"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask any question about students, fees, attendance, staff, marks..."
            className="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-800 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
          <button
            type="submit"
            disabled={!input.trim() || isTyping}
            className="flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm"
          >
            <span>Send</span>
            <Send className="h-4 w-4" />
          </button>
        </form>
        <p className="mt-2 text-center text-3xs text-slate-400 flex items-center justify-center gap-1">
          <ShieldCheck className="h-3 w-3 text-emerald-500" />
          AI responses are dynamically generated by querying live SQL database records.
        </p>
      </div>
    </div>
  )
}
