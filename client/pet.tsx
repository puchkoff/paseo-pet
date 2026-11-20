import { getPaseoClient, useHosts, type PluginSidebarItemProps } from "@getpaseo/plugin/client";
import { SidebarRow } from "@getpaseo/plugin/client/ui";
import { useEffect, useState } from "react";
import { Text, View } from "react-native";

const WALK = 40;
const WALK_STEPS = 8;

type Mood = "sleep" | "work" | "call" | "purr";

const FRAMES: Record<Mood, string[]> = {
  sleep: ["😺💤", "😸 z", "😺 zZ"],
  work: ["🐈"],
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
  const hosts = useHosts();
  // getPaseoClient borrows the app's connection, so the cat sees agents on every host.
  const online = hosts.filter((h) => h.status === "online").map((h) => h.serverId).join(",");
  const [state, setState] = useState<{ mood: Exclude<Mood, "purr">; count: number }>({ mood: "sleep", count: 0 });
  useEffect(() => {
    let alive = true;
    const poll = async () => {
      try {
        // Counts working workspaces like the sidebar's "Working": a workspace stays working while
        // background subagents run after its agent's turn ended.
        const perHost = await Promise.all(
          online.split(",").filter(Boolean).map(async (id) => {
            const paseo = getPaseoClient(id);
            try {
              const [agents, workspaces] = await Promise.all([
                paseo.agents.list({ filter: { statuses: ["running", "idle"], includeArchived: false }, page: { limit: 200 } }),
                paseo.workspaces.list(),
              ]);
              return {
                calling: agents.entries.filter((e) => !e.agent.archivedAt && e.agent.pendingPermissions.length > 0).length,
                working: workspaces.entries.filter((w) => w.status === "running").length,
              };
            } catch {
              return { calling: 0, working: 0 };
            }
          }),
        );
        const calling = perHost.reduce((n, h) => n + h.calling, 0);
        const working = perHost.reduce((n, h) => n + h.working, 0);
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
  }, [online]);
  return state;
}

export function PetItem({ theme }: PluginSidebarItemProps) {
  const { mood: agentMood, count } = useAgentMood();
  const [pettedUntil, setPettedUntil] = useState(0);
  const [tick, setTick] = useState(0);
  const mood: Mood = Date.now() < pettedUntil ? "purr" : agentMood;
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), mood === "sleep" ? 1200 : mood === "work" ? 150 : 350);
    return () => clearInterval(timer);
  }, [mood]);
  const frames = FRAMES[mood];
  // Walks 0..WALK px and back; the emoji faces left, so it is mirrored on the way right.
  const step = tick % (2 * WALK_STEPS);
  const goingRight = step < WALK_STEPS;
  const offset = mood === "work" ? (goingRight ? step : 2 * WALK_STEPS - step) * (WALK / WALK_STEPS) : 0;
  return (
    <SidebarRow
      icon="Cat"
      label={LABEL[mood](count)}
      onPress={() => setPettedUntil(Date.now() + 2500)}
      trailing={
        <View style={{ width: 72 + WALK, marginRight: 8 }}>
          <Text
            style={{
              color: theme.colors.foreground,
              fontSize: 26,
              lineHeight: 30,
              alignSelf: "flex-start",
              marginLeft: offset,
              transform: mood === "work" && goingRight ? [{ scaleX: -1 }] : [],
            }}
          >
            {frames[tick % frames.length]}
          </Text>
        </View>
      }
    />
  );
}
