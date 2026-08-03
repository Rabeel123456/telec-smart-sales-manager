import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Users() {
  const [users,setUsers]=useState([])
  const [form,setForm]=useState({full_name:'',email:'',password:'',role:'sales'})
  const [busy,setBusy]=useState(false)

  async function load() {
    const {data,error}=await supabase.from('profiles').select('id,full_name,role,active,created_at').order('created_at',{ascending:false})
    if(error) alert(error.message)
    setUsers(data||[])
  }
  useEffect(()=>{load()},[])

  async function createUser(e) {
    e.preventDefault(); setBusy(true)
    const {data:{session}}=await supabase.auth.getSession()
    const response=await fetch('/api/create-user',{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':`Bearer ${session?.access_token||''}`},
      body:JSON.stringify(form)
    })
    const result=await response.json()
    setBusy(false)
    if(!response.ok) return alert(result.error||'User could not be created')
    setForm({full_name:'',email:'',password:'',role:'sales'})
    setTimeout(load,700)
  }

  async function toggle(user) {
    const {error}=await supabase.from('profiles').update({active:!user.active}).eq('id',user.id)
    if(error) return alert(error.message)
    load()
  }

  return <div>
    <div className="topbar"><div><h1>User Management</h1><p>Create, activate and deactivate users</p></div></div>
    <section className="panel">
      <form className="user-create" onSubmit={createUser}>
        <input placeholder="Full name" required value={form.full_name} onChange={e=>setForm({...form,full_name:e.target.value})}/>
        <input type="email" placeholder="Email" required value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/>
        <input type="password" placeholder="Temporary password" required value={form.password} onChange={e=>setForm({...form,password:e.target.value})}/>
        <select value={form.role} onChange={e=>setForm({...form,role:e.target.value})}><option value="sales">Sales User</option><option value="admin">Administrator</option></select>
        <button className="primary" disabled={busy}>{busy?'Creating...':'Create User'}</button>
      </form>
      <div className="table-wrap"><table><thead><tr><th>Name</th><th>Role</th><th>Status</th><th>Action</th></tr></thead>
      <tbody>{users.map(u=><tr key={u.id}><td>{u.full_name}</td><td>{u.role}</td><td>{u.active?'Active':'Inactive'}</td><td><button className="secondary" onClick={()=>toggle(u)}>{u.active?'Deactivate':'Activate'}</button></td></tr>)}</tbody></table></div>
    </section>
  </div>
}