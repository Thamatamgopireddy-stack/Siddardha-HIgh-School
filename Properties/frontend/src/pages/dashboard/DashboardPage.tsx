import { useState } from 'react'
import { Users, GraduationCap, Wallet, CalendarCheck, Sparkles, Send } from 'lucide-react'
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { PageWrapper } from '@/components/layout/PageWrapper'
import { StatCard } from '@/components/shared/StatCard'
import { useAuthStore } from '@/store'
import { useAIChat } from '@/api/hooks'

const enrollmentData = [
  { month: 'Aug', count: 820 }, { month: 'Sep', count: 845 }, { month: 'Oct', count: 860 },
  { month: 'Nov', count: 872 }, { month: 'Dec', count: 878 }, { month: 'Jan', count: 885 },
  { month: 'Feb', count: 890 }, { month: 'Mar', count: 895 }, { month: 'Apr', count: 900 },
  { month: 'May', count: 905 }, { month: 'Jun', count: 908 }, { month: 'Jul', count: 912 },
]

const attendanceData = [
  { name: 'Present', value: 842, color: '#16a34a' },
  { name: 'Absent', value: 48, color: '#dc2626' },
  { name: 'Late', value: 22, color: '#d97706' },
]

const feeData = [
  { month: 'Feb', collected: 12.4, pending: 2.1 },
  { month: 'Mar', collected: 11.8, pending: 2.8 },
  { month: 'Apr', collected: 14.2, pending: 1.9 },
  { month: 'May', collected: 13.5, pending: 2.4 },
  { month: 'Jun', collected: 15.1, pending: 1.6 },
  { month: 'Jul', collected: 14.8, pending: 2.0 },
]

const activities = [
  { text: 'Fee payment received — Rahul Sharma', time: '2 min ago' },
  { text: 'Attendance marked — Class 10-A', time: '15 min ago' },
  { text: 'New admission application submitted', time: '1 hr ago' },
  { text: 'Leave approved — Mrs. Priya Nair', time: '2 hr ago' },
]

function AiAssistantCard() {
  const [prompt, setPrompt] = useState('')
  const [messages, setMessages] = useState<{ sender: 'user' | 'ai'; text: string }[]>([
    { sender: 'ai', text: 'Hello! I am your Siddardha High School Assistant. Ask me anything about student SIS promotions, fee structures, or attendance SMS alerts!' },
  ])

  const chatMutation = useAIChat()

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!prompt.trim()) return

    const userText = prompt
    setMessages((prev) => [...prev, { sender: 'user', text: userText }])
    setPrompt('')

    try {
      const response = await chatMutation.mutateAsync(userText)
      setMessages((prev) => [...prev, { sender: 'ai', text: response.response }])
    } catch {
      setMessages((prev) => [...prev, { sender: 'ai', text: 'Sorry, I am having trouble connecting to the AI services right now.' }])
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 flex flex-col h-[280px]">
      <div className="mb-3 flex items-center gap-1.5 font-semibold text-slate-800 dark:text-white border-b border-slate-100 pb-2 dark:border-slate-800">
        <Sparkles className="h-4 w-4 text-accent animate-pulse" />
        Siddardha High School Smart Assistant
      </div>
      
      <div className="flex-1 overflow-y-auto space-y-2.5 mb-3 pr-1 scrollbar-thin">
        {messages.map((m, idx) => (
          <div key={idx} className={`flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-xl px-3 py-2 text-xs leading-normal ${
              m.sender === 'user'
                ? 'bg-accent text-white rounded-tr-none'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-tl-none'
            }`}>
              {m.text}
            </div>
          </div>
        ))}
        {chatMutation.isPending && (
          <div className="flex justify-start">
            <div className="bg-slate-100 dark:bg-slate-800 text-slate-400 rounded-xl rounded-tl-none px-3 py-2 text-2xs animate-pulse">
              thinking...
            </div>
          </div>
        )}
      </div>

      <form onSubmit={handleSend} className="flex gap-2">
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Ask assistance..."
          className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
        />
        <button
          type="submit"
          className="rounded-lg bg-accent px-3 py-1.5 text-white hover:bg-blue-700 shrink-0"
        >
          <Send className="h-3.5 w-3.5" />
        </button>
      </form>
    </div>
  )
}

function AdminDashboard() {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Students" value="912" subtext="Active this year" icon={<Users className="h-5 w-5" />} />
        <StatCard label="Total Teachers" value="64" subtext="Including staff" icon={<GraduationCap className="h-5 w-5" />} color="bg-purple-600" />
        <StatCard label="Fee Collected (Month)" value="₹14.8L" trend={8.2} icon={<Wallet className="h-5 w-5" />} color="bg-success" />
        <StatCard label="Avg Attendance Today" value="92.3%" subtext="842 present" icon={<CalendarCheck className="h-5 w-5" />} color="bg-warning" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border bg-white p-4 shadow-sm lg:col-span-2 dark:border-slate-800 dark:bg-slate-900">
          <h3 className="mb-4 font-medium">Student Enrollment (12 months)</h3>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={enrollmentData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Area type="monotone" dataKey="count" stroke="#2563eb" fill="#2563eb33" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="rounded-xl border bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h3 className="mb-4 font-medium">Today&apos;s Attendance</h3>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={attendanceData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80}>
                {attendanceData.map((e) => <Cell key={e.name} fill={e.color} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border bg-white p-4 shadow-sm lg:col-span-2 dark:border-slate-800 dark:bg-slate-900">
          <h3 className="mb-4 font-medium">Fee Collection vs Pending (₹ Lakhs)</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={feeData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="collected" fill="#2563eb" />
              <Bar dataKey="pending" fill="#d97706" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="flex flex-col gap-4">
          <div className="rounded-xl border bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 flex-1">
            <h3 className="mb-4 font-medium">Recent Activity</h3>
            <ul className="space-y-3">
              {activities.map((a, i) => (
                <li key={i} className="flex justify-between border-b border-slate-100 pb-2 text-sm dark:border-slate-800">
                  <span>{a.text}</span>
                  <span className="text-slate-400">{a.time}</span>
                </li>
              ))}
            </ul>
          </div>
          <AiAssistantCard />
        </div>
      </div>
    </>
  )
}

export function DashboardPage() {
  const role = useAuthStore((s) => s.user?.role)

  return (
    <PageWrapper title="Dashboard" description="Overview of school operations">
      {role === 'teacher' || role === 'class_teacher' ? (
        <div className="grid gap-4 md:grid-cols-2">
          <StatCard label="Classes Today" value="4" subtext="Next: Class 10-A Maths" />
          <StatCard label="Attendance Pending" value="1" subtext="Class 9-B" color="bg-warning" />
        </div>
      ) : role === 'student' || role === 'parent' ? (
        <div className="grid gap-4 md:grid-cols-2">
          <StatCard label="Attendance (Month)" value="94%" />
          <StatCard label="Fee Status" value="Paid" color="bg-success" />
        </div>
      ) : (
        <AdminDashboard />
      )}
    </PageWrapper>
  )
}
