import {
  getPaseoClient,
  useHosts,
  type PluginPopoverProps,
  type PluginScreenProps,
  type PluginSidebarItemProps,
  type PluginSurfaceProps,
} from "@getpaseo/plugin/client";
import { SidebarRow } from "@getpaseo/plugin/client/ui";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

const WALK = 40;
const WALK_STEPS = 16;

type Mood = "sleep" | "work" | "call" | "purr";

interface Pet {
  name: string;
  icon: string;
  frames: Record<Mood, string[]>;
  purr: string;
}

// Walking emoji must face left: they are mirrored on the way right.
const PETS = {
  cat: {
    name: "Cat",
    icon: "Cat",
    frames: {
      sleep: ["😺💤", "😸 z", "😺 zZ"],
      work: ["🐈"],
      call: ["🙀❗", "😾❗"],
      purr: ["😻💕", "😽💕"],
    },
    purr: "Purr…",
  },
  rottweiler: {
    name: "Rottweiler",
    icon: "Dog",
    frames: {
      sleep: ["🐶💤", "🐶 z", "🐶 zZ"],
      work: ["🐕"],
      call: ["🐕❗", "🐶❗"],
      purr: ["🐶💕", "🐕💕"],
    },
    purr: "Woof!",
  },
} satisfies Record<string, Pet>;

type PetKind = keyof typeof PETS;
const STORAGE_KEY = "paseo-pet:kind";

// localStorage is missing on native, so the choice there lasts until reload.
function loadKind(): PetKind {
  try {
    const v = globalThis.localStorage?.getItem(STORAGE_KEY);
    if (v && v in PETS) return v as PetKind;
  } catch {}
  return "rottweiler";
}

let kind = loadKind();
const listeners = new Set<(k: PetKind) => void>();

function setKind(k: PetKind) {
  kind = k;
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, k);
  } catch {}
  for (const l of listeners) l(k);
}

function usePetKind(): PetKind {
  const [k, setK] = useState(kind);
  useEffect(() => {
    listeners.add(setK);
    return () => void listeners.delete(setK);
  }, []);
  return k;
}

function label(pet: Pet, mood: Mood, n: number): string {
  if (mood === "sleep") return `${pet.name} is asleep`;
  if (mood === "work") return `${pet.name} helps ${n} agent${n === 1 ? "" : "s"}`;
  if (mood === "call") return `${n} agent${n === 1 ? " needs" : "s need"} you!`;
  return pet.purr;
}

export interface PetAgent {
  key: string;
  agentId: string;
  serverId: string;
  hostLabel: string;
  title: string;
  workspace: string;
  needsYou: boolean;
}

type Agent = Awaited<ReturnType<ReturnType<typeof getPaseoClient>["agents"]["list"]>>["entries"][number]["agent"];

// Running agents plus, for a workspace that is working with no running agent (background
// subagents), its latest agent — the same set as paseo-running/shared/running.ts.
async function hostAgents(serverId: string, hostLabel: string): Promise<PetAgent[]> {
  const paseo = getPaseoClient(serverId);
  const [{ entries }, workspaces] = await Promise.all([
    paseo.agents.list({ filter: { statuses: ["running", "idle"], includeArchived: false }, page: { limit: 200 } }),
    paseo.workspaces.list(),
  ]);
  const ws = new Map(workspaces.entries.map((w) => [w.id, w]));
  const picked: Agent[] = [];
  const busy = new Set<string>();
  const latestIdle = new Map<string, Agent>();
  for (const { agent } of entries) {
    const w = agent.workspaceId ? ws.get(agent.workspaceId) : undefined;
    if (agent.archivedAt || (agent.workspaceId && !w)) continue;
    if (agent.status === "running" || agent.pendingPermissions.length > 0) {
      picked.push(agent);
      if (agent.workspaceId) busy.add(agent.workspaceId);
    } else if (agent.workspaceId && w?.status === "running") {
      const prev = latestIdle.get(agent.workspaceId);
      if (!prev || agent.updatedAt > prev.updatedAt) latestIdle.set(agent.workspaceId, agent);
    }
  }
  for (const [id, agent] of latestIdle) if (!busy.has(id)) picked.push(agent);
  return picked.map((agent) => ({
    key: `${serverId}:${agent.id}`,
    agentId: agent.id,
    serverId,
    hostLabel,
    title: agent.title ?? agent.id.slice(0, 8),
    workspace: (agent.workspaceId && ws.get(agent.workspaceId)?.name) || "",
    needsYou: agent.pendingPermissions.length > 0,
  }));
}

function usePetAgents(): PetAgent[] {
  const hosts = useHosts();
  // getPaseoClient borrows the app's connection, so the pet sees agents on every host.
  const online = hosts.filter((h) => h.status === "online").map((h) => `${h.serverId}\t${h.label}`).join("\n");
  const [agents, setAgents] = useState<PetAgent[]>([]);
  useEffect(() => {
    let alive = true;
    const poll = async () => {
      const lists = await Promise.all(
        online.split("\n").filter(Boolean).map((line) => {
          const [id, label] = line.split("\t");
          // Host offline or failing: skip it this round.
          return hostAgents(id, label).catch(() => [] as PetAgent[]);
        }),
      );
      if (alive) setAgents(lists.flat());
    };
    void poll();
    const timer = setInterval(poll, 3000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [online]);
  return agents;
}

function AgentsPopover({ theme, close, openScreen, ...rest }: PluginPopoverProps) {
  const agents = usePetAgents();
  const current = usePetKind();
  // Popover props carry no navigation in the SDK types; fall back to the redirect screen.
  const navigation = (rest as Partial<PluginSurfaceProps>).navigation;
  const go = (a: PetAgent) => {
    close();
    if (navigation) navigation.openAgent({ agentId: a.agentId, serverId: a.serverId });
    else openScreen({ screenId: "go", params: { agentId: a.agentId, serverId: a.serverId } });
  };
  return (
    <ScrollView style={{ width: "100%", minWidth: 320, alignSelf: "stretch", maxHeight: 520, backgroundColor: theme.colors.surface0 }} contentContainerStyle={{ padding: 8, gap: 2 }}>
      <View style={{ flexDirection: "row", gap: 6, padding: 8 }}>
        {(Object.keys(PETS) as PetKind[]).map((k) => (
          <Pressable
            key={k}
            accessibilityRole="button"
            accessibilityState={{ selected: k === current }}
            onPress={() => setKind(k)}
            style={{ paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999, backgroundColor: k === current ? theme.colors.surface2 : "transparent" }}
          >
            <Text style={{ color: theme.colors.foreground, fontSize: 15 }}>
              {PETS[k].frames.work[0]} {PETS[k].name}
            </Text>
          </Pressable>
        ))}
      </View>
      {agents.length === 0 ? (
        <Text style={{ color: theme.colors.foregroundMuted, fontSize: 16, padding: 8 }}>The {PETS[current].name} is asleep: no agents working.</Text>
      ) : (
        agents.map((a) => (
          <Pressable
            key={a.key}
            accessibilityRole="button"
            accessibilityLabel={`Open agent ${a.title}`}
            onPress={() => go(a)}
            style={({ pressed }) => ({ padding: 10, borderRadius: 8, backgroundColor: pressed ? theme.colors.surface2 : "transparent" })}
          >
            <Text style={{ color: theme.colors.foreground, fontSize: 17, lineHeight: 22 }} numberOfLines={1}>
              {a.needsYou ? "❗ " : "🐾 "}
              {a.title}
            </Text>
            <Text style={{ color: theme.colors.foregroundMuted, fontSize: 15, lineHeight: 20 }} numberOfLines={1}>
              {[a.workspace, a.hostLabel].filter(Boolean).join(" · ")}
            </Text>
          </Pressable>
        ))
      )}
    </ScrollView>
  );
}

// Opened from the popover when the host gives it no navigation: jump to the agent right away.
export function GoScreen({ params, navigation, theme }: PluginScreenProps) {
  useEffect(() => {
    if (params.agentId) navigation?.openAgent({ agentId: params.agentId, serverId: params.serverId });
  }, [params.agentId, params.serverId, navigation]);
  return <Text style={{ color: theme.colors.foregroundMuted, padding: 16 }}>Opening agent…</Text>;
}

export function PetItem({ theme, openPopover }: PluginSidebarItemProps) {
  const agents = usePetAgents();
  const pet: Pet = PETS[usePetKind()];
  const calling = agents.filter((a) => a.needsYou).length;
  const agentMood: Exclude<Mood, "purr"> = calling ? "call" : agents.length ? "work" : "sleep";
  const count = calling || agents.length;
  const [pettedUntil, setPettedUntil] = useState(0);
  const [tick, setTick] = useState(0);
  const mood: Mood = Date.now() < pettedUntil ? "purr" : agentMood;
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), mood === "sleep" ? 1200 : mood === "work" ? 150 : 350);
    return () => clearInterval(timer);
  }, [mood]);
  const frames = pet.frames[mood];
  // Walks 0..WALK px and back.
  const step = tick % (2 * WALK_STEPS);
  const goingRight = step < WALK_STEPS;
  const offset = mood === "work" ? (goingRight ? step : 2 * WALK_STEPS - step) * (WALK / WALK_STEPS) : 0;
  return (
    <SidebarRow
      icon={pet.icon}
      label={label(pet, mood, count)}
      onPress={() => {
        setPettedUntil(Date.now() + 2500);
        openPopover(AgentsPopover);
      }}
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
