import { AssistantChat } from "@/components/dash/AssistantChat";
import { PageHead } from "@/components/dash/ui";
import { requireMerchantStore } from "@/lib/auth";
import { aiEnabled } from "@/lib/ai/claude";

export const metadata = { title: "مساعد زار" };

export default async function AssistantPage() {
  const { store } = await requireMerchantStore();
  return (
    <>
      <PageHead title="مساعد زار" sub="أدر متجرك بالكلام: أضف منتجات، عدّل الأسعار، سوِّ كوبونات، غيّر التصميم، أو اسأل عن مبيعاتك." />
      <AssistantChat storeName={store.name} ai={aiEnabled()} />
    </>
  );
}
