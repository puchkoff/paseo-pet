import type { PluginClientContext } from "@getpaseo/plugin/client";
import { PetItem } from "./client/pet.tsx";

export default function contribute(client: PluginClientContext) {
  client.addSidebarFooterItem({ id: "pet", title: "Pet", Component: PetItem });
  return () => {};
}
