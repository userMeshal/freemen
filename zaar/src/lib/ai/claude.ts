import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { BlueprintSchema, normalizeBlueprint, type Blueprint } from "../blueprint";
import { parsePartialJson } from "./partial-json";

const DEFAULT_MODEL = "claude-opus-5-5";

export function aiModel(): string {
  return process.env.ZAAR_AI_MODEL || DEFAULT_MODEL;
}

/** الذكاء الاصطناعي يعمل عند ضبط ANTHROPIC_API_KEY؛ بدونه تعمل المنصة بالمولّد المحلي */
export function aiEnabled(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

let client: Anthropic | null = null;
export function anthropic(): Anthropic {
  client ??= new Anthropic({ maxRetries: 1, timeout: 120_000 });
  return client;
}

/** الرجوع التلقائي لنموذج آخر عند رفض الطلب مدعوم على النموذج الافتراضي فقط */
export function fallbackParams(): { betas: string[]; fallbacks: "default" } | Record<string, never> {
  return aiModel() === DEFAULT_MODEL ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" } : {};
}

const SYSTEM = `أنت «زار»، مساعد بناء المتاجر في منصة زار للتجارة الإلكترونية في السعودية.
التاجر يكتب فكرته بكلمات قليلة، ومهمتك أن تبني له متجرًا إلكترونيًا كاملًا جاهزًا للبيع فورًا: هوية، نصوص، تصنيفات، ومنتجات بأسعارها.

من يقرأ ما تكتبه: زبائن سعوديون يتصفحون المتجر من الجوال، والتاجر نفسه الذي قد لا يملك أي خبرة تقنية أو تسويقية. لذلك:
- اكتب نصوص المتجر بعربية واضحة قريبة من اللهجة السعودية البيضاء، مباشرة وبلا مبالغة ولا وعود لا يستطيع التاجر الوفاء بها.
- المنتجات يجب أن تكون واقعية لهذا المجال بأسعار منطقية للسوق السعودي بالريال شاملة الضريبة. إن ذكر التاجر منتجات أو أسعارًا أو اسمًا للمتجر فالتزم بها حرفيًا وأكمل الباقي من عندك.
- لا تخترع أرقام مبيعات أو عدد عملاء أو تقييمات. حقل stats لمواصفات المنتج أو الخدمة فقط (مثل مدة الثبات، الوزن، أيام التوصيل).
- nameLatin كلمة لاتينية واحدة قصيرة تُعرض بحجم عملاق في الواجهة، فاخترها سهلة النطق وجميلة الشكل.
- اختر theme و palette بما يناسب روح العلامة: bold للعلامات الشبابية والجريئة، soft للراقية والهادئة.
- لكل منتج icon من القائمة المسموحة و hue (0-360) يعبّر عن لون المنتج، ونوّع الدرجات بين المنتجات حتى تبدو الواجهة حيّة.
- في حقل reply خاطب التاجر مباشرة بجملة أو جملتين: ماذا بنيت له، وأنه يقدر يعدّل أي شيء بالكلام.

عند طلب تعديل على متجر موجود: ستصلك النسخة الحالية كاملة. أعد المخطط كاملًا بعد تطبيق التعديل المطلوب فقط، واترك كل ما لم يُطلب تغييره كما هو حرفيًا.
لا تبنِ متاجر لمنتجات ممنوعة نظامًا في السعودية (كحول، تبغ وسجائر إلكترونية، أدوية بوصفة، أسلحة، قمار، محتوى للبالغين). إن طُلب ذلك فابنِ بديلاً قريبًا مسموحًا واشرح السبب في reply.`;

export type BuildEvent = { type: "partial"; draft: Partial<Blueprint> } | { type: "final"; blueprint: Blueprint };

/**
 * يبني مخطط المتجر مع بثّ النسخ الجزئية أولًا بأول (لتظهر المنتجات أمام التاجر وهي تُكتب).
 * يرمي خطأ عند الرفض أو الانقطاع؛ المستدعي يتحوّل للمولّد المحلي.
 */
export async function* buildWithClaude(input: { idea: string; current?: Blueprint; instruction?: string }): AsyncGenerator<BuildEvent> {
  const user = input.current
    ? `المتجر الحالي (JSON):\n${JSON.stringify(input.current)}\n\nالتعديل المطلوب من التاجر:\n${input.instruction ?? ""}`
    : `فكرة التاجر:\n${input.idea}`;

  const stream = anthropic().beta.messages.stream({
    model: aiModel(),
    max_tokens: 16000,
    system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: user }],
    output_config: { effort: "low", format: betaZodOutputFormat(BlueprintSchema) },
    ...fallbackParams(),
  });

  let text = "";
  let lastEmit = 0;
  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      text += event.delta.text;
      if (text.length - lastEmit > 220) {
        lastEmit = text.length;
        const draft = parsePartialJson<Partial<Blueprint>>(text);
        if (draft) yield { type: "partial", draft };
      }
    }
  }

  const message = await stream.finalMessage();
  if (message.stop_reason === "refusal") throw new Error("ai_refusal");
  if (message.stop_reason === "max_tokens") throw new Error("ai_truncated");
  const full = message.content.map((b) => (b.type === "text" ? b.text : "")).join("");
  const parsed = BlueprintSchema.safeParse(JSON.parse(full));
  if (!parsed.success) throw new Error("ai_invalid_output");
  yield { type: "final", blueprint: normalizeBlueprint(parsed.data) };
}

/** وصف تسويقي لمنتج واحد (زر «اكتب الوصف بالذكاء» في لوحة التاجر) */
export async function writeProductDescription(input: { storeName: string; vertical: string; productName: string; hints: string }): Promise<string> {
  const message = await anthropic().beta.messages.create({
    model: aiModel(),
    max_tokens: 2000,
    system:
      "اكتب وصفًا تسويقيًا لمنتج في متجر إلكتروني سعودي: جملتان إلى ثلاث، عربية واضحة قريبة من اللهجة السعودية البيضاء، تذكر الفائدة قبل المواصفة، بلا مبالغة ولا ادعاءات طبية ولا رموز تعبيرية. أعد نص الوصف فقط.",
    messages: [
      {
        role: "user",
        content: `المتجر: ${input.storeName} (${input.vertical})\nالمنتج: ${input.productName}\nملاحظات التاجر: ${input.hints || "لا يوجد"}`,
      },
    ],
    output_config: { effort: "low" },
    ...fallbackParams(),
  });
  if (message.stop_reason === "refusal") throw new Error("ai_refusal");
  return message.content
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("")
    .trim()
    .slice(0, 600);
}
