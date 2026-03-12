// src/supabaseClient.js
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://pawkkxilhjmaxhdmkjpi.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBhd2treGlsaGptYXhoZG1ranBpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxMzU1NDIsImV4cCI6MjA4ODcxMTU0Mn0.DUE04x76AEcqstqq59vBHMqJwG_Tf0QHOlHHUd6LCJ8'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)