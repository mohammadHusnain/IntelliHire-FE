import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Building2, Check, Globe, Loader2, Sparkles } from "lucide-react";
import { Card, PageHeader } from "@/components/app/primitives";
import AuthField from "@/components/shared/AuthField";
import Reveal from "@/components/shared/Reveal";
import { useCompanyActions, useCompanyRecord } from "@/store/companyStore";
import { toast } from "@/store/toastStore";
import { ROUTES } from "@/config/routes";

const INDUSTRIES = ["Technology", "Finance", "Healthcare", "Education", "Retail", "Manufacturing", "Consulting", "Media", "Real Estate", "Non-profit", "Other"];
const SIZES = ["1–10 employees", "11–50 employees", "51–200 employees", "201–500 employees", "500+ employees"];

const STEPS = [
  { id: 1, label: "Company" },
  { id: 2, label: "Details" },
  { id: 3, label: "Ready" },
];

export default function CompanyOnboarding() {
  const navigate = useNavigate();
  const record = useCompanyRecord();
  const { updateProfile } = useCompanyActions();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(() => ({ ...record.profile }));
  const [errors, setErrors] = useState({});

  const set = (k, v) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: "" }));
  };

  const next = () => {
    const e = {};
    if (step === 1) {
      if (form.companyName.trim().length < 2) e.companyName = "Enter your company name";
      if (!form.industry) e.industry = "Choose an industry";
    }
    if (step === 2 && form.website && !/^https?:\/\/\S+\.\S+/.test(form.website)) e.website = "Enter a full URL, including https://";
    setErrors(e);
    if (Object.keys(e).length) return;
    setStep((s) => s + 1);
  };

  const finish = async () => {
    setSaving(true);
    await new Promise((r) => setTimeout(r, 400));
    updateProfile(form);
    setSaving(false);
    toast({ title: "Company profile saved", message: "Post your first role whenever you are ready." });
    navigate(ROUTES.COMPANY.JOB_CREATE);
  };

  return (
    <div className="mx-auto max-w-[640px]">
      <PageHeader eyebrow="Set up" title={<>Tell us about <em>your company</em></>} subtitle="Candidates see this on every role you post. You can change it later in Settings." />

      <Reveal>
        <Card className="p-6 sm:p-8">
          <div className="mb-7">
            <div className="flex items-center justify-between text-[12px] font-medium">
              <span className="text-stone-500">Step <span className="font-semibold text-ink">{step}</span> of {STEPS.length}</span>
              <span className="font-semibold text-brand">{STEPS[step - 1].label}</span>
            </div>
            <div className="mt-2.5 flex gap-1.5">
              {STEPS.map((s) => (
                <span key={s.id} className="h-1.5 flex-1 overflow-hidden rounded-full bg-stone-200">
                  <span className="block h-full origin-left rounded-full bg-brand transition-transform duration-500 ease-[var(--ease-premium)]" style={{ transform: `scaleX(${s.id <= step ? 1 : 0})` }} />
                </span>
              ))}
            </div>
          </div>

          <div key={step} className="animate-step-next">
            {step === 1 && (
              <div className="space-y-5">
                <AuthField label="Company name" icon={Building2} value={form.companyName} onChange={(e) => set("companyName", e.target.value)} error={errors.companyName} placeholder="Acme Inc." />
                <div>
                  <label htmlFor="ind" className="mb-1.5 block text-[13px] font-medium text-stone-700">Industry</label>
                  <select id="ind" value={form.industry} onChange={(e) => set("industry", e.target.value)} aria-invalid={errors.industry ? "true" : undefined} className="field cursor-pointer">
                    <option value="">Select an industry</option>
                    {INDUSTRIES.map((i) => <option key={i}>{i}</option>)}
                  </select>
                  {errors.industry && <p className="mt-1.5 text-[12.5px] text-red-600">{errors.industry}</p>}
                </div>
                <div>
                  <label htmlFor="size" className="mb-1.5 block text-[13px] font-medium text-stone-700">Team size</label>
                  <select id="size" value={form.companySize} onChange={(e) => set("companySize", e.target.value)} className="field cursor-pointer">
                    <option value="">Select a size</option>
                    {SIZES.map((i) => <option key={i}>{i}</option>)}
                  </select>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-5">
                <AuthField label="Website" icon={Globe} type="url" value={form.website} onChange={(e) => set("website", e.target.value)} error={errors.website} placeholder="https://yourcompany.com" hint="Optional" />
                <AuthField label="Location" value={form.location} onChange={(e) => set("location", e.target.value)} placeholder="City, Country" hint="Optional" />
                <div>
                  <label htmlFor="about" className="mb-1.5 block text-[13px] font-medium text-stone-700">About the company</label>
                  <textarea
                    id="about"
                    rows={4}
                    value={form.description}
                    onChange={(e) => set("description", e.target.value.slice(0, 500))}
                    placeholder="Your mission, culture and what makes your team a great place to work."
                    className="field !h-auto resize-none py-3 leading-relaxed"
                  />
                  <p className="mt-1 text-[12px] text-stone-400">{(form.description || "").length}/500</p>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="text-center">
                <span className="animate-pop mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                  <Check size={30} />
                </span>
                <h2 className="display mt-5 text-[26px]">{form.companyName} is set up</h2>
                <p className="mt-2 text-[14.5px] leading-relaxed text-stone-500">
                  Next, post a role. IntelliHire generates its application link, scores every CV against your requirements, and runs the first interview rounds.
                </p>
                <ul className="mt-6 space-y-2 text-left">
                  {[["Industry", form.industry], ["Team size", form.companySize || "Not set"], ["Website", form.website || "Not set"]].map(([k, v]) => (
                    <li key={k} className="flex justify-between gap-3 rounded-xl bg-stone-50 px-4 py-2.5 text-[13.5px]">
                      <span className="text-stone-500">{k}</span>
                      <span className="truncate font-medium text-ink">{v}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="mt-8 flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
            {step > 1 ? (
              <button type="button" onClick={() => setStep((s) => s - 1)} className="btn-secondary">
                <ArrowLeft size={16} /> Back
              </button>
            ) : (
              <span className="hidden sm:block" />
            )}
            {step < 3 ? (
              <button type="button" onClick={next} className="btn-primary sm:min-w-[170px]">
                Continue <ArrowRight size={16} className="btn-arrow" />
              </button>
            ) : (
              <button type="button" onClick={finish} disabled={saving} className="btn-primary sm:min-w-[190px]">
                {saving ? <><Loader2 size={16} className="animate-spin" /> Saving…</> : <><Sparkles size={16} /> Post your first role</>}
              </button>
            )}
          </div>
        </Card>
      </Reveal>
    </div>
  );
}
