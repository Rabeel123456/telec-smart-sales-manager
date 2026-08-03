import {useEffect,useState} from 'react'
import {Navigate,Route,Routes} from 'react-router-dom'
import {supabase} from './lib/supabase'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Users from './pages/Users'
import Layout from './components/Layout'
export default function App(){
 const[session,setSession]=useState(null),[profile,setProfile]=useState(null),[loading,setLoading]=useState(true)
 async function loadProfile(id){const{data,error}=await supabase.from('profiles').select('id,full_name,role,active').eq('id',id).single();if(error)throw error;setProfile(data)}
 useEffect(()=>{let mounted=true;supabase.auth.getSession().then(async({data})=>{if(!mounted)return;setSession(data.session);if(data.session)try{await loadProfile(data.session.user.id)}catch(e){console.error(e)}setLoading(false)});const{data:sub}=supabase.auth.onAuthStateChange(async(_e,s)=>{setSession(s);if(s)try{await loadProfile(s.user.id)}catch(e){console.error(e)}else setProfile(null);setLoading(false)});return()=>{mounted=false;sub.subscription.unsubscribe()}},[])
 if(loading)return <div className='center'>Loading...</div>
 if(!session)return <Routes><Route path='*' element={<Login/>}/></Routes>
 if(!profile?.active)return <div className='center'>Your account is inactive. Please contact Admin.</div>
 return <Layout profile={profile}><Routes><Route path='/' element={<Dashboard profile={profile}/>}/><Route path='/users' element={profile.role==='admin'?<Users/>:<Navigate to='/'/>}/><Route path='*' element={<Navigate to='/'/>}/></Routes></Layout>
}
