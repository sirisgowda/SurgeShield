import { useEffect, useRef, useState } from 'react';
import { api, setToken } from '../lib/api';

export default function GoogleButton({ onSuccess, onError }) {
  const ref = useRef(null);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!window.google || !clientId) {
      // Google script blocked/offline, or client ID not configured yet.
      // Fail quietly into the normal email/password flow rather than a broken button.
      setUnavailable(true);
      return;
    }
    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: async ({ credential }) => {
        try {
          const { token, user } = await api('/api/auth/google', {
            method: 'POST',
            body: { id_token: credential },
          });
          setToken(token);
          onSuccess(user);
        } catch (e) {
          onError?.(e.message);
        }
      },
    });
    window.google.accounts.id.renderButton(ref.current, {
      theme: 'outline',
      size: 'large',
      width: 320,
    });
  }, [onSuccess, onError]);

  if (unavailable) return null;
  return <div ref={ref} />;
}
