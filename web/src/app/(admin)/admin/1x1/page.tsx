import { WorkInProgress } from "../../_components/wip";
import { denyUnlessPermission } from "../../_components/permission-gate";

// 1х1 — будущий турнир один-на-один. Пока заглушка: держит место в навигации админки.
export default async function OneVsOnePage() {
  const denied = await denyUnlessPermission("tools", "1х1");
  if (denied) return denied;

  return (
    <WorkInProgress
      title="1х1"
      note="Турнир один-на-один: сетка, счёт и разбор. Сейчас в разработке."
    />
  );
}
