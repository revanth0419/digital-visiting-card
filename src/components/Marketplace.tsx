import { useState } from "react";
import { Sparkles, CheckCircle2, Crown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

type Plan = {
  id: string;
  name: string;
  price: string;
  description: string;
  features: string[];
  accent: string;
  popular?: boolean;
};

const plans: Plan[] = [
  {
    id: "basic",
    name: "Basic",
    price: "$9",
    description: "Great for trying AI publishing and light usage.",
    features: ["50 AI credits / month", "Community templates", "Standard support"],
    accent: "from-slate-800 to-slate-900",
  },
  {
    id: "pro",
    name: "Pro",
    price: "$24",
    description: "For creators publishing consistently every week.",
    features: ["500 AI credits / month", "Priority queue", "Brand kit & custom covers", "Email support"],
    accent: "from-blue-700 to-indigo-700",
    popular: true,
  },
  {
    id: "elite",
    name: "Elite",
    price: "$59",
    description: "For teams shipping premium stories & music on demand.",
    features: [
      "3,000 AI credits / month",
      "Team seats (up to 5)",
      "Dedicated success manager",
      "Webhooks + API access",
    ],
    accent: "from-amber-600 to-rose-600",
  },
];

const Marketplace = () => {
  const { toast } = useToast();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  const handleChoosePlan = async (planId: string) => {
    setLoadingPlan(planId);
    try {
      const { data, error } = await apiFetch<{ checkoutUrl?: string }>("/create-checkout-session", {
        method: "POST",
        data: { planId },
      });

      if (data?.checkoutUrl) {
        window.location.href = data.checkoutUrl;
        return;
      }

      alert("Checkout is not available yet. Please try again later.");

      if (error) {
        toast({
          title: "Checkout unavailable",
          description: typeof error === "string" ? error : "We could not start checkout.",
          variant: "destructive",
        });
      }
    } catch (err) {
      console.error("[Marketplace] checkout error", err);
      alert("Checkout is not available yet. Please try again later.");
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-slate-200">
        <Crown className="w-5 h-5 text-amber-400" />
        <div>
          <p className="text-sm text-slate-400">Marketplace</p>
          <h3 className="text-xl font-semibold text-slate-50">Choose your pro experience</h3>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {plans.map((plan) => (
          <Card
            key={plan.id}
            className={`relative overflow-hidden border border-slate-800 bg-slate-900/70`}
          >
            <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${plan.accent}`} />
            {plan.popular && (
              <Badge className="absolute right-3 top-3 bg-emerald-500 text-slate-900 hover:bg-emerald-500">
                Most Popular
              </Badge>
            )}

            <CardHeader className="space-y-2">
              <CardTitle className="flex items-center justify-between text-slate-100">
                <span className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-blue-300" />
                  {plan.name}
                </span>
                <span className="text-2xl font-bold">
                  {plan.price}
                  <span className="text-sm font-medium text-slate-400">/mo</span>
                </span>
              </CardTitle>
              <p className="text-sm text-slate-400">{plan.description}</p>
            </CardHeader>

            <CardContent className="space-y-4">
              <ul className="space-y-2 text-sm text-slate-200">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <Button
                type="button"
                disabled={loadingPlan === plan.id}
                onClick={() => handleChoosePlan(plan.id)}
                className="w-full bg-blue-600 text-white hover:bg-blue-500"
              >
                {loadingPlan === plan.id ? "Preparing checkout..." : "Choose Plan"}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default Marketplace;

