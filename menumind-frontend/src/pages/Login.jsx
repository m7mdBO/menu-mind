import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left brand panel */}
      <div className="hidden md:flex w-1/2 bg-navy text-cream flex-col justify-between p-10 relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.05] pointer-events-none"
             style={{ backgroundImage: 'repeating-linear-gradient(45deg, #fff 0, #fff 1px, transparent 1px, transparent 12px)' }} />
        <div className="relative">
          <div className="text-mustard text-[11px] uppercase tracking-signage font-semibold">
            Kitchen Operations OS
          </div>
          <div className="font-display font-black text-7xl leading-none mt-2">
            MENU<br/>MIND.
          </div>
        </div>
        <div className="relative space-y-6">
          <div className="border-l-2 border-copper pl-4">
            <div className="font-display text-2xl text-cream leading-tight">
              "Inventory that thinks before the rush hits."
            </div>
            <div className="text-cream/60 text-sm mt-2 uppercase tracking-signage text-[10px]">
              — The cloud kitchen pass
            </div>
          </div>
          <div className="flex gap-6 text-[11px] uppercase tracking-signage text-cream/50">
            <span><span className="text-mustard font-mono">01</span> · Stock</span>
            <span><span className="text-mustard font-mono">02</span> · Recipes</span>
            <span><span className="text-mustard font-mono">03</span> · AI restock</span>
          </div>
        </div>
        <div className="h-1 bg-gradient-to-r from-copper via-mustard to-copper absolute bottom-0 left-0 right-0" />
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 bg-bone">
        <div className="w-full max-w-md">
          <div className="md:hidden mb-8">
            <div className="font-display font-black text-5xl text-navy">MENUMIND</div>
            <div className="text-copper text-[10px] tracking-signage font-semibold uppercase mt-1">
              Kitchen Operations
            </div>
          </div>

          <div className="eyebrow mb-2">Station Login</div>
          <h1 className="font-display font-black text-5xl text-navy leading-none mb-8">
            Clock in.
          </h1>

          <form onSubmit={onSubmit} className="space-y-5">
            <div>
              <label className="input-label">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
                placeholder="cook@kitchen.co"
              />
            </div>
            <div>
              <label className="input-label">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input"
                placeholder="••••••••"
              />
            </div>
            {error && (
              <div className="bg-tomato/10 border-l-4 border-tomato px-3 py-2 text-sm text-tomato font-medium">
                {error}
              </div>
            )}
            <button type="submit" disabled={loading} className="btn-primary w-full disabled:opacity-50">
              {loading ? 'Signing in…' : 'Sign in →'}
            </button>
          </form>

          <p className="mt-6 text-sm text-ash">
            New to the kitchen?{' '}
            <Link to="/register" className="text-copper font-bold uppercase tracking-signage text-[11px]">
              Open an account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
