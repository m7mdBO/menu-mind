import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Register() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    setLoading(true);
    try {
      await register(name, email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex">
      <div className="hidden md:flex w-1/2 bg-navy text-cream flex-col justify-between p-10 relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.05] pointer-events-none"
             style={{ backgroundImage: 'repeating-linear-gradient(45deg, #fff 0, #fff 1px, transparent 1px, transparent 12px)' }} />
        <div className="relative">
          <div className="text-mustard text-[11px] uppercase tracking-signage font-semibold">
            New Station
          </div>
          <div className="font-display font-black text-7xl leading-none mt-2">
            FIRE UP<br/>THE LINE.
          </div>
        </div>
        <div className="relative">
          <div className="border-l-2 border-copper pl-4">
            <div className="font-display text-2xl text-cream leading-tight">
              Track every gram. Predict every shortfall.
            </div>
            <div className="text-cream/60 text-sm mt-2 uppercase tracking-signage text-[10px]">
              — Setup takes 60 seconds
            </div>
          </div>
        </div>
        <div className="h-1 bg-gradient-to-r from-copper via-mustard to-copper absolute bottom-0 left-0 right-0" />
      </div>

      <div className="flex-1 flex items-center justify-center px-6 py-12 bg-bone">
        <div className="w-full max-w-md">
          <div className="md:hidden mb-8">
            <div className="font-display font-black text-5xl text-navy">MENUMIND</div>
          </div>

          <div className="eyebrow mb-2">New Account</div>
          <h1 className="font-display font-black text-5xl text-navy leading-none mb-8">
            Open the kitchen.
          </h1>

          <form onSubmit={onSubmit} className="space-y-5">
            <div>
              <label className="input-label">Your name</label>
              <input type="text" required value={name} onChange={(e) => setName(e.target.value)} className="input" placeholder="Chef Alex" />
            </div>
            <div>
              <label className="input-label">Email</label>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="input" placeholder="cook@kitchen.co" />
            </div>
            <div>
              <label className="input-label">Password (min 6 chars)</label>
              <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="input" placeholder="••••••••" />
            </div>
            {error && (
              <div className="bg-tomato/10 border-l-4 border-tomato px-3 py-2 text-sm text-tomato font-medium">
                {error}
              </div>
            )}
            <button type="submit" disabled={loading} className="btn-primary w-full disabled:opacity-50">
              {loading ? 'Creating…' : 'Create account →'}
            </button>
          </form>

          <p className="mt-6 text-sm text-ash">
            Already on the line?{' '}
            <Link to="/login" className="text-copper font-bold uppercase tracking-signage text-[11px]">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
