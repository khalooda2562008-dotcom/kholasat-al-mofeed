import { Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { api } from './api';
import Layout from './components/Layout';
import Welcome from './pages/Welcome';
import Home from './pages/Home';
import Explore from './pages/Explore';
import Categories from './pages/Categories';
import Channels from './pages/Channels';
import ChannelDetail from './pages/ChannelDetail';
import Projects from './pages/Projects';
import VideoPage from './pages/VideoPage';
import Library from './pages/Library';
import Folders from './pages/Folders';
import AI from './pages/AI';
import Summaries from './pages/Summaries';
import Settings from './pages/Settings';
import Profile from './pages/Profile';
import Admin from './pages/Admin';

function RequireEntry({ children }) {
  const entered = localStorage.getItem('km_entered_v1') === 'yes';
  return entered ? children : <Navigate to="/welcome" replace/>;
}
export default function App() {
  useEffect(()=>{api('/settings').then(({settings})=>{document.body.dataset.theme=settings.appearance?.theme||'dark';document.body.classList.toggle('compact-mode',Boolean(settings.appearance?.compact));document.body.dataset.lazyImages=String(settings.performance?.lazyImages!==false);}).catch(()=>{});},[]);
  return <Routes>
    <Route path="/welcome" element={<Welcome/>}/>
    <Route element={<RequireEntry><Layout/></RequireEntry>}>
      <Route index element={<Home/>}/>
      <Route path="explore" element={<Explore/>}/>
      <Route path="categories" element={<Categories/>}/>
      <Route path="channels" element={<Channels/>}/>
      <Route path="channels/:id" element={<ChannelDetail/>}/>
      <Route path="projects" element={<Projects/>}/>
      <Route path="video/:id" element={<VideoPage/>}/>
      <Route path="library/:type" element={<Library/>}/>
      <Route path="folders" element={<Folders/>}/>
      <Route path="folders/:id" element={<Folders/>}/>
      <Route path="ai" element={<AI/>}/>
      <Route path="summaries" element={<Summaries/>}/>
      <Route path="settings" element={<Settings/>}/>
      <Route path="profile" element={<Profile/>}/>
      <Route path="admin" element={<Admin/>}/>
    </Route>
    <Route path="*" element={<Navigate to="/" replace/>}/>
  </Routes>;
}
