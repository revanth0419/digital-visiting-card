import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Zap, Eye, EyeOff, Check, X } from "lucide-react";
import { motion } from "framer-motion";
import FloatingBackground from "@/components/auth/FloatingBackground";
import AnimatedCharacter from "@/components/auth/AnimatedCharacter";
import { DVCLogo } from "@/components/ui/DVCLogo";

type Expression = "neutral" | "happy" | "sad" | "shocked";

const Auth = () => {
  const [searchParams] = useSearchParams();
  const initialMode = searchParams.get("mode");

  // Default to signup if mode=signup, otherwise login
  const [isLogin, setIsLogin] = useState(initialMode !== "signup");
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [expression, setExpression] = useState<Expression>("neutral");
  const [cursorPosition, setCursorPosition] = useState({ x: 0, y: 0 });
  const [isTypingPassword, setIsTypingPassword] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutUntil, setLockoutUntil] = useState<number | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setCursorPosition({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  useEffect(() => {
    // Check if already logged in - but only redirect if session is valid
    const checkSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
          console.error("Session check error:", error);
          // Clear any stale session data
          await supabase.auth.signOut();
          setCheckingSession(false);
          return;
        }

        if (session?.user && session?.access_token) {
          // Verify the session is still valid by making a test request
          const { error: userError } = await supabase.auth.getUser();

          if (userError) {
            console.error("User verification failed:", userError);
            await supabase.auth.signOut();
            setCheckingSession(false);
            return;
          }

          // Valid session - redirect to dashboard
          navigate("/dashboard");
        } else {
          setCheckingSession(false);
        }
      } catch (err) {
        console.error("Session check failed:", err);
        setCheckingSession(false);
      }
    };

    checkSession();
  }, [navigate]);

  // Update isLogin when URL changes
  useEffect(() => {
    if (initialMode === "signup") {
      setIsLogin(false);
    } else if (initialMode === "login") {
      setIsLogin(true);
    }
  }, [initialMode]);

  const validateEmail = (email: string) => {
    return email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
  };

  const validatePassword = (password: string): { valid: boolean; message?: string } => {
    if (password.length < 8) return { valid: false, message: 'Password must be at least 8 characters' };
    if (!/[a-z]/.test(password)) return { valid: false, message: 'Password must contain at least one lowercase letter' };
    if (!/[A-Z]/.test(password)) return { valid: false, message: 'Password must contain at least one uppercase letter' };
    if (!/[0-9]/.test(password)) return { valid: false, message: 'Password must contain at least one number' };
    if (!/[^a-zA-Z0-9]/.test(password)) return { valid: false, message: 'Password must contain at least one special character' };
    return { valid: true };
  };

  const validateUsername = (username: string) => {
    return username.length >= 3 && username.length <= 30 && /^[a-zA-Z0-9_-]+$/.test(username);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (!validateEmail(email)) {
      toast({
        title: "Invalid email",
        description: "Please enter a valid email address.",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Check your email",
        description: "We've sent you a password reset link.",
      });
      setIsForgotPassword(false);
      setEmail("");
    }

    setLoading(false);
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate that fields are not empty
    if (!email.trim() || !password.trim()) {
      toast({
        title: "Missing credentials",
        description: "Please enter both email and password.",
        variant: "destructive",
      });
      return;
    }

    // Check rate limiting
    if (lockoutUntil && Date.now() < lockoutUntil) {
      const minutesLeft = Math.ceil((lockoutUntil - Date.now()) / 60000);
      toast({
        title: "Too many attempts",
        description: `Please wait ${minutesLeft} minute${minutesLeft > 1 ? 's' : ''} before trying again.`,
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    // Validation
    if (!validateEmail(email)) {
      toast({
        title: "Invalid email",
        description: "Please enter a valid email address.",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

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

    // Signup-specific validations
    if (!isLogin) {
      if (!validateUsername(username)) {
        toast({
          title: "Invalid username",
          description: "Username must be 3-30 characters and contain only letters, numbers, hyphens, and underscores.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      // Confirm password validation
      if (password !== confirmPassword) {
        toast({
          title: "Passwords don't match",
          description: "Please make sure your passwords match.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }
    }

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          setExpression("shocked");
          setTimeout(() => {
            setExpression("sad");
            setTimeout(() => setExpression("neutral"), 1500);
          }, 500);

          // Track failed attempts and implement rate limiting
          const newAttempts = failedAttempts + 1;
          setFailedAttempts(newAttempts);

          if (newAttempts >= 5) {
            const lockoutMs = Math.pow(2, newAttempts - 5) * 60000; // Exponential backoff
            setLockoutUntil(Date.now() + lockoutMs);
          }

          if (error.message.includes("Invalid login credentials")) {
            toast({
              title: "Login failed",
              description: "Invalid email or password. Please try again.",
              variant: "destructive",
            });
          } else if (error.message.includes("Email not confirmed")) {
            toast({
              title: "Email not verified",
              description: "Please check your email and verify your account before logging in.",
              variant: "destructive",
            });
          } else {
            toast({
              title: "Error",
              description: error.message,
              variant: "destructive",
            });
          }
        } else {
          // Reset failed attempts on successful login
          setFailedAttempts(0);
          setLockoutUntil(null);
          setExpression("happy");
          toast({
            title: "Welcome back!",
            description: "Successfully logged in.",
          });
          setTimeout(() => navigate("/dashboard"), 800);
        }
      } else {
        // Signup flow
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: {
              username,
              display_name: displayName || username,
            },
          },
        });

        if (error) {
          setExpression("sad");
          setTimeout(() => setExpression("neutral"), 2000);

          // Handle username already exists error generically
          const errorMsg = error.message.toLowerCase().includes('unique') ||
            error.message.toLowerCase().includes('duplicate') ||
            error.message.toLowerCase().includes('already registered')
            ? "This username or email may already be taken. Please try different ones."
            : error.message;

          toast({
            title: "Signup failed",
            description: errorMsg,
            variant: "destructive",
          });
        } else {
          setExpression("happy");
          toast({
            title: "✅ Signup successful!",
            description: "You can now log in with your credentials.",
          });
          // Redirect to dashboard after successful signup
          setTimeout(() => navigate("/dashboard"), 800);
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred.";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Show loading state while checking session
  if (checkingSession) {
    return (
      <div className="min-h-screen gradient-mesh flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen gradient-mesh flex items-center justify-center p-4 relative overflow-hidden">
      <FloatingBackground />

      <motion.div
        className="w-full max-w-md relative z-10"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="text-center mb-8">
          <motion.div
            className="flex items-center justify-center gap-2 mb-4"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
          >
            <DVCLogo className="w-10 h-10 text-primary" />
            <h1 className="text-4xl font-bold text-gradient pb-1">Digital Visiting Card</h1>
          </motion.div>
          <motion.p
            className="text-muted-foreground"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            Your smart digital link hub. Share all your important links in one beautiful place for free.
          </motion.p>
        </div>

        {/* Animated Character Removed */}

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <Card className="glass-card border-2 shadow-elegant">
            <CardHeader>
              <CardTitle>
                {isForgotPassword ? "Reset Password" : isLogin ? "Welcome Back" : "Create Account"}
              </CardTitle>
              <CardDescription>
                {isForgotPassword
                  ? "Enter your email to receive a password reset link"
                  : isLogin
                    ? "Log in to manage your links"
                    : "Sign up to get started"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={isForgotPassword ? handleForgotPassword : handleAuth} className="space-y-4">
                {!isLogin && !isForgotPassword && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="username">Username *</Label>
                      <Input
                        id="username"
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="johndoe"
                        required={!isLogin}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="displayName">Display Name (optional)</Label>
                      <Input
                        id="displayName"
                        type="text"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="John Doe"
                      />
                    </div>
                  </>
                )}
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                  />
                </div>
                {!isForgotPassword && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="password">Password</Label>
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
                      {isLogin && (
                        <button
                          type="button"
                          onClick={() => setIsForgotPassword(true)}
                          className="text-xs text-primary hover:underline"
                        >
                          Forgot password?
                        </button>
                      )}
                    </div>

                    {/* Password Requirements Checklist for Signup */}
                    {!isLogin && !isForgotPassword && (
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
                    )}

                    {/* Confirm Password for Signup */}
                    {!isLogin && (
                      <div className="space-y-2">
                        <Label htmlFor="confirmPassword">Confirm Password *</Label>
                        <div className="relative">
                          <Input
                            id="confirmPassword"
                            type={showConfirmPassword ? "text" : "password"}
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            onFocus={() => setIsTypingPassword(true)}
                            onBlur={() => setIsTypingPassword(false)}
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
                    )}
                  </>
                )}
                <Button
                  type="submit"
                  variant="gradient"
                  className="w-full"
                  disabled={loading}
                >
                  {loading ? "Loading..." : isForgotPassword ? "Send Reset Link" : isLogin ? "Log In" : "Sign Up"}
                </Button>
              </form>

              <div className="mt-4 text-center space-y-2">
                {isForgotPassword ? (
                  <button
                    type="button"
                    onClick={() => {
                      setIsForgotPassword(false);
                      setEmail("");
                    }}
                    className="text-sm text-primary hover:underline"
                  >
                    Back to login
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setIsLogin(!isLogin);
                      setPassword("");
                      setConfirmPassword("");
                    }}
                    className="text-sm text-primary hover:underline"
                  >
                    {isLogin ? "Don't have an account? Sign up" : "Already have an account? Log in"}
                  </button>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default Auth;
