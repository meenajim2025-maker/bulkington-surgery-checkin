import { createClient } from '@supabase/supabase-js';

// These should be set in a .env file for production
const SUPABASE_URL = 'https://vaiexoondumvjeeifvnb.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZhaWV4b29uZHVtdmplZWlmdm5iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0MTYzOTUsImV4cCI6MjA4ODk5MjM5NX0.jJX87-FtNABSyJkCI7bWeCLbvqtbAvacOJdKSGYjMDY';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export async function saveCheckin(patientData) {
    const { data, error } = await supabase
        .from('checkins')
        .insert([
            {
                ...patientData,
                status: 'Waiting',
                timestamp: new Date().toISOString(),
                org_type: patientData.org_type || 'Patient',
                phone_number: patientData.phone_number
            }
        ]);

    if (error) throw error;
    return data;
}

export async function getCheckins() {
    const { data, error } = await supabase
        .from('checkins')
        .select('*')
        .neq('status', 'Seen')
        .order('timestamp', { ascending: false });

    if (error) throw error;
    return data;
}

export async function updateCheckinStatus(id, status) {
    const { data, error } = await supabase
        .from('checkins')
        .update({ status })
        .eq('id', id);

    if (error) throw error;
    return data;
}

// Subscription helper for real-time updates
export function subscribeToCheckins(onUpdate) {
    return supabase
        .channel('public:checkins')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'checkins' }, payload => {
            onUpdate(payload);
        })
        .subscribe();
}

// Global Emergency Signaling
export async function triggerEmergency(type, message) {
    const { data, error } = await supabase
        .from('emergencies')
        .insert([{ type, message, timestamp: new Date().toISOString() }]);
    if (error) throw error;
    return data;
}

export async function resolveEmergency(id) {
    const { data, error } = await supabase
        .from('emergencies')
        .update({ is_active: false })
        .eq('id', id);
    if (error) throw error;
    return data;
}

export function subscribeToEmergencies(onAlert) {
    return supabase
        .channel('public:emergencies')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'emergencies' }, payload => {
            if (payload.new.is_active) onAlert(payload.new);
        })
        .subscribe();
}
