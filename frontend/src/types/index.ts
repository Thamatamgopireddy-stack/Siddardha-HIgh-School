export interface User {
  id: string
  email: string
  first_name: string
  last_name: string
  role: string
  profile_photo_url?: string | null
  force_password_change?: boolean
  permissions?: string[]
}

export interface APIResponse<T = unknown> {
  success: boolean
  data: T
  message: string
  meta?: { page?: number; limit?: number; total?: number }
}

export interface Student {
  id: string
  user_id?: string | null
  admission_number: string
  academic_year_id: string
  first_name: string
  middle_name?: string | null
  last_name: string
  date_of_birth: string
  gender: string
  section_id?: string | null
  roll_number?: string | null
  is_active: boolean
  phone?: string | null
  email?: string | null
  category?: string | null
  profile_photo_url?: string | null
  blood_group?: string | null
  nationality?: string | null
  religion?: string | null
  aadhaar_number?: string | null
  previous_school?: string | null
  tc_number?: string | null
  admission_date?: string | null
  address_line1?: string | null
  address_line2?: string | null
  city?: string | null
  state?: string | null
  pincode?: string | null
  alternate_phone?: string | null
}

export interface LoginResponse {
  access_token: string
  refresh_token: string
  token_type: string
  user: User
}
