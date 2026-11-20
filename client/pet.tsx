import { usePaseo, type PluginSidebarItemProps } from "@getpaseo/plugin/client";
import { SidebarRow } from "@getpaseo/plugin/client/ui";
import { useEffect, useState } from "react";
import { Text } from "react-native";

type Mood = "sleep" | "work" | "call" | "purr";

const FRAMES: Record<Mood, string[]> = {
  sleep: ["😺💤", "😸 z", "😺 zZ"],
  work: ["🐈 ", " 🐈", "  🐈", " 🐈"],
  call: ["🙀❗", "😾❗"],
  purr: ["😻💕", "😽💕"],
};

const LABEL: Record<Mood, (n: number) => string> = {
  sleep: () => "Cat is asleep",
  work: (n) => `Cat helps ${n} agent${n === 1 ? "" : "s"}`,
  call: (n) => `${n} agent${n === 1 ? " needs" : "s need"} you!`,
  purr: () => "Purr…",
};

function useAgentMood(): { mood: Exclude<Mood, "purr">; count: number } {
  const paseo = usePaseo();
  const [state, setState] = useState<{ mood: Exclude<Mood, "purr">; count: number }>({ mood: "sleep", count: 0 });
  useEffect(() => {
    let alive = true;
    const poll = async () => {
      try {
        const { entries } = await paseo.agents.list({
          filter: { statuses: ["running", "idle"], includeArchived: false },
          page: { limit: 200 },
        });
        const agents = entries.map((e) => e.agent).filter((a) => !a.archivedAt);
        const calling = agents.filter((a) => a.pendingPermissions.length > 0).length;
        const working = agents.filter((a) => a.status === "running").length;
        if (!alive) return;
        setState(calling ? { mood: "call", count: calling } : working ? { mood: "work", count: working } : { mood: "sleep", count: 0 });
      } catch {
        // Host offline: the cat keeps its last mood.
      }
    };
    void poll();
    const timer = setInterval(poll, 3000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [paseo]);
  return state;
}

export function PetItem({ theme }: PluginSidebarItemProps) {
  const { mood: agentMood, count } = useAgentMood();
  const [pettedUntil, setPettedUntil] = useState(0);
  const [tick, setTick] = useState(0);
  const mood: Mood = Date.now() < pettedUntil ? "purr" : agentMood;
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), mood === "sleep" ? 1200 : 350);
    return () => clearInterval(timer);
  }, [mood]);
  const frames = FRAMES[mood];
  return (
    <SidebarRow
      icon="Cat"
      label={LABEL[mood](count)}
      onPress={() => setPettedUntil(Date.now() + 2500)}
      trailing={
        <Text style={{ color: theme.colors.foreground, fontSize: 15, marginRight: 8, minWidth: 44 }}>
          {frames[tick % frames.length]}
        </Text>
      }
    />
  );
}
