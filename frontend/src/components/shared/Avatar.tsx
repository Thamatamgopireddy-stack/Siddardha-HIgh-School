import { useMemo } from 'react'
import { cn } from '@/utils'

interface AvatarProps {
  src?: string | null
  firstName?: string
  lastName?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

const sizes = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-16 w-16 text-lg font-medium',
  xl: 'h-24 w-24 text-2xl font-semibold',
}

const colors = [
  'bg-blue-600 text-white',
  'bg-emerald-600 text-white',
  'bg-amber-600 text-white',
  'bg-red-600 text-white',
  'bg-purple-600 text-white',
  'bg-pink-600 text-white',
  'bg-indigo-600 text-white',
  'bg-teal-600 text-white',
]

export function Avatar({ src, firstName = '', lastName = '', size = 'md', className }: AvatarProps) {
  const initials = useMemo(() => {
    const f = firstName.trim().charAt(0)
    const l = lastName.trim().charAt(0)
    return `${f}${l}`.toUpperCase() || '?'
  }, [firstName, lastName])

  const colorClass = useMemo(() => {
    const sum = initials.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
    return colors[sum % colors.length]
  }, [initials])

  if (src) {
    return (
      <img
        src={src}
        alt={`${firstName} ${lastName}`}
        className={cn('rounded-full object-cover shrink-0', sizes[size], className)}
        onError={(e) => {
          // If the image fails to load, fallback to initials by clearing the src
          ;(e.target as HTMLImageElement).src = ''
          ;(e.target as HTMLImageElement).style.display = 'none'
        }}
      />
    )
  }

  return (
    <div
      className={cn(
        'flex items-center justify-center rounded-full font-medium shrink-0',
        sizes[size],
        colorClass,
        className
      )}
    >
      {initials}
    </div>
  )
}
