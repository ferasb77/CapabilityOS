import { AssetInventory } from "@/features/assets/components/asset-inventory";
import { getAllAssets } from "@/features/assets/data";
import { getSessionContext } from "@/infrastructure/session/session-context";

export default async function AssetsPage() {
  const session = await getSessionContext();
  const assets = await getAllAssets(session.workspaceId);

  return <AssetInventory assets={assets} />;
}
