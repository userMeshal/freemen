import { PageHead } from "@/components/dash/ui";
import { SettingsForm } from "@/components/dash/hq/SettingsForm";
import { requireHq } from "@/lib/auth";
import { getPlatform } from "@/lib/platform";
import { saveSettings } from "./actions";

export const metadata = { title: "الإعدادات" };

export default async function HqSettingsPage() {
  await requireHq();
  const cfg = await getPlatform();

  return (
    <>
      <PageHead title="إعدادات المنصة" sub="العمولة، ضمان زار، وقواعد التحويل اليومي. أي تغيير هنا يسري على كل المتاجر." />
      <div className="max-w-3xl">
        <SettingsForm
          action={saveSettings}
          initial={{
            feePercent: String(cfg.feeBp / 100),
            feeFixed: String(cfg.feeFixed / 100),
            guaranteeDays: String(cfg.guaranteeDays),
            claimReplyHours: String(cfg.claimReplyHours),
            payoutHoldDays: String(cfg.payoutHoldDays),
            payoutMin: String(cfg.payoutMin / 100),
          }}
        />
      </div>
    </>
  );
}
