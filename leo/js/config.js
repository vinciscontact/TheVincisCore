// Leo → Supabase connection.
// Fill both values from Supabase → Project Settings → API once the Leo project exists.
// The publishable (anon) key is designed to ship in the browser: the database's
// row-level security is what keeps the data private, not this key.
export const SUPABASE_URL = "https://piakspziguonofuyzigl.supabase.co";
export const SUPABASE_KEY = "sb_publishable_ZIWjI44AdQO_PsIE-JPJzA_0IrX7yoc";

// Sign out automatically after this many minutes without activity.
export const IDLE_MINUTES = 30;
