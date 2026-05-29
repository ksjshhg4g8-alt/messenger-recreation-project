import { useEffect, useState, useRef } from "react";
import CallModal from "./CallModal";
import { api, IncomingCall } from "@/lib/api";

export default function IncomingCallWatcher() {
  const [incoming, setIncoming] = useState<IncomingCall | null>(null);
  const activeRef = useRef(false);

  useEffect(() => {
    if (!localStorage.getItem("auth_token")) return;
    const check = async () => {
      if (activeRef.current) return;
      try {
        const { call } = await api.callIncoming();
        if (call) {
          activeRef.current = true;
          setIncoming(call);
        }
      } catch { /* ignore */ }
    };
    const interval = setInterval(check, 3000);
    return () => clearInterval(interval);
  }, []);

  if (!incoming) return null;

  return (
    <CallModal
      mode="incoming"
      callType={incoming.call_type}
      incoming={incoming}
      onClose={() => {
        setIncoming(null);
        activeRef.current = false;
      }}
    />
  );
}
