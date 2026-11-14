import { DesignForm } from "@/components/dash/DesignForm";
import { PageHead } from "@/components/dash/ui";
import { requireMerchantStore } from "@/lib/auth";
import { saveDesign } from "./actions";

export const metadata = { title: "التصميم" };

export default async function DesignPage() {
  const { store } = await requireMerchantStore();
  return (
    <>
      <PageHead title="التصميم" sub="بدّل الثيم والألوان ونصوص الواجهة. التغيير يظهر في متجرك فور الحفظ." />
      <DesignForm action={saveDesign} slug={store.slug} theme={store.theme} palette={store.palette.preset} nameLatin={store.nameLatin} content={store.content} />
    </>
  );
}
