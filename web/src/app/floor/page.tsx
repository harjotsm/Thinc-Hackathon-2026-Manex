import { PrototypeFloorScreen } from "@/components/prototype/workspace-screens";
import { VoiceRecorder } from "@/components/voice/voice-recorder";

export default function FloorPage() {
  return (
    <>
      <PrototypeFloorScreen />
      <div style={{
        position: "fixed", bottom: 24, right: 24, zIndex: 50,
        background: "white", padding: 12, borderRadius: 12,
        boxShadow: "0 4px 20px rgba(0,0,0,0.12)",
        border: "1px solid #e2e8f0",
      }}>
        <div style={{ fontSize: 10, color: "#64748b", marginBottom: 6, textTransform: "uppercase", letterSpacing: ".05em" }}>
          Real voice capture
        </div>
        <VoiceRecorder sourceSystem="voice_floor" actorUserId="user_042" language="de" />
      </div>
    </>
  );
}
