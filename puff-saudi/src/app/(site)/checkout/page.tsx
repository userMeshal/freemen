import type { Metadata } from "next";
import { getCustomer } from "@/lib/auth";
import { displayPhone } from "@/lib/normalize";
import { PageHero } from "@/components/site/PageHero";
import { CheckoutForm } from "./CheckoutForm";

export const metadata: Metadata = { title: "إتمام الطلب", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function CheckoutPage() {
  const customer = await getCustomer();
  return (
    <>
      <PageHero eyebrow="Checkout" title="إتمام الطلب." crumbs={[{ href: "/cart", label: "السلة" }, { label: "إتمام الطلب" }]} />
      <div className="wrap pb-24 md:pb-32">
        <CheckoutForm
          prefill={{
            name: customer?.name ?? "",
            phone: customer ? displayPhone(customer.phone) : "",
            email: customer?.email ?? "",
            city: customer?.address?.city ?? "",
            district: customer?.address?.district ?? "",
            street: customer?.address?.street ?? "",
          }}
        />
      </div>
    </>
  );
}
