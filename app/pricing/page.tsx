import { plans } from "@/lib/data";

export default function PricingPage() {
  return (
    <main className="wrap">
      <section>
        <h1>الباقات</h1>
        <p className="lead">نموذج ربح واضح: اشتراك + عمولة + رسوم ضمان اختيارية.</p>
        <div className="grid3">
          {plans.map((plan) => (
            <div className={`card price ${plan.featured ? "popular" : ""}`} key={plan.name}>
              {plan.featured && <span className="tag">الأفضل</span>}
              <h3>{plan.name}</h3>
              <p>{plan.description}</p>
              <div className="money">{plan.price}</div>
              <ul>
                {plan.features.map((feature) => <li key={feature}>{feature}</li>)}
              </ul>
              <button className={plan.featured ? "btn" : "btn secondary"}>اختيار الباقة</button>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
