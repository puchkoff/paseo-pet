import type { PluginClientContext } from "@getpaseo/plugin/client";
import { GoScreen, PetItem } from "./client/pet.tsx";

export default function contribute(client: PluginClientContext) {
  client.addScreen({ id: "go", title: "Pet", Component: GoScreen });
  client.addSidebarFooterItem({ id: "pet", title: "Pet", Component: PetItem });
  return () => {};
}
