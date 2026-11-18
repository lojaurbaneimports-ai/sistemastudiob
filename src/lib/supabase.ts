import { createClient } from '@supabase/supabase-js'

const url = (import.meta.env.VITE_SUPABASE_URL as string) || 'https://ypvfsmzfmgayowstajcs.supabase.co'
const key = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlwdmZzbXpmbWdheW93c3RhamNzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ5NjI3NjIsImV4cCI6MjExMDUzODc2Mn0.-ik7WIqb6YvS9ZwQrnlnVUTjgzbWUVBzP2CVLHrAOi4'

export const supabase = createClient(url, key)
