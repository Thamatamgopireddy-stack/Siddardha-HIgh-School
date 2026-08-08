import { useState } from 'react'
import { Users, GraduationCap, Wallet, CalendarCheck, Sparkles, Send } from 'lucide-react'
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { PageWrapper } from '@/components/layout/PageWrapper'
import { StatCard } from '@/components/shared/StatCard'
import { useAuthStore } from '@/store'
import { useAIChat, useDashboardStats } from '@/api/hooks'

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

interface AdminDashboardProps {
  stats: any
}

function AdminDashboard({ stats }: AdminDashboardProps) {
  const enrollmentData = stats?.enrollment_data || []
  const attendanceData = stats?.attendance_data || []
  const feeData = stats?.fee_data || []
  const activities = stats?.activities || []

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Students" value={stats?.total_students?.toString() || "0"} subtext="Active this year" icon={<Users className="h-5 w-5" />} />
        <StatCard label="Total Teachers" value={stats?.total_teachers?.toString() || "0"} subtext="Including staff" icon={<GraduationCap className="h-5 w-5" />} color="bg-purple-600" />
        <StatCard label="Fee Collected (Month)" value={stats?.fee_collected || "₹0"} trend={0} icon={<Wallet className="h-5 w-5" />} color="bg-success" />
        <StatCard label="Avg Attendance Today" value={stats?.avg_attendance || "0.0%"} subtext={stats?.subtext_attendance || "0 present"} icon={<CalendarCheck className="h-5 w-5" />} color="bg-warning" />
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
                {attendanceData.map((e: any) => <Cell key={e.name} fill={e.color} />)}
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
              {activities.map((a: any, i: number) => (
                <li key={i} className="flex justify-between border-b border-slate-100 pb-2 text-sm dark:border-slate-800">
                  <span>{a.text}</span>
                  <span className="text-slate-400 text-xs shrink-0 ml-2">{a.time}</span>
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
  const { data: stats, isLoading } = useDashboardStats()

  return (
    <PageWrapper title="Dashboard" description="Overview of school operations" loading={isLoading}>
      {role === 'teacher' || role === 'class_teacher' ? (
        <div className="grid gap-4 md:grid-cols-2">
          <StatCard label="Classes Today" value={stats?.classes_today?.toString() || "0"} subtext="Scheduled classes" />
          <StatCard label="Attendance Pending" value={stats?.attendance_pending?.toString() || "0"} subtext="Sections to mark" color="bg-warning" />
        </div>
      ) : role === 'student' || role === 'parent' ? (
        <div className="grid gap-4 md:grid-cols-2">
          <StatCard label="Attendance (Month)" value={stats?.attendance_rate || "100.0%"} />
          <StatCard label="Fee Status" value={stats?.fee_status || "Paid"} color={stats?.fee_status === 'Paid' ? 'bg-success' : 'bg-warning'} />
        </div>
      ) : (
        <AdminDashboard stats={stats} />
      )}
    </PageWrapper>
  )
}

