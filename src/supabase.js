import { createClient } from '@supabase/supabase-js'

// ⚠️ 여기에 본인의 Supabase 프로젝트 정보를 넣으세요!
const SUPABASE_URL = 'https://kzjtyukjyrpdugsdswwf.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt6anR5dWtqeXJwZHVnc2Rzd3dmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NzA4ODQsImV4cCI6MjA5MDQ0Njg4NH0.kRLLgSbw_LV0Os2Cp4r0PSsAcAyBqq3PLa9HFtPO9bE'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
