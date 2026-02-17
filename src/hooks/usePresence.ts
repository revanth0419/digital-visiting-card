
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Session } from '@supabase/supabase-js';

export const usePresence = () => {
    const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());

    useEffect(() => {
        let channel: any;

        const setupPresence = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            channel = supabase.channel('presence_v1', {
                config: {
                    presence: {
                        key: session.user.id,
                    },
                },
            });

            channel
                .on('presence', { event: 'sync' }, () => {
                    const newState = channel.presenceState();
                    const onlineIds = new Set<string>(Object.keys(newState));
                    setOnlineUsers(onlineIds);
                })
                .subscribe(async (status: string) => {
                    if (status === 'SUBSCRIBED') {
                        await channel.track({
                            online_at: new Date().toISOString(),
                            user_id: session.user.id,
                        });
                    }
                });
        };

        setupPresence();

        return () => {
            if (channel) supabase.removeChannel(channel);
        };
    }, []);

    return { onlineUsers, isOnline: (uid: string) => onlineUsers.has(uid) };
};
