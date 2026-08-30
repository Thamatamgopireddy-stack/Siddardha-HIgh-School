import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatIST(date: string | Date) {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(date))
}

export const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin',
  developer: 'Developer',
  school_admin: 'School Admin',
  principal: 'Principal',
  teacher: 'Teacher',
  class_teacher: 'Class Teacher',
  accountant: 'Accountant',
  librarian: 'Librarian',
  transport_manager: 'Transport Manager',
  hostel_warden: 'Hostel Warden',
  hr_manager: 'HR Manager',
  student: 'Student',
  parent: 'Parent',
}
