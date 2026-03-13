import { createClient } from '@supabase/supabase-js';

// These should be set in a .env file for production
const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL || 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export async function saveCheckin(patientData) {
    const { data, error } = await supabase
        .from('checkins')
        .insert([
            {
                ...patientData,
                status: 'Waiting',
                timestamp: new Date().toISOString()
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
