import { useEffect, useRef, useState, useCallback } from "react";
import Icon from "@/components/ui/icon";
import Avatar from "./Avatar";
import { api, IncomingCall } from "@/lib/api";

const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

type CallState = "calling" | "ringing" | "connecting" | "active" | "ended";

interface CallModalProps {
  callType: "audio" | "video";
  mode: "outgoing" | "incoming";
  onClose: () => void;
  // outgoing
  calleeId?: number;
  calleeName?: string;
  calleeAvatar?: string | null;
  // incoming
  incoming?: IncomingCall;
}

export default function CallModal(props: CallModalProps) {
  const { callType, mode, onClose, calleeName, calleeAvatar, incoming } = props;
  const [state, setState] = useState<CallState>(mode === "outgoing" ? "calling" : "ringing");
  const [muted, setMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const callIdRef = useRef<number>(incoming?.id || 0);
  const lastIceRef = useRef(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const iceRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const cleanup = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (iceRef.current) clearInterval(iceRef.current);
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    pcRef.current?.close();
    pcRef.current = null;
  }, []);

  const endCall = useCallback(async () => {
    setState("ended");
    if (callIdRef.current) await api.callEnd(callIdRef.current).catch(() => {});
    cleanup();
    onClose();
  }, [cleanup, onClose]);

  const startIcePolling = useCallback(() => {
    iceRef.current = setInterval(async () => {
      if (!callIdRef.current || !pcRef.current) return;
      try {
        const { candidates } = await api.callIceGet(callIdRef.current, lastIceRef.current);
        for (const c of candidates) {
          lastIceRef.current = Math.max(lastIceRef.current, c.id);
          try {
            await pcRef.current.addIceCandidate(JSON.parse(c.candidate));
          } catch { /* ignore */ }
        }
      } catch { /* ignore */ }
    }, 1500);
  }, []);

  const buildPc = useCallback(async () => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pcRef.current = pc;

    const stream = await navigator.mediaDevices.getUserMedia({
      video: callType === "video",
      audio: true,
    });
    localStreamRef.current = stream;
    if (localVideoRef.current) localVideoRef.current.srcObject = stream;
    stream.getTracks().forEach((t) => pc.addTrack(t, stream));

    pc.ontrack = (e) => {
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = e.streams[0];
      setState("active");
    };
    pc.onicecandidate = (e) => {
      if (e.candidate && callIdRef.current) {
        api.callIceAdd(callIdRef.current, e.candidate.toJSON()).catch(() => {});
      }
    };
    return pc;
  }, [callType]);

  // Исходящий звонок
  const startOutgoing = useCallback(async () => {
    const pc = await buildPc();
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    const { call_id } = await api.callStart({
      callee_id: props.calleeId!,
      call_type: callType,
      offer_sdp: JSON.stringify(offer),
    });
    callIdRef.current = call_id;
    startIcePolling();
    pollRef.current = setInterval(async () => {
      try {
        const res = await api.callPoll(call_id);
        if (res.status === "active" && res.answer_sdp && pc.signalingState !== "stable") {
          await pc.setRemoteDescription(JSON.parse(res.answer_sdp));
          setState("connecting");
        }
        if (res.status === "ended") endCall();
      } catch { /* ignore */ }
    }, 1500);
  }, [buildPc, callType, props.calleeId, startIcePolling, endCall]);

  // Входящий — принять
  const acceptIncoming = useCallback(async () => {
    if (!incoming) return;
    setState("connecting");
    const pc = await buildPc();
    await pc.setRemoteDescription(JSON.parse(incoming.offer_sdp));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    await api.callAnswer(incoming.id, JSON.stringify(answer));
    callIdRef.current = incoming.id;
    startIcePolling();
    pollRef.current = setInterval(async () => {
      try {
        const res = await api.callPoll(incoming.id);
        if (res.status === "ended") endCall();
      } catch { /* ignore */ }
    }, 2000);
  }, [incoming, buildPc, startIcePolling, endCall]);

  useEffect(() => {
    if (mode === "outgoing") startOutgoing().catch(() => endCall());
    return () => cleanup();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleMute = () => {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setMuted(!track.enabled);
    }
  };

  const toggleCam = () => {
    const track = localStreamRef.current?.getVideoTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setCamOff(!track.enabled);
    }
  };

  const name = mode === "incoming" ? incoming?.caller_name : calleeName;
  const avatar = mode === "incoming" ? incoming?.caller_avatar : calleeAvatar;

  const statusText: Record<CallState, string> = {
    calling: "Вызов...",
    ringing: callType === "video" ? "Входящий видеозвонок" : "Входящий звонок",
    connecting: "Соединение...",
    active: "В разговоре",
    ended: "Завершён",
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0a0814] flex flex-col">
      <div className="relative flex-1 overflow-hidden">
        {callType === "video" && (
          <video ref={remoteVideoRef} autoPlay playsInline className="absolute inset-0 w-full h-full object-cover" />
        )}
        {(callType === "audio" || state !== "active") && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-gradient-to-b from-violet-900/40 to-[#0a0814]">
            <Avatar name={name || "Пользователь"} url={avatar} size={120} />
            <h2 className="font-golos font-bold text-2xl text-white">{name || "Пользователь"}</h2>
            <p className="text-white/60">{statusText[state]}</p>
          </div>
        )}
        {callType === "video" && (
          <video
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
            className="absolute top-4 right-4 w-28 h-40 rounded-2xl object-cover ring-2 ring-white/20 bg-black"
          />
        )}
      </div>

      <div className="shrink-0 flex items-center justify-center gap-5 py-8">
        {state === "ringing" && mode === "incoming" ? (
          <>
            <button
              onClick={acceptIncoming}
              className="w-16 h-16 rounded-full bg-emerald-500 hover:bg-emerald-600 flex items-center justify-center text-white"
            >
              <Icon name="Phone" size={26} />
            </button>
            <button
              onClick={endCall}
              className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center text-white"
            >
              <Icon name="PhoneOff" size={26} />
            </button>
          </>
        ) : (
          <>
            <button
              onClick={toggleMute}
              className={`w-14 h-14 rounded-full flex items-center justify-center text-white ${muted ? "bg-white/30" : "bg-white/10 hover:bg-white/20"}`}
            >
              <Icon name={muted ? "MicOff" : "Mic"} size={22} />
            </button>
            {callType === "video" && (
              <button
                onClick={toggleCam}
                className={`w-14 h-14 rounded-full flex items-center justify-center text-white ${camOff ? "bg-white/30" : "bg-white/10 hover:bg-white/20"}`}
              >
                <Icon name={camOff ? "VideoOff" : "Video"} size={22} />
              </button>
            )}
            <button
              onClick={endCall}
              className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center text-white"
            >
              <Icon name="PhoneOff" size={26} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
