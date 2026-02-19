import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Zap, Eye, EyeOff, Check } from "lucide-react";
import dvcLogo from "@/assets/branding/dvc-logo-circle.png";

const ResetPassword = () => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isTypingPassword, setIsTypingPassword] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // Check if user has a valid recovery session
    supabase.auth.getSession().then(({ data: { session } }) => {
      // If no session, check if we are in the process of extracting the hash from the URL (which supabase client handles)
      // But typically for reset password flow, the user is signed in via the link
      if (!session) {
        // Optimization: allow a small grace period for the session to be established if checking immediately after callback
        // For now, we will rely on implicit session state.
      }
    });

    // Listen for auth state changes to detect if session is lost or established
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        // This is the specific event for password recovery
      }
    });

    return () => subscription.unsubscribe();

  }, [navigate]);

  const validatePassword = (password: string): { valid: boolean; message?: string } => {
    if (password.length < 8) return { valid: false, message: 'Password must be at least 8 characters' };
    if (!/[a-z]/.test(password)) return { valid: false, message: 'Password must contain at least one lowercase letter' };
    if (!/[A-Z]/.test(password)) return { valid: false, message: 'Password must contain at least one uppercase letter' };
    if (!/[0-9]/.test(password)) return { valid: false, message: 'Password must contain at least one number' };
    if (!/[^a-zA-Z0-9]/.test(password)) return { valid: false, message: 'Password must contain at least one special character' };
    return { valid: true };
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      toast({
        title: "Weak password",
        description: passwordValidation.message || "Password does not meet requirements.",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      toast({
        title: "Passwords don't match",
        description: "Please make sure both passwords are the same.",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.updateUser({
      password: password,
    });

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      if (error) {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Password Updated",
          description: "Your password has been changed successfully. Please log in with your new password.",
        });

        // Sign out to force re-login with new password
        await supabase.auth.signOut();

        // Navigate to login (ensure we don't carry over any auth state)
        navigate("/auth", { replace: true });
      }

      setLoading(false);
    };

    return (
      <div className="min-h-screen gradient-mesh flex items-center justify-center p-4">
        <div className="w-full max-w-md animate-fade-in">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-2 mb-4">
              <img src={dvcLogo} alt="Digital Visiting Card Logo" className="object-contain bg-black rounded-full border border-white/10 shadow-[0_0_20px_rgba(168,85,247,0.35)] w-[34px] h-[34px] md:w-[40px] md:h-[40px]" />
              <h1 className="text-3xl font-bold text-gradient">Digital Visiting Card</h1>
            </div>
            <p className="text-muted-foreground">Set your new password</p>
          </div>

          <Card className="glass-card border-2 shadow-elegant">
            <CardHeader>
              <CardTitle>Reset Password</CardTitle>
              <CardDescription>
                Enter a strong password to secure your account
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="password">New Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onFocus={() => setIsTypingPassword(true)}
                      onBlur={() => setIsTypingPassword(false)}
                      placeholder="••••••••"
                      required
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      tabIndex={-1}
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>

                  {/* Password Requirements Checklist */}
                  <div className="text-xs space-y-1 mt-2 p-2 bg-muted/30 rounded-md border border-border/50">
                    <p className="font-medium mb-1 text-muted-foreground">Password must contain:</p>

                    <div className={`flex items-center gap-2 ${/[A-Z]/.test(password) ? "text-green-500" : "text-muted-foreground"}`}>
                      {/[A-Z]/.test(password) ? <Check className="w-3 h-3" /> : <div className="w-3 h-3 rounded-full border border-current" />}
                      <span>At least one uppercase letter</span>
                    </div>

                    <div className={`flex items-center gap-2 ${/[0-9]/.test(password) ? "text-green-500" : "text-muted-foreground"}`}>
                      {/[0-9]/.test(password) ? <Check className="w-3 h-3" /> : <div className="w-3 h-3 rounded-full border border-current" />}
                      <span>At least one number</span>
                    </div>

                    <div className={`flex items-center gap-2 ${/[^a-zA-Z0-9]/.test(password) ? "text-green-500" : "text-muted-foreground"}`}>
                      {/[^a-zA-Z0-9]/.test(password) ? <Check className="w-3 h-3" /> : <div className="w-3 h-3 rounded-full border border-current" />}
                      <span>At least one special character</span>
                    </div>

                    <div className={`flex items-center gap-2 ${password.length >= 8 ? "text-green-500" : "text-muted-foreground"}`}>
                      {password.length >= 8 ? <Check className="w-3 h-3" /> : <div className="w-3 h-3 rounded-full border border-current" />}
                      <span>Minimum length: 8 characters</span>
                    </div>
                  </div>

                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      tabIndex={-1}
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                  {password && confirmPassword && password !== confirmPassword && (
                    <p className="text-xs text-destructive">Passwords don't match</p>
                  )}
                </div>
                <Button
                  type="submit"
                  variant="gradient"
                  className="w-full"
                  disabled={loading}
                >
                  {loading ? "Resetting..." : "Reset Password"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  };

  export default ResetPassword;
