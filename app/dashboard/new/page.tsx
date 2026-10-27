import { NewProjectForm } from "@/components/dashboard/new-project-form";
import { HopText } from "@/components/motion/hop-text";

export const metadata = { title: "New app" };

export default async function NewProjectPage({ searchParams }: { searchParams: Promise<{ prompt?: string }> }) {
  const { prompt } = await searchParams;
  return (
    <div className="mx-auto max-w-[1100px] py-6">
      <div className="mb-8 text-center">
        <div className="text-[12px] shimmer font-medium tracking-[0.02em]">New app</div>
        <HopText
          as="h1"
          trigger="load"
          text="Describe it. We'll *build it.*"
          className="text-heading mx-auto mt-2 max-w-[20ch] text-balance text-[clamp(2rem,4.5vw,3.2rem)] font-black leading-[1] tracking-[-0.035em]"
        />
      </div>
      <NewProjectForm initialPrompt={typeof prompt === "string" ? prompt.slice(0, 8000) : ""} />
    </div>
  );
}
