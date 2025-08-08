import { useState, useEffect } from 'react';
import { Mail, User, CheckCircle, Building2, AlertCircle, X } from 'lucide-react';
import { Button } from '../components/ui/button.tsx';
import { Input } from '../components/ui/input.tsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select.tsx';
import { validateLeadForm, ValidationError } from '../lib/validation.ts';
import { supabase } from '../integrations/supabase/client.ts';

export const LeadCaptureForm = () => {
  const [formData, setFormData] = useState({ name: '', email: '', industry: '' });
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentLead, setCurrentLead] = useState<{
    name: string;
    email: string;
    industry: string;
    position?: number;
    total_leads?: number;
  } | null>(null);

  useEffect(() => {
    setSubmitted(false);
  }, []);

  const getFieldError = (field: string) => {
    return validationErrors.find(error => error.field === field)?.message;
  };

  const clearSubmitError = () => {
    setSubmitError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Clear any previous submit errors
    setSubmitError(null);
    setIsSubmitting(true);

    const errors = validateLeadForm(formData);
    setValidationErrors(errors);
    if (errors.length > 0) {
      setIsSubmitting(false);
      return;
    }

    try {
      // 1. Persist the lead in your "leads" table
      const { data: insertedLeads, error: insertError } = await supabase
        .from('leads')
        .insert([{
          name: formData.name,
          email: formData.email,
          industry: formData.industry,
          submitted_at: new Date().toISOString(),
        }])
        .select(); // Ensure data is returned

      if (insertError) throw insertError;

      // 2. Check if lead was inserted
      if (!insertedLeads || (Array.isArray(insertedLeads) && insertedLeads.length === 0)) {
        throw new Error('No lead was inserted.');
      }

      const newLead = Array.isArray(insertedLeads) ? insertedLeads[0] : insertedLeads;

      // 3. Get total leads count for position calculation (optional)
      let leadPosition = undefined;
      let totalLeads = undefined;

      try {
        const { count, error: countError } = await supabase
          .from('leads')
          .select('*', { count: 'exact', head: true });

        if (!countError && count !== null) {
          totalLeads = count;
          leadPosition = count; // This user is the newest lead
        }
      } catch (countErr) {
        console.warn('Could not fetch lead count:', countErr);
        // Continue without position info
      }

      // 4. Set the current lead info
      setCurrentLead({
        name: newLead.name,
        email: newLead.email,
        industry: newLead.industry,
        position: leadPosition,
        total_leads: totalLeads
      });

      // 5. Try to send confirmation email (non-blocking)
      try {
        const { error: emailError } = await supabase.functions.invoke(
          'send-confirmation',
          {
            body: {
              name: newLead.name,
              email: newLead.email,
              industry: newLead.industry,
            },
            headers: {
              // use your PUBLIC anon key here:
              Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY!}`,
            },
          }
        );

        if (emailError) {
          console.error('Unable to send confirmation email:', emailError);
          // Don't throw - email failure shouldn't block success state
        } else {
          console.log('Confirmation email sent successfully');
        }
      } catch (emailErr) {
        console.error('Email function failed:', emailErr);
        // Continue to success state even if email fails
      }

      // 6. Show success state
      setSubmitted(true);
      setFormData({ name: '', email: '', industry: '' });

    } catch (err) {
      console.error('Lead submission failed:', err);

      // Set user-friendly error message
      let errorMessage = 'Something went wrong. Please try again.';

      if (err instanceof Error) {
        // Handle specific error types
        if (err.message.includes('network') || err.message.includes('fetch')) {
          errorMessage = 'Network error. Please check your connection and try again.';
        } else if (err.message.includes('email')) {
          errorMessage = 'There was an issue with your email. Please check and try again.';
        } else if (err.message.includes('database') || err.message.includes('insert')) {
          errorMessage = 'Unable to save your information. Please try again in a moment.';
        } else if (err.message === 'Simulated error for testing') {
          errorMessage = 'This is a test error. The form submission was blocked for demonstration purposes.';
        } else if (err.message.includes('duplicate') || err.message.includes('unique')) {
          errorMessage = 'This email is already registered. Please use a different email address.';
        }
      }

      setSubmitError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (validationErrors.some(error => error.field === field)) {
      setValidationErrors(prev => prev.filter(error => error.field !== field));
    }
    // Clear submit error when user starts typing
    if (submitError) {
      setSubmitError(null);
    }
  };

  const handleSubmitAnother = () => {
    setSubmitted(false);
    setCurrentLead(null);
    setSubmitError(null);
    setValidationErrors([]);
  };

  if (submitted) {
    return (
      <div className="w-full max-w-md mx-auto">
        <div className="bg-gradient-card p-8 rounded-2xl shadow-card border border-border backdrop-blur-sm animate-slide-up text-center">
          <div className="relative mb-6">
            <div className="w-20 h-20 bg-gradient-primary rounded-full flex items-center justify-center mx-auto shadow-glow animate-glow">
              <CheckCircle className="w-10 h-10 text-primary-foreground" />
            </div>
          </div>

          <h2 className="text-3xl font-bold text-foreground mb-3">Welcome aboard! 🎉</h2>

          <p className="text-muted-foreground mb-2">
            Thanks for joining! We'll be in touch soon with updates.
          </p>

          {/* Fixed position display */}
          {currentLead?.position && currentLead?.total_leads ? (
            <p className="text-sm text-accent mb-8">
              You're #{currentLead.position} of {currentLead.total_leads} early supporters
            </p>
          ) : (
            <p className="text-sm text-accent mb-8">
              Welcome to our community of early supporters!
            </p>
          )}

          <div className="space-y-4">
            <div className="p-4 bg-accent/10 rounded-lg border border-accent/20">
              <p className="text-sm text-foreground">
                💡 <strong>What's next?</strong>
                <br />
                We'll send you exclusive updates, early access, and behind-the-scenes content as we
                build something amazing.
              </p>
            </div>

            <Button
              onClick={handleSubmitAnother}
              variant="outline"
              className="w-full border-border hover:bg-accent/10 transition-smooth group"
            >
              Submit Another Lead
              <User className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
          </div>

          <div className="mt-6 pt-6 border-t border-border">
            <p className="text-xs text-muted-foreground">
              Follow our journey on social media for real-time updates
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="bg-gradient-card p-8 rounded-2xl shadow-card border border-border backdrop-blur-sm animate-slide-up">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-primary rounded-full flex items-center justify-center mx-auto mb-4 shadow-glow">
            <Mail className="w-8 h-8 text-primary-foreground" />
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-2">Join Our Community</h2>
          <p className="text-muted-foreground">Be the first to know when we launch</p>
        </div>

        {/* Error Alert */}
        {submitError && (
          <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg animate-fade-in">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-destructive text-sm font-medium">Submission Failed</p>
                <p className="text-destructive/80 text-sm mt-1">{submitError}</p>
              </div>
              <button
                onClick={clearSubmitError}
                className="text-destructive/60 hover:text-destructive transition-colors"
                aria-label="Dismiss error"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <div className="relative">
              <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Your name"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                disabled={isSubmitting}
                className={`pl-10 h-12 bg-input border-border text-foreground placeholder:text-muted-foreground transition-smooth
                  ${getFieldError('name') ? 'border-destructive' : 'focus:border-accent focus:shadow-glow'}
                  ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}
                `}
              />
            </div>
            {getFieldError('name') && (
              <p className="text-destructive text-sm animate-fade-in">{getFieldError('name')}</p>
            )}
          </div>

          <div className="space-y-2">
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                type="email"
                placeholder="your@email.com"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                disabled={isSubmitting}
                className={`pl-10 h-12 bg-input border-border text-foreground placeholder:text-muted-foreground transition-smooth
                  ${getFieldError('email') ? 'border-destructive' : 'focus:border-accent focus:shadow-glow'}
                  ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}
                `}
              />
            </div>
            {getFieldError('email') && (
              <p className="text-destructive text-sm animate-fade-in">{getFieldError('email')}</p>
            )}
          </div>

          <div className="space-y-2">
            <div className="relative">
              <Building2 className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground z-10" />
              <Select
                value={formData.industry}
                onValueChange={(value) => handleInputChange('industry', value)}
                disabled={isSubmitting}
              >
                <SelectTrigger className={`pl-10 h-12 bg-input border-border text-foreground transition-smooth
                  ${getFieldError('industry') ? 'border-destructive' : 'focus:border-accent focus:shadow-glow'}
                  ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}
                `}>
                  <SelectValue placeholder="Select your industry" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="technology">Technology</SelectItem>
                  <SelectItem value="healthcare">Healthcare</SelectItem>
                  <SelectItem value="finance">Finance</SelectItem>
                  <SelectItem value="education">Education</SelectItem>
                  <SelectItem value="retail">Retail & E-commerce</SelectItem>
                  <SelectItem value="manufacturing">Manufacturing</SelectItem>
                  <SelectItem value="consulting">Consulting</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {getFieldError('industry') && (
              <p className="text-destructive text-sm animate-fade-in">{getFieldError('industry')}</p>
            )}
          </div>

          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full h-12 bg-gradient-primary text-primary-foreground font-semibold rounded-lg shadow-glow hover:shadow-[0_0_60px_hsl(210_100%_60%/0.3)] transition-smooth transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none"
          >
            {isSubmitting ? (
              <>
                <div className="w-5 h-5 mr-2 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <CheckCircle className="w-5 h-5 mr-2" />
                Get Early Access
              </>
            )}
          </Button>
        </form>

        <p className="text-xs text-muted-foreground text-center mt-6">
          By submitting, you agree to receive updates. Unsubscribe anytime.
        </p>
      </div>
    </div>
  );
};