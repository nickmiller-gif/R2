import { useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useState } from 'react';
import { postIdea } from '@/lib/api/postIdea';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Label } from '@/components/ui/Label';
import type { IdeaSubmission } from '@/types/validation';

const schema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters').max(80, 'Max 80 characters'),
  problemStatement: z.string().min(10, 'Please describe the problem').max(300, 'Max 300 characters'),
  targetUser: z.string().min(5, 'Please describe your target user').max(150, 'Max 150 characters'),
  stage: z.enum(['idea', 'landing-page', 'prototype', 'mvp']),
  prototypeUrl: z.string().url('Must be a valid URL').optional().or(z.literal('')),
  successCriterion: z.string().min(5, 'Please describe what success looks like').max(200, 'Max 200 characters'),
});

type FormValues = z.infer<typeof schema>;

const stages: { value: IdeaSubmission['stage']; label: string }[] = [
  { value: 'idea', label: 'Idea' },
  { value: 'landing-page', label: 'Landing page' },
  { value: 'prototype', label: 'Prototype' },
  { value: 'mvp', label: 'MVP' },
];

export default function SubmitPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tier = (searchParams.get('tier') ?? 'starter') as 'starter' | 'standard';
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { stage: 'idea' },
  });

  const titleLength = watch('title')?.length ?? 0;
  const problemLength = watch('problemStatement')?.length ?? 0;
  const successLength = watch('successCriterion')?.length ?? 0;

  async function onSubmit(data: FormValues) {
    setSubmitError(null);
    try {
      const { batchId } = await postIdea(
        {
          title: data.title,
          problemStatement: data.problemStatement,
          targetUser: data.targetUser,
          stage: data.stage,
          prototypeUrl: data.prototypeUrl || undefined,
          successCriterion: data.successCriterion,
        },
        tier,
      );
      navigate(`/checkout?batchId=${batchId}&tier=${tier}&title=${encodeURIComponent(data.title)}`);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <header className="mb-10">
        <h1 className="font-serif text-4xl font-bold text-ink">Submit your idea</h1>
        <p className="mt-3 font-sans text-ink-muted">
          Tell us about what you&apos;re building. We&apos;ll match you with a researcher and have real-user
          feedback in your inbox within 48 hours.
        </p>
        <p className="mt-2 font-mono text-xs text-ink-faint">Package: {tier === 'standard' ? 'Standard (10 interviews · $149)' : 'Starter (5 interviews · $99)'}</p>
      </header>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-7">
        {/* Title */}
        <div className="space-y-1.5">
          <Label htmlFor="title" required>
            Idea title
            <span className="ml-2 font-mono text-xs font-normal text-ink-faint">{titleLength}/80</span>
          </Label>
          <Input
            id="title"
            placeholder="e.g. AI-powered invoice reconciliation for freelancers"
            maxLength={80}
            error={errors.title?.message}
            {...register('title')}
          />
          {errors.title && <p className="font-sans text-xs text-red-500" role="alert">{errors.title.message}</p>}
        </div>

        {/* Problem statement */}
        <div className="space-y-1.5">
          <Label htmlFor="problemStatement" required>
            What problem does it solve?
            <span className="ml-2 font-mono text-xs font-normal text-ink-faint">{problemLength}/300</span>
          </Label>
          <Textarea
            id="problemStatement"
            rows={4}
            placeholder="Describe the pain or problem your idea addresses..."
            maxLength={300}
            error={errors.problemStatement?.message}
            {...register('problemStatement')}
          />
          {errors.problemStatement && (
            <p className="font-sans text-xs text-red-500" role="alert">{errors.problemStatement.message}</p>
          )}
        </div>

        {/* Target user */}
        <div className="space-y-1.5">
          <Label htmlFor="targetUser" required>
            Who is your target user?
          </Label>
          <Input
            id="targetUser"
            placeholder="e.g. Solo founders using AI tools to build products"
            maxLength={150}
            error={errors.targetUser?.message}
            {...register('targetUser')}
          />
          {errors.targetUser && <p className="font-sans text-xs text-red-500" role="alert">{errors.targetUser.message}</p>}
        </div>

        {/* Stage */}
        <fieldset className="space-y-2">
          <legend className="font-sans text-sm font-medium text-ink">
            Current stage <span aria-hidden className="ml-1 text-red-500">*</span>
          </legend>
          <div className="flex flex-wrap gap-3">
            {stages.map(({ value, label }) => (
              <label key={value} className="flex cursor-pointer items-center gap-2">
                <input
                  type="radio"
                  value={value}
                  className="accent-brand-600"
                  {...register('stage')}
                />
                <span className="font-sans text-sm text-ink">{label}</span>
              </label>
            ))}
          </div>
          {errors.stage && <p className="font-sans text-xs text-red-500" role="alert">{errors.stage.message}</p>}
        </fieldset>

        {/* Prototype URL */}
        <div className="space-y-1.5">
          <Label htmlFor="prototypeUrl">
            Prototype or landing page URL{' '}
            <span className="font-sans text-xs font-normal text-ink-faint">(optional)</span>
          </Label>
          <Input
            id="prototypeUrl"
            type="url"
            placeholder="https://..."
            error={errors.prototypeUrl?.message}
            {...register('prototypeUrl')}
          />
          {errors.prototypeUrl && <p className="font-sans text-xs text-red-500" role="alert">{errors.prototypeUrl.message}</p>}
        </div>

        {/* Success criterion */}
        <div className="space-y-1.5">
          <Label htmlFor="successCriterion" required>
            What would &ldquo;yes&rdquo; look like to you?
            <span className="ml-2 font-mono text-xs font-normal text-ink-faint">{successLength}/200</span>
          </Label>
          <Textarea
            id="successCriterion"
            rows={3}
            placeholder="e.g. At least 3 of 5 users say they'd pay for this and describe a real problem it solves"
            maxLength={200}
            error={errors.successCriterion?.message}
            {...register('successCriterion')}
          />
          {errors.successCriterion && (
            <p className="font-sans text-xs text-red-500" role="alert">{errors.successCriterion.message}</p>
          )}
        </div>

        {submitError && (
          <div role="alert" className="rounded border border-red-200 bg-red-50 px-4 py-3 font-sans text-sm text-red-700">
            {submitError}
          </div>
        )}

        <Button type="submit" size="lg" loading={isSubmitting} className="w-full">
          Continue to payment →
        </Button>
      </form>
    </div>
  );
}
