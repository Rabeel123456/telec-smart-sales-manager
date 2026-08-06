import {useState} from 'react'
import {supabase} from '../lib/supabase'

export default function Login(){
  const[email,setEmail]=useState('')
  const[password,setPassword]=useState('')
  const[error,setError]=useState('')
  const[loading,setLoading]=useState(false)

  async function submit(e){
    e.preventDefault()
    setLoading(true)
    setError('')
    const{error}=await supabase.auth.signInWithPassword({email,password})
    setLoading(false)
    if(error)setError(error.message)
  }

  return <div className='login-page'>
    <div className='login-shell'>
      <div className='login-brand-panel'>
<div className="login-brand-mark">
  <img
    src="/telec-logo.png"
    alt="TELEC"
    className="telec-login-logo"
  />
</div>
        
        <div>
          <span className='login-eyebrow'>TELEC GROUP</span>
          <h2>Smart Sales Manager</h2>
          <p>Manage opportunities, quotations, delivery challans, invoices, targets and reports from one secure workspace.</p>
        </div>
        <div className='login-brand-footer'>Developed by <strong>Rabeel Ahmed Siddiqui</strong></div>
      </div>

      <form className='login-card' onSubmit={submit}>
        <div className='login-logo'>T</div>
        <span className='login-card-kicker'>WELCOME BACK</span>
        <h1>Sign in to your account</h1>
        <p>Enter your credentials to access TELEC Smart Sales Manager.</p>
        <label>Email
          <input type='email' value={email} onChange={e=>setEmail(e.target.value)} placeholder='name@telec.com.pk' required/>
        </label>
        <label>Password
          <input type='password' value={password} onChange={e=>setPassword(e.target.value)} placeholder='Enter your password' required/>
        </label>
        {error&&<div className='error'>{error}</div>}
        <button className='primary' disabled={loading}>{loading?'Signing in...':'Sign In'}</button>
        <div className='login-mobile-credit'>Developed by <strong>Rabeel Ahmed Siddiqui</strong></div>
      </form>
    </div>
  </div>
}
