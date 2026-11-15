declare module "moyasar-payment-form" {
  const Moyasar: { init: (config: Record<string, unknown>) => void; setAmount: (amount: number) => void };
  export default Moyasar;
}
